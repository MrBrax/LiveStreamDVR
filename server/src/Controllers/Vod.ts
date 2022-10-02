import { Config } from "../Core/Config";
import { format } from "date-fns";
import express from "express";
import fs from "fs";
import path from "path";
import sanitize from "sanitize-filename";
import { ApiErrorResponse, ApiResponse, ApiVodResponse } from "../../../common/Api/Api";
import { TwitchVODBookmark } from "../../../common/Bookmark";
import { VideoQuality } from "../../../common/Config";
import { VideoQualityArray } from "../../../common/Defs";
import { formatString } from "../../../common/Format";
import type { VodBasenameTemplate } from "../../../common/Replacements";
import { BaseConfigDataFolder } from "../Core/BaseConfig";
import { TwitchHelper } from "../Providers/Twitch";
import { Log, LOGLEVEL } from "../Core/Log";
import { TwitchVOD } from "../Core/Providers/Twitch/TwitchVOD";
import { LiveStreamDVR } from "../Core/LiveStreamDVR";
import { Helper } from "../Core/Helper";
import { EditableChapter } from "../../../common/Api/Client";
import { TwitchVODChapter } from "../Core/Providers/Twitch/TwitchVODChapter";

export async function GetVod(req: express.Request, res: express.Response): Promise<void> {

    const vod = LiveStreamDVR.getInstance().getVodByUUID(req.params.uuid);

    if (!vod) {
        res.status(400).send({
            status: "ERROR",
            message: "Vod not found",
        } as ApiErrorResponse);
        return;
    }

    res.send({
        data: await vod.toAPI(),
        status: "OK",
    } as ApiVodResponse);

}

export async function EditVod(req: express.Request, res: express.Response): Promise<void> {

    const vod = LiveStreamDVR.getInstance().getVodByUUID(req.params.uuid);

    if (!vod) {
        res.status(400).send({
            status: "ERROR",
            message: "Vod not found",
        } as ApiErrorResponse);
        return;
    }

    const stream_number = req.body.stream_number as number;
    const absolute_season = req.body.absolute_season as number;
    const comment = req.body.comment as string;
    const prevent_deletion = req.body.prevent_deletion as boolean;
    const segments = req.body.segments as string;
    const cloud_storage = req.body.cloud_storage as boolean;
    const editChapters = req.body.edit_chapters as boolean;
    const chapters = req.body.chapters as EditableChapter[];

    let changed = false;

    if (stream_number !== vod.stream_number) {
        vod.stream_number = stream_number;
        changed = true;
    }

    if (absolute_season !== vod.stream_absolute_season) {
        vod.stream_absolute_season = absolute_season;
        changed = true;
    }

    if (comment !== vod.comment) {
        vod.comment = comment;
        changed = true;
    }

    if (prevent_deletion !== vod.prevent_deletion) {
        vod.prevent_deletion = prevent_deletion;
        changed = true;
    }

    if (cloud_storage !== vod.cloud_storage) {
        vod.cloud_storage = cloud_storage;
        changed = true;
    }

    // vod.comment = comment;
    // vod.prevent_deletion = prevent_deletion;
    // vod.stream_absolute_season = absolute_season;
    // vod.cloud_storage = cloud_storage;

    const segments_array = segments.split("\n").map(s => s.trim()).filter(s => s.length > 0);
    // if (segments_array.length !== vod.segments.length) {
    //     vod.segments = segments_array;
    //     changed = true;
    // }
    if (segments) {
        vod.segments_raw = segments_array;
        vod.parseSegments(vod.segments_raw);
        changed = true;
    }

    if (editChapters && chapters && vod.started_at) {

        // console.debug(vod.started_at, vod.created_at, vod.capture_started, vod.capture_started2);
        console.debug(
            `vod.started_at: ${vod.started_at}\n`,
            `vod.created_at: ${vod.created_at}\n`,
            `vod.capture_started: ${vod.capture_started}\n`,
            `vod.capture_started2: ${vod.capture_started2}\n`
        );

        const d = ["duration", "offset", "title", "started_at"];

        console.debug("inputChapters");
        console.table(/*"inputChapters",*/ chapters, d);

        console.debug("vodChapters");
        console.table(/*"vodChapters",*/ vod.chapters, d);

        const realChapters = await Promise.all(chapters.map(async c => {
            if (!vod.started_at) {
                console.error("VOD has no started_at");
                return;
            }
            // const started = vod.created_at ?? vod.started_at;
            const started = vod.started_at;
            const originalChapter = c.originalIndex !== undefined ? vod.chapters[c.originalIndex] : undefined;
            const json = {
                ...c,
                started_at: new Date(started.getTime() + (c.offset * 1000)).toISOString(),
                is_mature: c.is_mature || false,
                online: originalChapter ? originalChapter.online : false,
            };
            return await TwitchVODChapter.fromJSON(json);
        }));

        realChapters.forEach((c, i) => {
            if (!vod.started_at) return;
            const n = realChapters[i + 1];
            c?.calculateDurationAndOffset(vod.started_at, vod.ended_at, n ? n.started_at : undefined);
        });

        console.debug("realChapters");
        console.table(/*"realChapters",*/ realChapters, d);

        // purge original chapters and add new ones
        vod.chapters = [];
        realChapters.forEach(c => {
            if (c) {
                vod.addChapter(c);
            }
        });

    }

    if (changed) {

        await vod.saveJSON("edit vod form");

        res.send({
            status: "OK",
            message: "Vod edited",
        } as ApiResponse);

    } else {

        res.send({
            status: "OK",
            message: "No changes",
        } as ApiResponse);

    }

}

