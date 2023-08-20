import { YouTubeChannel } from "@/Core/Providers/YouTube/YouTubeChannel";
import { YouTubeVOD } from "@/Core/Providers/YouTube/YouTubeVOD";
import type { ApiErrorResponse } from "@common/Api/Api";
import type express from "express";
export async function YouTubeAPIVideos(
    req: express.Request,
    res: express.Response
): Promise<void> {
    const channel_id = req.params.channel_id;

    if (!channel_id) {
        res.api(400, {
            status: "ERROR",
            message: "Invalid channel login",
        });
        return;
    }

    const videos = await YouTubeVOD.getVideosProxy(channel_id);

    if (videos === false) {
        res.api(400, {
            status: "ERROR",
            message: "No response from API",
        } as ApiErrorResponse);
        return;
    }

    res.send({
        data: videos,
        status: "OK",
    });
}

export async function YouTubeAPIVideo(
    req: express.Request,
    res: express.Response
): Promise<void> {
    const video_id = req.params.video_id;

    if (!video_id) {
        res.api(400, { status: "ERROR", message: "Invalid video id" });
        return;
    }

    const video = await YouTubeVOD.getVideo(video_id);

    if (video === false) {
        res.api(400, {
            status: "ERROR",
            message: "No response from API",
        } as ApiErrorResponse);
        return;
    }

    res.send({
        data: video,
        status: "OK",
    });
}

export async function YouTubeAPIChannelID(
    req: express.Request,
    res: express.Response
): Promise<void> {
    const url = req.body.url;

    if (!url) {
        res.api(400, { status: "ERROR", message: "No URL" });
        return;
    }

    const channel_id = await YouTubeChannel.getChannelIdFromUrl(url);

    if (channel_id === false) {
        res.api(400, {
            status: "ERROR",
            message: "No response from API",
        } as ApiErrorResponse);
        return;
    }

    res.send({
        data: channel_id,
        status: "OK",
    });
}
