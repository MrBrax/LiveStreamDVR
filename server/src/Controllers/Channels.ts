import express from "express";
import { generateStreamerList } from "../StreamerList";
import { TwitchChannel } from "../Core/TwitchChannel";

export function ListChannels(req: express.Request, res: express.Response): void {

    const { channels, total_size } = generateStreamerList();

    res.send({
        data: {
            streamer_list: channels,
            total_size: total_size,
            // free_size: fs.statSync(TwitchHelper.vodFolder()).size,
            free_size: -1, // broken until further notice
        },
        status: "OK",
    });
}

export function GetChannel(req: express.Request, res: express.Response): void {
    
    const channel = TwitchChannel.getChannelByLogin(req.params.login);

    if (!channel) {
        res.status(400).send({
            status: "ERROR",
            message: "Channel not found",
        });
        return;
    }

    res.send({
        data: channel,
        status: "OK",
    });

}