export function ArchiveVod(req: express.Request, res: express.Response): void {

    const vod = LiveStreamDVR.getInstance().getVodByUUID(req.params.uuid);

    if (!vod) {
        res.status(400).send({
            status: "ERROR",
            message: "Vod not found",
        } as ApiErrorResponse);
        return;
    }

    vod.archive();

    res.send({
        status: "OK",
    });

}

export async function DeleteVod(req: express.Request, res: express.Response): Promise<void> {

    const vod = LiveStreamDVR.getInstance().getVodByUUID(req.params.uuid);

    if (!vod) {
        res.status(400).send({
            status: "ERROR",
            message: "Vod not found",
        } as ApiErrorResponse);
        return;
    }

    try {
        await vod.delete();
    } catch (error) {
        res.status(400).send({
            status: "ERROR",
            message: `Vod could not be deleted: ${(error as Error).message}`,
        } as ApiErrorResponse);
        return;
    }

    res.send({
        status: "OK",
    });

}

export async function DeleteVodSegment(req: express.Request, res: express.Response): Promise<void> {

    const vod = LiveStreamDVR.getInstance().getVodByUUID(req.params.uuid);

    if (!vod) {
        res.status(400).send({
            status: "ERROR",
            message: "Vod not found",
        } as ApiErrorResponse);
        return;
    }

    try {
        await vod.deleteSegment(parseInt(req.query.segment as string), req.query.keep_entry === "true");
    } catch (error) {
        res.status(400).send({
            status: "ERROR",
            message: `Vod segment could not be deleted: ${(error as Error).message}`,
        } as ApiErrorResponse);
        return;
    }

    res.send({
        status: "OK",
    });

}

export async function DownloadVod(req: express.Request, res: express.Response): Promise<void> {

    const vod = LiveStreamDVR.getInstance().getVodByUUID(req.params.uuid);

    const quality = req.query.quality && VideoQualityArray.includes(req.query.quality as string) ? req.query.quality as VideoQuality : "best";

    if (!vod) {
        res.status(400).send({
            status: "ERROR",
            message: "Vod not found",
        } as ApiErrorResponse);
        return;
    }

    const success = await vod.downloadVod(quality);

    res.send({
        status: success ? "OK" : "ERROR",
    });

}

export async function DownloadChat(req: express.Request, res: express.Response): Promise<void> {

    const vod = LiveStreamDVR.getInstance().getVodByUUID(req.params.uuid);

    if (!vod) {
        res.status(400).send({
            status: "ERROR",
            message: "Vod not found",
        } as ApiErrorResponse);
        return;
    }

    let success;

    try {
        success = await vod.downloadChat();
    } catch (error) {
        res.status(500).send({
            status: "ERROR",
            message: `Chat download error: ${(error as Error).message}`,
        });
        return;
    }

    res.send({
        status: success ? "OK" : "ERROR",
    });

}

