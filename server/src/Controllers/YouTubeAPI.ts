import { TwitchChannel } from "../Core/TwitchChannel";
import { TwitchVOD } from "../Core/TwitchVOD";
import express from "express";
import { ApiErrorResponse } from "../../../common/Api/Api";
import { LOGLEVEL, Log } from "../Core/Log";
import { YouTubeChannel } from "../Core/YouTubeChannel";

export async function YouTubeAPIChannel(req: express.Request, res: express.Response): Promise<void> {

    const channel_id = req.params.id;

    if (!channel_id) {
        res.status(400).send({ status: "ERROR", message: "Invalid channel id" });
        return;
    }

    const channel = await YouTubeChannel.getChannelDataById(channel_id);

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