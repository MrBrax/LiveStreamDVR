import { BaseConfigDataFolder } from "../Core/BaseConfig";
import { Helper } from "../Core/Helper";
import express from "express";
import path from "path";
import { ApiErrorResponse, ApiResponse, ApiVodResponse } from "../../../common/Api/Api";
import { VideoQuality } from "../../../common/Config";
import { VideoQualityArray } from "../../../common/Defs";
import { LOGLEVEL, Log } from "../Core/Log";
import { TwitchVOD } from "../Core/TwitchVOD";

export async function GetVod(req: express.Request, res: express.Response): Promise<void> {

    const vod = TwitchVOD.getVod(req.params.basename);

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

export function ArchiveVod(req: express.Request, res: express.Response): void {

    const vod = TwitchVOD.getVod(req.params.basename);

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

export function DeleteVod(req: express.Request, res: express.Response): void {

    const vod = TwitchVOD.getVod(req.params.basename);

    if (!vod) {
        res.status(400).send({
            status: "ERROR",
            message: "Vod not found",
        } as ApiErrorResponse);
        return;
    }

    vod.delete();

    res.send({
        status: "OK",
    });

}

export async function DownloadVod(req: express.Request, res: express.Response): Promise<void> {

    const vod = TwitchVOD.getVod(req.params.basename);

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

    const vod = TwitchVOD.getVod(req.params.basename);

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

    const vod = TwitchVOD.getVod(req.params.basename);

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
    const ffmpeg_preset = data.ffmpegPreset;
    const ffmpeg_crf = data.ffmpegCrf;

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
            status_burnchat = await vod.burnChat(burn_horizontal, burn_vertical, ffmpeg_preset, ffmpeg_crf, vod_source == "downloaded", true);
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

    const vod = TwitchVOD.getVod(req.params.basename);

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
            vod: vod,
            muted: is_muted,
        },
    } as ApiResponse);

}

export async function FixIssues(req: express.Request, res: express.Response): Promise<void> {

    const vod = TwitchVOD.getVod(req.params.basename);

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

    const vod = TwitchVOD.getVod(req.params.basename);

    if (!vod) {
        res.status(400).send({
            status: "ERROR",
            message: "Vod not found",
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

    vod.saveJSON("matched provider vod");

    res.send({
        status: "OK",
        message: `Vod matched to ${vod.twitch_vod_id}, duration ${vod.twitch_vod_duration}`,
    } as ApiResponse);

}

export async function CutVod(req: express.Request, res: express.Response): Promise<void> {

    const vod = TwitchVOD.getVod(req.params.basename);

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

    // const fps = vod.video_metadata.fps;
    // const seconds_in = Math.floor(time_in / fps);
    // const seconds_out = Math.floor(time_out / fps);
    const seconds_in = time_in;
    const seconds_out = time_out;
    // don't use fps, not using frame numbers, but seconds

    const file_in = path.join(vod.directory, vod.segments[0].basename);
    const file_out = path.join(BaseConfigDataFolder.saved_clips, `${vod.basename}_${time_in}-${time_out}_${segment_name}.mp4`);

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
            success = await Helper.cutChat(chat_file_in, chat_file_out, seconds_in, seconds_out);
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