import express from "express";
import { generateStreamerList } from "../Helpers/StreamerList";
import { TwitchChannel } from "../Core/TwitchChannel";
import { ChannelConfig, VideoQuality } from "../../../common/Config";
import type { ApiChannelResponse, ApiChannelsResponse, ApiErrorResponse } from "../../../common/Api/Api";
import { VideoQualityArray } from "../../../common/Defs";
import { LOGLEVEL, Log } from "../Core/Log";
import { TwitchVOD } from "../Core/TwitchVOD";
import { replaceAll } from "../Helpers/ReplaceAll";
import { Helper } from "../Core/Helper";
import { Config } from "../Core/Config";
import path from "path";
import { parseJSON } from "date-fns";
import { Webhook } from "../Core/Webhook";
import { EventSubStreamOnline } from "../../../common/TwitchAPI/EventSub/StreamOnline";
import { Automator } from "../Core/Automator";
import { TwitchVODChapterJSON } from "../Storage/JSON";
import { KeyValue } from "../Core/KeyValue";

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
        no_cleanup: boolean;
    } = req.body;

    const quality = formdata.quality ? formdata.quality.split(" ") as VideoQuality[] : [];
    const match = formdata.match ? formdata.match.split(",").map(m => m.trim()) : [];
    const download_chat = formdata.download_chat;
    const burn_chat = formdata.burn_chat;
    const no_capture = formdata.no_capture;
    const live_chat = formdata.live_chat;
    const no_cleanup = formdata.no_cleanup;

    const channel_config: ChannelConfig = {
        login: channel.login,
        quality: quality,
        match: match,
        download_chat: download_chat,
        burn_chat: burn_chat,
        no_capture: no_capture,
        live_chat: live_chat,
        no_cleanup: no_cleanup,
    };

    channel.update(channel_config);

    channel.broadcastUpdate();

    res.send({
        status: "OK",
        message: `Channel '${channel.login}' updated`,
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
            Log.logAdvanced(LOGLEVEL.INFO, "route.channels.delete", `Channel ${req.params.login} found in config but not in memory, removed from config`);
            return;
        }

        res.status(400).send({
            status: "ERROR",
            message: "Channel not found",
        } as ApiErrorResponse);
        return;
    }

    channel.delete();

    Log.logAdvanced(LOGLEVEL.INFO, "route.channels.delete", `Channel ${req.params.login} deleted`);

    res.send({
        status: "OK",
        message: `Channel '${channel.login}' deleted`,
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
        no_cleanup: boolean;
    } = req.body;

    const channel_config: ChannelConfig = {
        login: formdata.login,
        quality: formdata.quality ? formdata.quality.split(" ") as VideoQuality[] : [],
        match: formdata.match ? formdata.match.split(",").map(m => m.trim()) : [],
        download_chat: formdata.download_chat,
        burn_chat: formdata.burn_chat,
        no_capture: formdata.no_capture,
        live_chat: formdata.live_chat,
        no_cleanup: formdata.no_cleanup,
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
        Log.logAdvanced(LOGLEVEL.ERROR, "route.channels.add", `Failed to create channel, channel already exists: ${channel_config.login}`);
        res.status(400).send({
            status: "ERROR",
            message: "Channel already exists",
        } as ApiErrorResponse);
        return;
    }

    let api_channel_data;

    try {
        api_channel_data = await TwitchChannel.getChannelDataByLogin(channel_config.login);
    } catch (error) {
        Log.logAdvanced(LOGLEVEL.ERROR, "route.channels.add", `Failed to create channel, API error: ${(error as Error).message}`);
        res.status(400).send({
            status: "ERROR",
            message: `API error: ${(error as Error).message}`,
        } as ApiErrorResponse);
        return;
    }

    if (api_channel_data && api_channel_data.login !== channel_config.login) {
        res.status(400).send({
            status: "ERROR",
            message: "Channel login does not match data fetched from API",
        } as ApiErrorResponse);
        return;
    }

    let new_channel;
    try {
        new_channel = await TwitchChannel.create(channel_config);
    } catch (error) {
        Log.logAdvanced(LOGLEVEL.ERROR, "route.channels.add", `Failed to create channel: ${error}`);
        res.status(400).send({
            status: "ERROR",
            message: (error as Error).message,
        } as ApiErrorResponse);
        return;
    }

    Log.logAdvanced(LOGLEVEL.SUCCESS, "route.channels.add", `Created channel: ${new_channel.login}`);

    res.send({
        data: new_channel,
        status: "OK",
        message: `Channel '${new_channel.login}' created`,
    });

    new_channel.broadcastUpdate();

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

    const basename = `${channel.login}_${replaceAll(video.created_at, ":", "-")}_${video.stream_id}`;

    const filepath = path.join(Helper.vodFolder(channel.login), `${basename}.${Config.getInstance().cfg("vod_container", "mp4")}`);

    let status = false;

    try {
        status = await TwitchVOD.downloadVideo(video_id, quality, filepath) != "";
    } catch (error) {
        Log.logAdvanced(LOGLEVEL.ERROR, "route.channels.download", `Failed to download video: ${(error as Error).message}`);
        res.status(400).send({
            status: "ERROR",
            message: (error as Error).message,
        } as ApiErrorResponse);
        return;
    }

    if (status) {
        const vod = await channel.createVOD(path.join(Helper.vodFolder(channel.login), `${basename}.json`));
        // vod.meta = video;
        // vod.streamer_name = channel.display_name || channel.login;
        // vod.streamer_login = channel.login;
        // vod.streamer_id = channel.userid || "";
        vod.started_at = parseJSON(video.created_at);

        const duration = Helper.parseTwitchDuration(video.duration);
        vod.ended_at = new Date(vod.started_at.getTime() + (duration * 1000));
        await vod.saveJSON("manual creation");

        vod.addSegment(path.basename(filepath));
        vod.finalize();
        await vod.saveJSON("manual finalize");

        Webhook.dispatch("end_download", {
            vod: await vod.toAPI(),
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

    const channel_login = req.params.login;

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

export async function CleanupChannelVods(req: express.Request, res: express.Response): Promise<void> {

    const channel = TwitchChannel.getChannelByLogin(req.params.login);

    if (!channel || !channel.login) {
        res.status(400).send({
            status: "ERROR",
            message: "Channel not found",
        } as ApiErrorResponse);
        return;
    }

    const deleted = await channel.cleanupVods();

    res.send({
        status: "OK",
        message: `Deleted ${deleted ? deleted : "no"} ${deleted === 1 ? "VOD" : "VODs"}`,
    });

}

export async function RefreshChannel(req: express.Request, res: express.Response): Promise<void> {

    const channel = TwitchChannel.getChannelByLogin(req.params.login);

    if (!channel || !channel.login) {
        res.status(400).send({
            status: "ERROR",
            message: "Channel not found",
        } as ApiErrorResponse);
        return;
    }

    let success;
    try {
        success = await channel.refreshData();
    } catch (error) {
        Log.logAdvanced(LOGLEVEL.ERROR, "route.channels.refresh", `Failed to refresh channel: ${(error as Error).message}`);
        res.status(400).send({
            status: "ERROR",
            message: (error as Error).message,
        } as ApiErrorResponse);
        return;
    }

    if (success) {
        Log.logAdvanced(LOGLEVEL.SUCCESS, "route.channels.refresh", `Refreshed channel: ${channel.login}`);
        res.send({
            status: "OK",
            message: `Refreshed channel: ${channel.login}`,
        });
        channel.broadcastUpdate();
    } else {
        Log.logAdvanced(LOGLEVEL.ERROR, "route.channels.refresh", `Failed to refresh channel: ${channel.login}`);
        res.status(400).send({
            status: "ERROR",
            message: "Failed to refresh channel",
        } as ApiErrorResponse);
    }

}

export async function ForceRecord(req: express.Request, res: express.Response): Promise<void> {

    const channel = TwitchChannel.getChannelByLogin(req.params.login);

    if (!channel || !channel.userid) {
        res.status(400).send({
            status: "ERROR",
            message: "Channel not found",
        } as ApiErrorResponse);
        return;
    }

    const streams = await TwitchChannel.getStreams(channel.userid);

    if (streams) {
        const stream = streams.find((s) => s.type === "live");
        if (stream) {
            const mock_data: EventSubStreamOnline = {
                "subscription": {
                    "id": "fake",
                    "type": "stream.online",
                    "condition": {
                        "broadcaster_user_id": stream.user_id,
                    },
                    "version": "1",
                    "status": "enabled",
                    "created_at": new Date().toISOString(),
                    "cost": 0,
                    "transport": {
                        "method": "webhook",
                        "callback": "https://example.com/webhook",
                    },
                },
                "event": {
                    "type": "live",
                    "id": stream.id,
                    "broadcaster_user_id": stream.user_id,
                    "broadcaster_user_login": stream.user_login,
                    "broadcaster_user_name": stream.user_name,
                    // "title": stream.title,
                    // "category_id": stream.game_id,
                    // "category_name": stream.game_name,
                    "started_at": stream.started_at,
                    // "is_mature": stream.is_mature,
                },
            };

            req.headers["twitch-eventsub-message-id"] = "fake";
            req.headers["twitch-eventsub-signature"] = "fake";
            req.headers["twitch-eventsub-message-retry"] = "0";

            const chapter_data = {
                started_at: JSON.stringify(parseJSON(stream.started_at)),
                game_id: stream.game_id,
                game_name: stream.game_name,
                viewer_count: stream.viewer_count,
                title: stream.title,
                is_mature: stream.is_mature,
                online: true,
            } as TwitchVODChapterJSON;
            KeyValue.getInstance().setObject(`${stream.user_login}.chapterdata`, chapter_data);

            const TA = new Automator();
            TA.handle(mock_data, req);

            res.send({
                status: "OK",
                message: `Forced recording of channel: ${channel.login}`,
            });

            return;

        } else {
            res.status(400).send({
                status: "ERROR",
                message: "No live stream found",
            } as ApiErrorResponse);
            return;
        }

    } else {
        res.status(400).send({
            status: "ERROR",
            message: "No streams found",
        } as ApiErrorResponse);
        return;
    }

}

export async function RenameChannel(req: express.Request, res: express.Response): Promise<void> {

    const channel = TwitchChannel.getChannelByLogin(req.params.login);

    if (!channel || !channel.userid) {
        res.status(400).send({
            status: "ERROR",
            message: "Channel not found",
        } as ApiErrorResponse);
        return;
    }

    const success = await channel.rename(req.body.new_login);

    if (success) {
        Log.logAdvanced(LOGLEVEL.SUCCESS, "route.channels.rename", `Renamed channel: ${channel.login} to ${req.body.new_login}`);
        res.send({
            status: "OK",
            message: `Renamed channel: ${channel.login} to ${req.body.new_login}`,
        });
        channel.broadcastUpdate();
    } else {
        Log.logAdvanced(LOGLEVEL.ERROR, "route.channels.rename", `Failed to rename channel: ${channel.login} to ${req.body.new_login}`);
        res.status(400).send({
            status: "ERROR",
            message: "Failed to rename channel",
        } as ApiErrorResponse);
    }

}