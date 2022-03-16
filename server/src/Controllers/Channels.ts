import express from "express";
import { generateStreamerList } from "../Helpers/StreamerList";
import { ChannelConfig, TwitchChannel } from "../Core/TwitchChannel";
import { VideoQuality } from "../Core/TwitchConfig";

export function ListChannels(req: express.Request, res: express.Response): void {

    const { channels, total_size } = generateStreamerList();

    res.send({
        data: {
            streamer_list: channels.map(c => c.toAPI()),
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

export function UpdateChannel(req: express.Request, res: express.Response): void {

    const channel = TwitchChannel.getChannelByLogin(req.params.login);

    if (!channel || !channel.login) {
        res.status(400).send({
            status: "ERROR",
            message: "Channel not found",
        });
        return;
    }

    const formdata: {
        quality: string;
        match: string;
        download_chat: boolean;
        burn_chat: boolean;
        no_capture: boolean;
    } = req.body;

    const quality        = formdata.quality ? formdata.quality.split(" ") as VideoQuality[] : [];
    const match          = formdata.match ? formdata.match.split(",").map(m => m.trim()) : [];
    const download_chat  = formdata.download_chat !== undefined;
    const burn_chat      = formdata.burn_chat !== undefined;
    const no_capture     = formdata.no_capture !== undefined;

    const channel_data: ChannelConfig = {
        login: channel.login,
        quality: quality,
        match: match,
        download_chat: download_chat,
        burn_chat: burn_chat,
        no_capture: no_capture,
    };

    channel.update(channel_data);

}

export function DeleteChannel(req: express.Request, res: express.Response): void {

    const channel = TwitchChannel.getChannelByLogin(req.params.login);

    if (!channel || !channel.login) {
        res.status(400).send({
            status: "ERROR",
            message: "Channel not found",
        });
        return;
    }

    channel.delete();

    res.send({
        status: "OK",
    });

}

export function AddChannel(req: express.Request, res: express.Response): void {

    const formdata: {
        login: string;
        quality: string;
        match: string;
        download_chat: boolean;
        burn_chat: boolean;
        no_capture: boolean;
    } = req.body;

    const channel_data: ChannelConfig = {
        login: formdata.login,
        quality: formdata.quality ? formdata.quality.split(" ") as VideoQuality[] : [],
        match: formdata.match ? formdata.match.split(",").map(m => m.trim()) : [],
        download_chat: formdata.download_chat !== undefined,
        burn_chat: formdata.burn_chat !== undefined,
        no_capture: formdata.no_capture !== undefined,
    };

    const channel = TwitchChannel.getChannelByLogin(channel_data.login);

    if (channel) {
        res.status(400).send({
            status: "ERROR",
            message: "Channel already exists",
        });
        return;
    }

    const new_channel = TwitchChannel.create(channel_data);

    res.send({
        data: new_channel,
        status: "OK",
    });

}