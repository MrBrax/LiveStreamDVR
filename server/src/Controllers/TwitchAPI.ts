import { TwitchChannel } from "../Core/TwitchChannel";
import { TwitchVOD } from "../Core/TwitchVOD";
import express from "express";
import { ApiErrorResponse } from "../../../common/Api/Api";
import { LOGLEVEL, Log } from "../Core/Log";

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
        } as ApiErrorResponse);
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
        } as ApiErrorResponse);
        return;
    }

    res.send({
        data: video,
        status: "OK",
    });

}

export async function TwitchAPIUser(req: express.Request, res: express.Response): Promise<void> {

    const login = req.params.login;

    if (!login) {
        res.status(400).send({ status: "ERROR", message: "Invalid login" });
        return;
    }

    let user;
    try {
        user = await TwitchChannel.getChannelDataByLogin(login, true);
    } catch (error) {
        Log.logAdvanced(LOGLEVEL.FATAL, "route.twitchapi.user", `Error getting channel data: ${(error as Error).message}`, error);
        res.status(400).send({
            status: "ERROR",
            message: `User not found: ${(error as Error).message}`,
        } as ApiErrorResponse);
        return;
    }

    if (!user) {
        res.status(400).send({
            status: "ERROR",
            message: "User not found",
        } as ApiErrorResponse);
        return;
    }

    res.send({
        data: user,
        status: "OK",
    });

}