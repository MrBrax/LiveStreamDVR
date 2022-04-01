import express from "express";
import { generateStreamerList } from "../Helpers/StreamerList";
import { TwitchChannel } from "../Core/TwitchChannel";
import { ChannelConfig, VideoQuality } from "../../../common/Config";
import type { ApiChannelResponse, ApiChannelsResponse, ApiErrorResponse } from "../../../common/Api/Api";
import { VideoQualityArray } from "../../../common/Defs";
import { LOGLEVEL, TwitchLog } from "../Core/TwitchLog";
import { TwitchVOD } from "../Core/TwitchVOD";
import { replaceAll } from "Helpers/ReplaceAll";
import { TwitchHelper } from "Core/TwitchHelper";
import { TwitchConfig } from "Core/TwitchConfig";
import path from "path";
import { parse } from "date-fns";
import { TwitchWebhook } from "Core/TwitchWebhook";

export async function ListChannels(req: express.Request, res: express.Response): Promise<void> {

    const { channels, total_size } = generateStreamerList();

    const streamer_list = await Promise.all(channels.map(async c => await c.toAPI()));
    
    res.send({
        data: {
            streamer_list: streamer_list,
            total_size: total_size,
            // free_size: fs.statSync(TwitchHelper.vodFolder()).size,
            free_size: -1, // broken until further notice
        },
        status: "OK",
    } as ApiChannelsResponse);
}

export async function GetChannel(req: express.Request, res: express.Response): Promise<void> {

    const channel = TwitchChannel.getChannelByLogin(req.params.login);

    if (!channel) {
        res.status(400).send({
            status: "ERROR",
            message: "Channel not found",
        } as ApiErrorResponse);
        return;
    }

    res.send({
        data: await channel.toAPI(),
        status: "OK",
    } as ApiChannelResponse);

}

export function UpdateChannel(req: express.Request, res: express.Response): void {

    const channel = TwitchChannel.getChannelByLogin(req.params.login);

    if (!channel || !channel.login) {
        res.status(400).send({
            status: "ERROR",
            message: "Channel not found",
        } as ApiErrorResponse);
        return;
    }

    const formdata: {
        quality: string;
        match: string;
        download_chat: boolean;
        burn_chat: boolean;
        no_capture: boolean;
        live_chat: boolean;
    } = req.body;

    const quality        = formdata.quality ? formdata.quality.split(" ") as VideoQuality[] : [];
    const match          = formdata.match ? formdata.match.split(",").map(m => m.trim()) : [];
    const download_chat  = formdata.download_chat !== undefined;
    const burn_chat      = formdata.burn_chat !== undefined;
    const no_capture     = formdata.no_capture !== undefined;
    const live_chat      = formdata.live_chat !== undefined;

    const channel_config: ChannelConfig = {
        login: channel.login,
        quality: quality,
        match: match,
        download_chat: download_chat,
        burn_chat: burn_chat,
        no_capture: no_capture,
        live_chat: live_chat,
    };

    channel.update(channel_config);

    res.send({
        status: "OK",
    });

}

export function DeleteChannel(req: express.Request, res: express.Response): void {

    const channel = TwitchChannel.getChannelByLogin(req.params.login);

    if (!channel || !channel.login) {

        if (TwitchChannel.channels_config.find(c => c.login === req.params.login)) {
            TwitchChannel.channels_config = TwitchChannel.channels_config.filter(c => c.login !== req.params.login);
            TwitchChannel.saveChannelsConfig();

            res.send({
                status: "OK",
                message: "Channel found in config but not in memory, removed from config",
            });
            TwitchLog.logAdvanced(LOGLEVEL.INFO, "route.channels.delete", `Channel ${req.params.login} found in config but not in memory, removed from config`);
            return;
        }

        res.status(400).send({
            status: "ERROR",
            message: "Channel not found",
        } as ApiErrorResponse);
        return;
    }

    channel.delete();

    TwitchLog.logAdvanced(LOGLEVEL.INFO, "route.channels.delete", `Channel ${req.params.login} deleted`);

    res.send({
        status: "OK",
    });

}

