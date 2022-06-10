import express from "express";
import { Config } from "../Core/Config";
import { VideoQuality } from "../../../common/Config";
import path from "path";
import { BaseConfigDataFolder } from "../Core/BaseConfig";
import { TwitchVOD } from "../Core/TwitchVOD";
import { ApiErrorResponse } from "../../../common/Api/Api";
import { TwitchChannel } from "../Core/TwitchChannel";
import sanitize from "sanitize-filename";
import { format, parseJSON } from "date-fns";
import { formatString } from "../../../common/Format";

export async function ResetChannels(req: express.Request, res: express.Response): Promise<void> {

    await Config.resetChannels();

    res.send({
        status: "OK",
        message: "Reset channels.",
    });

}

export async function DownloadVod(req: express.Request, res: express.Response): Promise<void> {

    const url = req.body.url as string | undefined;
    const quality = req.body.quality as VideoQuality | undefined || "best";

    if (!url) {
        res.status(400).send({
            status: "ERROR",
            message: "No url provided",
        });
        return;
    }

    const id_match = url.match(/\/videos\/([0-9]+)/);

    if (!id_match) {
        res.status(400).send({
            status: "ERROR",
            message: "No id found in url",
        });
        return;
    }

    const id = id_match[1];

    const metadata = await TwitchVOD.getVideo(id);

    if (!metadata) {
        res.status(400).send({
            status: "ERROR",
            message: "No metadata found",
        });
        return;
    }

    const basename = `${metadata.user_login}.${id}.${quality}.mp4`;
    const file_path = path.join(BaseConfigDataFolder.saved_vods, basename);

    let success;

    try {
        success = await TwitchVOD.downloadVideo(id, quality, file_path);
    } catch (e) {
        res.status(400).send({
            status: "ERROR",
            message: `Error downloading video: ${(e as Error).message}`,
        });
        return;
    }

    if (success) {
        res.send({
            status: "OK",
            message: `Downloaded to ${file_path}`,
        });
    } else {
        res.status(400).send({
            status: "ERROR",
            message: "Failed to download",
        });
    }

}

export async function DownloadChat(req: express.Request, res: express.Response): Promise<void> {

    const url = req.body.url as string | undefined;

    const method = req.body.method as string | undefined || "td";

    if (!url) {
        res.status(400).send({
            status: "ERROR",
            message: "No url provided",
        });
        return;
    }

    if (method !== "td" && method !== "tcd") {
        res.status(400).send({
            status: "ERROR",
            message: "Invalid method. Must be 'td' or 'tcd'",
        });
        return;
    }

    const id_match = url.match(/\/videos\/([0-9]+)/);

    if (!id_match) {
        res.status(400).send({
            status: "ERROR",
            message: "No id found in url",
        });
        return;
    }

    const id = id_match[1];

    let metadata;

    try {
        metadata = await TwitchVOD.getVideo(id);
    } catch (error) {
        res.status(400).send({
            status: "ERROR",
            message: `Error while fetching video data: ${(error as Error).message}`,
        } as ApiErrorResponse);
        return;
    }

    if (!metadata) {
        res.status(400).send({
            status: "ERROR",
            message: "No metadata found",
        });
        return;
    }

    const basename = `${metadata.user_login}.${id}.chat.json`;
    const file_path = path.join(BaseConfigDataFolder.saved_vods, basename);

    let success;

    try {
        success = await TwitchVOD.downloadChat(method, id, file_path);
    } catch (e) {
        res.status(400).send({
            status: "ERROR",
            message: `Error downloading chat: ${(e as Error).message}`,
        });
        return;
    }

    if (success) {
        res.send({
            status: "OK",
            message: `Downloaded to ${file_path}`,
        });
    } else {
        res.status(400).send({
            status: "ERROR",
            message: "Failed to download",
        });
    }

}

export async function ChatDump(req: express.Request, res: express.Response): Promise<void> {

    const login = req.body.login as string | undefined;
    if (!login) {
        res.status(400).send({
            status: "ERROR",
            message: "No login provided",
        });
        return;
    }

    const channel_data = await TwitchChannel.getUserDataByLogin(login);
    if (!channel_data) {
        res.status(400).send({
            status: "ERROR",
            message: "No channel data found",
        });
        return;
    }

    const name = `${channel_data.login}-${new Date().toISOString().replace(/:/g, "-")}.json`;
    const started = new Date();
    const output = path.join(BaseConfigDataFolder.saved_vods, name);

    const job = TwitchChannel.startChatDump(name, login, channel_data.id, started, output);

    if (!job) {
        res.status(400).send({
            status: "ERROR",
            message: "Failed to start chat dump",
        });
        return;
    }

    res.send({
        status: "OK",
        message: `Started chat dump for ${login}. It does not end by itself.`,
    });

}

export async function DownloadClip(req: express.Request, res: express.Response): Promise<void> {

    const url = req.body.url as string | undefined;
    const quality = req.body.quality as VideoQuality | undefined || "best";

    if (!url) {
        res.status(400).send({
            status: "ERROR",
            message: "No url provided",
        });
        return;
    }

    const id = TwitchVOD.getClipId(url);

    if (!id) {
        res.status(400).send({
            status: "ERROR",
            message: "No id found in url",
        });
        return;
    }

    const clips = await TwitchVOD.getClips({ id: id });

    if (!clips) {
        res.status(400).send({
            status: "ERROR",
            message: "No metadata found",
        });
        return;
    }

    const metadata = clips[0];

    const clip_date = parseJSON(metadata.created_at);

    const variables = {
        id: metadata.id,
        quality: quality,
        clip_date: format(clip_date, "yyyy-MM-dd"),
        title: metadata.title,
        creator: metadata.creator_name,
        broadcaster: metadata.broadcaster_name,
    };

    const basename = sanitize(formatString(Config.getInstance().cfg("filename_clip", "{broadcaster} - {title} [{id}] [{quality}]"), variables) + ".mp4");
    // const basename = sanitize(`[${format(clip_date, "yyyy-MM-dd")}] ${metadata.broadcaster_name} - ${metadata.title} [${metadata.id}] [${quality}].mp4`); // new filename? sanitize(`${metadata.broadcaster_name}.${metadata.title}.${metadata.id}.${quality}.mp4`);
    const file_path = path.join(BaseConfigDataFolder.saved_clips, basename);

    let success;

    try {
        success = await TwitchVOD.downloadClip(id, file_path, quality);
    } catch (e) {
        res.status(400).send({
            status: "ERROR",
            message: `Error downloading video: ${(e as Error).message}`,
        });
        return;
    }

    if (success) {
        res.send({
            status: "OK",
            message: `Downloaded to ${file_path}`,
        });
    } else {
        res.status(400).send({
            status: "ERROR",
            message: "Failed to download",
        });
    }

}