export async function RenderWizard(req: express.Request, res: express.Response): Promise<void> {

    const vod = LiveStreamDVR.getInstance().getVodByUUID(req.params.uuid);

    if (!vod) {
        res.status(400).send({
            status: "ERROR",
            message: "Vod not found",
        } as ApiErrorResponse);
        return;
    }

    const data = req.body;
    const chat_width = data.chatWidth;
    const chat_height = data.chatHeight;
    const render_chat = data.renderChat;
    const burn_chat = data.burnChat;
    const vod_source = data.vodSource;
    const chat_source = data.chatSource;
    const chat_font = data.chatFont;
    const chat_font_size = data.chatFontSize;
    const burn_horizontal = data.burnHorizontal;
    const burn_vertical = data.burnVertical;
    const burn_offset = data.burnOffset || 0;
    const ffmpeg_preset = data.ffmpegPreset;
    const ffmpeg_crf = data.ffmpegCrf;
    const test_duration = data.testDuration || false;

    let status_renderchat = false;
    let status_burnchat = false;

    Log.logAdvanced(LOGLEVEL.INFO, "vodclass", `Start render wizard for vod ${vod}`);
    Log.logAdvanced(LOGLEVEL.INFO, "vodclass", `chat_width: ${chat_width}`);
    Log.logAdvanced(LOGLEVEL.INFO, "vodclass", `chat_height: ${chat_height}`);
    Log.logAdvanced(LOGLEVEL.INFO, "vodclass", `render_chat: ${render_chat}`);
    Log.logAdvanced(LOGLEVEL.INFO, "vodclass", `burn_chat: ${burn_chat}`);
    Log.logAdvanced(LOGLEVEL.INFO, "vodclass", `vod_source: ${vod_source}`);
    Log.logAdvanced(LOGLEVEL.INFO, "vodclass", `chat_source: ${chat_source}`);

    if (render_chat) {
        try {
            status_renderchat = await vod.renderChat(chat_width, chat_height, chat_font, chat_font_size, chat_source == "downloaded", true);
        } catch (error) {
            res.status(400).send({
                status: "ERROR",
                message: (error as Error).message || "Unknown error occurred while rendering chat",
            } as ApiErrorResponse);
            return;
        }
    }

    if (burn_chat) {
        try {
            status_burnchat = await vod.burnChat(burn_horizontal, burn_vertical, ffmpeg_preset, ffmpeg_crf, vod_source == "downloaded", true, burn_offset, test_duration);
        } catch (error) {
            res.status(400).send({
                status: "ERROR",
                message: (error as Error).message || "Unknown error occurred while burning chat",
            } as ApiErrorResponse);
            return;
        }
    }

    res.status(200).send({
        status: "OK",
        data: {
            status_renderchat: status_renderchat,
            status_burnchat: status_burnchat,
        },
    } as ApiResponse);

}

export async function CheckMute(req: express.Request, res: express.Response): Promise<void> {

    const vod = LiveStreamDVR.getInstance().getVodByUUID(req.params.uuid);

    if (!vod) {
        res.status(400).send({
            status: "ERROR",
            message: "Vod not found",
        } as ApiErrorResponse);
        return;
    }

    let is_muted;
    try {
        is_muted = await vod.checkMutedVod(true);
    } catch (error) {
        res.status(400).send({
            status: "ERROR",
            message: (error as Error).message || "Unknown error occurred while checking mute",
        } as ApiErrorResponse);
        return;
    }

    res.send({
        status: "OK",
        data: {
            vod: await vod.toAPI(),
            muted: is_muted,
        },
    } as ApiResponse);

}

export async function FixIssues(req: express.Request, res: express.Response): Promise<void> {

    const vod = LiveStreamDVR.getInstance().getVodByUUID(req.params.uuid);

    if (!vod) {
        res.status(400).send({
            status: "ERROR",
            message: "Vod not found",
        } as ApiErrorResponse);
        return;
    }

    await vod.fixIssues();

    res.send({
        status: "OK",
        message: "Issues fixed, possibly.",
    } as ApiResponse);

}

export async function MatchVod(req: express.Request, res: express.Response): Promise<void> {

    const vod = LiveStreamDVR.getInstance().getVodByUUID(req.params.uuid);

    if (!vod) {
        res.status(400).send({
            status: "ERROR",
            message: "Vod not found",
        } as ApiErrorResponse);
        return;
    }

    if (!(vod instanceof TwitchVOD)) {
        res.status(400).send({
            status: "ERROR",
            message: "Vod not compatible",
        } as ApiErrorResponse);
        return;
    }

    const success = await vod.matchProviderVod(true);

    if (!success) {
        res.status(400).send({
            status: "ERROR",
            message: "Vod not matched",
        } as ApiErrorResponse);
        return;
    }

    await vod.saveJSON("matched provider vod");

    res.send({
        status: "OK",
        message: `Vod matched to ${vod.twitch_vod_id}, duration ${vod.twitch_vod_duration}`,
    } as ApiResponse);

}