export async function AddChannel(req: express.Request, res: express.Response): Promise<void> {

    const formdata: {
        login: string;
        quality: string;
        match: string;
        download_chat: boolean;
        burn_chat: boolean;
        no_capture: boolean;
        live_chat: boolean;
    } = req.body;

    const channel_config: ChannelConfig = {
        login: formdata.login,
        quality: formdata.quality ? formdata.quality.split(" ") as VideoQuality[] : [],
        match: formdata.match ? formdata.match.split(",").map(m => m.trim()) : [],
        download_chat: formdata.download_chat !== undefined,
        burn_chat: formdata.burn_chat !== undefined,
        no_capture: formdata.no_capture !== undefined,
        live_chat: formdata.live_chat !== undefined,
    };

    if (!channel_config.login) {
        res.status(400).send({
            status: "ERROR",
            message: "Channel login not specified",
        } as ApiErrorResponse);
        return;
    }

    if (channel_config.quality.length === 0) {
        res.status(400).send({
            status: "ERROR",
            message: "No quality selected",
        } as ApiErrorResponse);
        return;
    }

    if (channel_config.quality.some(q => !VideoQualityArray.includes(q))) {
        res.status(400).send({
            status: "ERROR",
            message: "Invalid quality selected",
        } as ApiErrorResponse);
        return;
    }


    const channel = TwitchChannel.getChannelByLogin(channel_config.login);

    if (channel) {
        TwitchLog.logAdvanced(LOGLEVEL.ERROR, "route.channels.add", `Failed to create channel, channel already exists: ${channel_config.login}`);
        res.status(400).send({
            status: "ERROR",
            message: "Channel already exists",
        } as ApiErrorResponse);
        return;
    }

    let new_channel;
    try {
        new_channel = await TwitchChannel.create(channel_config);   
    } catch (error) {
        TwitchLog.logAdvanced(LOGLEVEL.ERROR, "route.channels.add", `Failed to create channel: ${error}`);
        res.status(400).send({
            status: "ERROR",
            message: (error as Error).message,
        } as ApiErrorResponse);
        return;
    }

    TwitchLog.logAdvanced(LOGLEVEL.SUCCESS, "route.channels.add", `Created channel: ${new_channel.login}`);

    res.send({
        data: new_channel,
        status: "OK",
    });

}

export async function DownloadVideo(req: express.Request, res: express.Response): Promise<void> {

    const channel = TwitchChannel.getChannelByLogin(req.params.login);

    if (!channel || !channel.login) {
        res.status(400).send({
            status: "ERROR",
            message: "Channel not found",
        } as ApiErrorResponse);
        return;
    }

    const video_id = req.params.video_id;
    const quality = req.query.quality && VideoQualityArray.includes(req.query.quality as string) ? req.query.quality as VideoQuality : "best";

    if (channel.hasVod(video_id)) {
        res.status(400).send({
            status: "ERROR",
            message: "Video already downloaded",
        } as ApiErrorResponse);
        return;
    }

    const video = await TwitchVOD.getVideo(video_id);
    if (!video){
        res.status(400).send({
            status: "ERROR",
            message: "Video not found",
        } as ApiErrorResponse);
        return;
    }

    const basename = `${channel.login}_${replaceAll(video.created_at, ":", "-")}_${video.stream_id}`;

    const filepath = path.join(TwitchHelper.vodFolder(channel.login), `${basename}.${TwitchConfig.cfg("vod_container", "mp4")}`);

    let status = false;
    
    try {
        status = await TwitchVOD.downloadVideo(video_id, quality, filepath) != "";
    } catch (error) {
        TwitchLog.logAdvanced(LOGLEVEL.ERROR, "route.channels.download", `Failed to download video: ${(error as Error).message}`);
        res.status(400).send({
            status: "ERROR",
            message: (error as Error).message,
        } as ApiErrorResponse);
        return;
    }

    if (status) {
        const vod = await channel.createVOD(path.join(TwitchHelper.vodFolder(channel.login), `${basename}.json`));
        // vod.meta = video;
        // vod.streamer_name = channel.display_name || channel.login;
        // vod.streamer_login = channel.login;
        // vod.streamer_id = channel.userid || "";
        vod.started_at = parse(video.created_at, TwitchHelper.TWITCH_DATE_FORMAT, new Date());

        const duration = TwitchHelper.parseTwitchDuration(video.duration);
        vod.ended_at = new Date(vod.started_at.getTime() + (duration * 1000));
        vod.saveJSON("manual creation");

        vod.addSegment(path.basename(filepath));
        vod.finalize();
        vod.saveJSON("manual finalize");

        TwitchWebhook.dispatch("end_download", {
            vod: vod,
        });

    } else {
        res.status(400).send({
            status: "ERROR",
            message: "Video download failed",
        } as ApiErrorResponse);
        return;
    }

}

export async function SubscribeToChannel(req: express.Request, res: express.Response): Promise<void> {

    const channel_login = req.params.channel;

    const channel = TwitchChannel.getChannelByLogin(channel_login);

    if (!channel || !channel.userid) {
        res.status(400).send({
            status: "ERROR",
            message: `Channel ${channel_login} not found`,
        } as ApiErrorResponse);
        return;
    }

    const sub = await TwitchChannel.subscribe(channel.userid);

    res.send({
        data: {
            login: channel_login,
            status: sub === true ? "Subscription request sent, check logs for details" : "ERROR",
        },
        status: "OK",
    });

}