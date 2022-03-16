import { TwitchChannel } from "Core/TwitchChannel";
import { TwitchVOD } from "Core/TwitchVOD";
import express from "express";

export async function TwitchAPIVideos(req: express.Request, res: express.Response): Promise<void> {

    const channel_id = await TwitchChannel.channelIdFromLogin(req.params.login);

    if (!channel_id) {
        res.status(400).send({ status: "ERROR", message: "Invalid channel login" });
        return;
    }

    const videos = await TwitchVOD.getVideos(channel_id);

    if (!videos) {
        res.status(400).send({
            status: "ERROR",
            message: "Videos not found",
        });
        return;
    }

    res.send({
        data: videos,
        status: "OK",
    });

}

export async function TwitchAPIVideo(req: express.Request, res: express.Response): Promise<void> {

    const video_id = req.params.video_id;

    if (!video_id) {
        res.status(400).send({ status: "ERROR", message: "Invalid video id" });
        return;
    }

    const video = await TwitchVOD.getVideo(video_id);

    if (!video) {
        res.status(400).send({
            status: "ERROR",
            message: "Video not found",
        });
        return;
    }

    res.send({
        data: video,
        status: "OK",
    });

}