export async function CutVod(req: express.Request, res: express.Response): Promise<void> {

    const vod = LiveStreamDVR.getInstance().getVodByUUID(req.params.uuid);

    if (!vod) {
        res.status(400).send({
            status: "ERROR",
            message: "Vod not found",
        } as ApiErrorResponse);
        return;
    }

    const time_in = req.body.time_in;
    const time_out = req.body.time_out;
    const segment_name = req.body.name || "clip";

    if (time_in === undefined || time_out === undefined) {
        res.status(400).send({
            status: "ERROR",
            message: "Missing time_in or time_out",
        } as ApiErrorResponse);
        return;
    }

    if (time_in >= time_out) {
        res.status(400).send({
            status: "ERROR",
            message: "time_in must be less than time_out",
        } as ApiErrorResponse);
        return;
    }

    if (!vod.segments || vod.segments.length == 0) {
        res.status(400).send({
            status: "ERROR",
            message: "Vod has no segments",
        } as ApiErrorResponse);
        return;
    }

    if (!vod.is_finalized) {
        res.status(400).send({
            status: "ERROR",
            message: "Vod is not finalized",
        } as ApiErrorResponse);
        return;
    }

    if (!vod.segments[0].basename) {
        res.status(400).send({
            status: "ERROR",
            message: "Vod has no valid first segment",
        } as ApiErrorResponse);
        return;
    }

    if (!vod.video_metadata) {
        res.status(400).send({
            status: "ERROR",
            message: "Vod has no video metadata",
        } as ApiErrorResponse);
        return;
    }

    const channel = vod.getChannel();

    // const fps = vod.video_metadata.fps;
    // const seconds_in = Math.floor(time_in / fps);
    // const seconds_out = Math.floor(time_out / fps);
    const seconds_in = time_in;
    const seconds_out = time_out;
    // don't use fps, not using frame numbers, but seconds

    const file_in = path.join(vod.directory, vod.segments[0].basename);
    const file_out = path.join(BaseConfigDataFolder.saved_clips, "editor", channel.internalName, `${vod.basename}_${time_in}-${time_out}_${segment_name}.mp4`);

    if (!fs.existsSync(path.dirname(file_out))) {
        fs.mkdirSync(path.dirname(file_out), { recursive: true });
    }

    let ret;

    try {
        ret = await Helper.cutFile(file_in, file_out, seconds_in, seconds_out);
    } catch (error) {
        res.status(400).send({
            status: "ERROR",
            message: (error as Error).message || "Unknown error occurred while cutting vod",
        } as ApiErrorResponse);
        return;
    }

    if (!ret) {
        res.status(400).send({
            status: "ERROR",
            message: "Cut failed",
        } as ApiErrorResponse);
        return;
    }

    if (vod.is_chat_downloaded || vod.is_chatdump_captured) {

        const chat_file_in = vod.is_chat_downloaded ? vod.path_chat : vod.path_chatdump;
        const chat_file_out = path.join(BaseConfigDataFolder.saved_clips, `${vod.basename}_${time_in}-${time_out}_${segment_name}_chat.json`);

        let success;
        try {
            success = await TwitchHelper.cutChat(chat_file_in, chat_file_out, seconds_in, seconds_out);
        } catch (error) {
            Log.logAdvanced(LOGLEVEL.ERROR, "route.vod.cutVod", `Cut chat failed: ${(error as Error).message}`);
        }

        if (success) {
            Log.logAdvanced(LOGLEVEL.INFO, "route.vod.cutVod", `Cut chat ${chat_file_in} to ${chat_file_out} success`);
        }

    }

    vod.getChannel()?.findClips();

    res.send({
        status: "OK",
        message: "Cut successful",
    } as ApiResponse);

    return;

}

