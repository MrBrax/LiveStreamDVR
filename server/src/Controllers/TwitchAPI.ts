import { TwitchChannel } from "@/Core/Providers/Twitch/TwitchChannel";
import { TwitchVOD } from "@/Core/Providers/Twitch/TwitchVOD";
import type express from "express";
import type { ApiErrorResponse } from "@common/Api/Api";
import { log, LOGLEVEL } from "@/Core/Log";

export async function TwitchAPIVideos(req: express.Request, res: express.Response): Promise<void> {

    const channel_id = await TwitchChannel.channelIdFromLogin(req.params.login);

    if (!channel_id) {
        res.status(400).send({ status: "ERROR", message: "Invalid channel login" });
        return;
    }

    const videos = await TwitchVOD.getVideosProxy(channel_id);

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

    let video;
    try {
        video = await TwitchVOD.getVideo(video_id);
    } catch (error) {
        res.status(400).send({
            status: "ERROR",
            message: `Error while fetching video data: ${(error as Error).message}`,
        } as ApiErrorResponse);
        return;
    }

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
        user = await TwitchChannel.getUserDataByLogin(login, true);
    } catch (error) {
        log(LOGLEVEL.FATAL, "route.twitchapi.user", `Error getting channel data: ${(error as Error).message}`, error);
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

export async function TwitchAPIClips(req: express.Request, res: express.Response): Promise<void> {

    const broadcaster_id = req.query.broadcaster_id as string | undefined;
    const game_id = req.query.game_id as string | undefined;
    const id = req.query.id as string | undefined;

    if (!broadcaster_id && !game_id && !id) {
        res.status(400).send({ status: "ERROR", message: "Invalid clip id" });
        return;
    }

    let data;
    try {
        data = await TwitchVOD.getClips({ broadcaster_id, game_id, id });
    } catch (error) {
        res.status(400).send({
            status: "ERROR",
            message: `Error while fetching clip data: ${(error as Error).message}`,
        } as ApiErrorResponse);
        return;
    }

    if (!data) {
        res.status(400).send({
            status: "ERROR",
            message: "Clips not found",
        } as ApiErrorResponse);
        return;
    }

    res.send({
        data,
        status: "OK",
    });

}

export async function TwitchAPIStreams(req: express.Request, res: express.Response): Promise<void> {

    const login = req.params.login;

    if (!login) {
        res.status(400).send({ status: "ERROR", message: "Invalid login" });
        return;
    }

    const channel_id = await TwitchChannel.channelIdFromLogin(login);

    if (!channel_id) {
        res.status(400).send({
            status: "ERROR",
            message: "Invalid channel login",
        } as ApiErrorResponse);
        return;
    }

    const streams = await TwitchChannel.getStreams(channel_id);

    if (!streams) {
        res.status(400).send({
            status: "ERROR",
            message: "Streams not found",
        } as ApiErrorResponse);
        return;
    }

    res.send({
        data: streams,
        status: "OK",
    });

}

export async function TwitchAPIChannel(req: express.Request, res: express.Response): Promise<void> {

    const login = req.params.login;

    if (!login) {
        res.status(400).send({ status: "ERROR", message: "Invalid login" });
        return;
    }

    const channel_id = await TwitchChannel.channelIdFromLogin(login);

    if (!channel_id) {
        res.status(400).send({
            status: "ERROR",
            message: "Invalid channel login",
        } as ApiErrorResponse);
        return;
    }

    const channel = await TwitchChannel.getChannelDataById(channel_id);

    if (!channel) {
        res.status(400).send({
            status: "ERROR",
            message: "Channel not found",
        } as ApiErrorResponse);
        return;
    }

    res.send({
        data: channel,
        status: "OK",
    });

}