export function AddBookmark(req: express.Request, res: express.Response): void {

    const vod = LiveStreamDVR.getInstance().getVodByUUID(req.params.uuid);

    if (!vod) {
        res.status(400).send({
            status: "ERROR",
            message: "Vod not found",
        } as ApiErrorResponse);
        return;
    }

    if (!("bookmarks" in vod)) {
        res.status(400).send({
            status: "ERROR",
            message: "Vod not compatible",
        } as ApiErrorResponse);
        return;
    }

    const date = req.body.date ? new Date(req.body.date) : undefined;
    const offset = req.body.offset ? parseInt(req.body.offset) : undefined;

    if (!date && !offset) {
        res.status(400).send({
            status: "ERROR",
            message: "Date or offset is required",
        } as ApiErrorResponse);
        return;
    }

    if (!vod.started_at) {
        res.status(400).send({
            status: "ERROR",
            message: "Vod has not started yet",
        } as ApiErrorResponse);
        return;
    }

    if (offset && !vod.is_finalized) {
        res.status(400).send({
            status: "ERROR",
            message: "Vod is not finalized, cannot add bookmark with offset",
        } as ApiErrorResponse);
        return;
    }

    let absolute_date;

    if (offset) {
        const start_date = vod.started_at;
        absolute_date = new Date(start_date.getTime() + offset * 1000);
    } else {
        absolute_date = date;
    }

    if (!absolute_date) {
        res.status(400).send({
            status: "ERROR",
            message: "Invalid date returned from date or offset",
        } as ApiErrorResponse);
        return;
    }

    const bookmark_data: TwitchVODBookmark = {
        name: req.body.name,
        date: absolute_date,
    };

    vod.bookmarks.push(bookmark_data);
    vod.calculateBookmarks();
    vod.saveJSON("bookmark add");

    res.send({
        status: "OK",
        message: "Bookmark added",
    } as ApiResponse);

    return;

}

export function RemoveBookmark(req: express.Request, res: express.Response): void {

    const vod = LiveStreamDVR.getInstance().getVodByUUID(req.params.uuid);

    if (!vod) {
        res.status(400).send({
            status: "ERROR",
            message: "Vod not found",
        } as ApiErrorResponse);
        return;
    }

    if (!("bookmarks" in vod)) {
        res.status(400).send({
            status: "ERROR",
            message: "Vod not compatible",
        } as ApiErrorResponse);
        return;
    }

    const index = req.query.index !== undefined ? parseInt(req.query.index as string) : -1;

    if (index < 0 || index >= vod.bookmarks.length) {
        res.status(400).send({
            status: "ERROR",
            message: "Invalid bookmark index",
        } as ApiErrorResponse);
        return;
    }

    vod.bookmarks.splice(index, 1);
    vod.calculateBookmarks();
    vod.saveJSON("bookmark remove");

    res.send({
        status: "OK",
        message: "Bookmark removed",
    } as ApiResponse);

    return;

}

export async function GetSync(req: express.Request, res: express.Response): Promise<void> {

    const vod = LiveStreamDVR.getInstance().getVodByUUID(req.params.uuid);

    if (!vod) {
        res.status(400).send({
            status: "ERROR",
            message: "Vod not found",
        } as ApiErrorResponse);
        return;
    }

    /*
    const data = await vod.getSync();

    res.send({
        data,
    });
    */

}

export async function RenameVod(req: express.Request, res: express.Response): Promise<void> {

    const vod = LiveStreamDVR.getInstance().getVodByUUID(req.params.uuid);

    if (!vod) {
        res.status(400).send({
            status: "ERROR",
            message: "Vod not found",
        } as ApiErrorResponse);
        return;
    }

    const template = req.body.template;

    const variables: VodBasenameTemplate = {
        login: vod.getChannel().internalName,
        internalName: vod.getChannel().internalName,
        displayName: vod.getChannel().displayName,
        date: vod.started_at ? format(vod.started_at, TwitchHelper.TWITCH_DATE_FORMAT).replaceAll(":", "_") : "",
        year: vod.started_at ? format(vod.started_at, "yyyy") : "",
        year_short: vod.started_at ? format(vod.started_at, "yy") : "",
        month: vod.started_at ? format(vod.started_at, "MM") : "",
        day: vod.started_at ? format(vod.started_at, "dd") : "",
        hour: vod.started_at ? format(vod.started_at, "HH") : "",
        minute: vod.started_at ? format(vod.started_at, "mm") : "",
        second: vod.started_at ? format(vod.started_at, "ss") : "",
        id: vod.capture_id || "",
        season: vod.stream_season || "",
        episode: vod.stream_number ? vod.stream_number.toString() : "",
    };

    const basename = sanitize(formatString(template || Config.getInstance().cfg("filename_vod"), variables));

    await vod.changeBaseName(basename);

    res.send({
        status: "OK",
        message: basename,
    } as ApiResponse);

    return;

}