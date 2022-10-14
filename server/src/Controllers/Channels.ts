import { randomUUID } from "crypto";
import { format, isValid, parseJSON } from "date-fns";
import express from "express";
import fs from "fs";
import path from "path";
import sanitize from "sanitize-filename";
import type { ApiChannelResponse, ApiChannelsResponse, ApiErrorResponse, ApiResponse } from "../../../common/Api/Api";
import { TwitchChannelConfig, VideoQuality, YouTubeChannelConfig } from "../../../common/Config";
import { Providers, VideoQualityArray } from "../../../common/Defs";
import { formatString } from "../../../common/Format";
import { ProxyVideo } from "../../../common/Proxies/Video";
import { VodBasenameTemplate } from "../../../common/Replacements";
import { EventSubStreamOnline } from "../../../common/TwitchAPI/EventSub/StreamOnline";
import { BaseConfigCacheFolder } from "../Core/BaseConfig";
import { Config } from "../Core/Config";
import { KeyValue } from "../Core/KeyValue";
import { LiveStreamDVR } from "../Core/LiveStreamDVR";
import { Log, LOGLEVEL } from "../Core/Log";
import { TwitchAutomator } from "../Core/Providers/Twitch/TwitchAutomator";
import { TwitchChannel } from "../Core/Providers/Twitch/TwitchChannel";
import { TwitchVOD } from "../Core/Providers/Twitch/TwitchVOD";
import { YouTubeAutomator } from "../Core/Providers/YouTube/YouTubeAutomator";
import { YouTubeChannel } from "../Core/Providers/YouTube/YouTubeChannel";
import { YouTubeVOD } from "../Core/Providers/YouTube/YouTubeVOD";
import { Webhook } from "../Core/Webhook";
import { generateStreamerList } from "../Helpers/StreamerList";
import { isTwitchChannel, isYouTubeChannel } from "../Helpers/Types";
import { TwitchHelper } from "../Providers/Twitch";
import { TwitchVODChapterJSON } from "../Storage/JSON";

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

    const channel = LiveStreamDVR.getInstance().getChannelByUUID(req.params.uuid);

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

    const channel = LiveStreamDVR.getInstance().getChannelByUUID(req.params.uuid);

    if (!channel || !channel.internalName) {
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
        max_storage: number;
        max_vods: number;
        download_vod_at_end: boolean;
        download_vod_at_end_quality: VideoQuality;
    } = req.body;

    const quality = formdata.quality ? formdata.quality.split(" ") as VideoQuality[] : [];
    const match = formdata.match ? formdata.match.split(",").map(m => m.trim()) : [];
    const download_chat = formdata.download_chat;
    const burn_chat = formdata.burn_chat;
    const no_capture = formdata.no_capture;
    const live_chat = formdata.live_chat;
    const no_cleanup = formdata.no_cleanup;
    const max_storage = formdata.max_storage;
    const max_vods = formdata.max_vods;
    const download_vod_at_end = formdata.download_vod_at_end;
    const download_vod_at_end_quality = formdata.download_vod_at_end_quality;

    if (channel instanceof TwitchChannel) {
        const channel_config: TwitchChannelConfig = {
            uuid: channel.uuid,
            provider: "twitch",
            login: channel.login || "",
            quality: quality,
            match: match,
            download_chat: download_chat,
            burn_chat: burn_chat,
            no_capture: no_capture,
            live_chat: live_chat,
            no_cleanup: no_cleanup,
            max_storage: max_storage,
            max_vods: max_vods,
            download_vod_at_end: download_vod_at_end,
            download_vod_at_end_quality: download_vod_at_end_quality,
        };
        channel.update(channel_config);
    } else if (channel instanceof YouTubeChannel) {
        const channel_config: YouTubeChannelConfig = {
            uuid: channel.uuid,
            provider: "youtube",
            channel_id: channel.channel_id || "",
            quality: quality,
            match: match,
            download_chat: download_chat,
            burn_chat: burn_chat,
            no_capture: no_capture,
            live_chat: live_chat,
            no_cleanup: no_cleanup,
            max_storage: max_storage,
            max_vods: max_vods,
            download_vod_at_end: download_vod_at_end,
            download_vod_at_end_quality: download_vod_at_end_quality,
        };
        channel.update(channel_config);
    }

    channel.broadcastUpdate();

    res.send({
        status: "OK",
        message: `Channel '${channel.internalName}' updated`,
    });

}

export async function DeleteChannel(req: express.Request, res: express.Response): Promise<void> {

    const channel = LiveStreamDVR.getInstance().getChannelByUUID(req.params.uuid);

    if (!channel || !channel.internalName) {

        if (LiveStreamDVR.getInstance().channels_config.find(c => c instanceof TwitchChannel && c.uuid === req.params.uuid)) {
            LiveStreamDVR.getInstance().channels_config = LiveStreamDVR.getInstance().channels_config.filter(c => c instanceof TwitchChannel && c.uuid !== req.params.uuid);
            LiveStreamDVR.getInstance().saveChannelsConfig();

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

    if (req.query.deletevods == "1" && channel.vods_list.length > 0) {
        try {
            await channel.deleteAllVods();
        } catch (error) {
            Log.logAdvanced(LOGLEVEL.ERROR, "route.channels.deleteAllVods", `Failed to delete all VODs of channel: ${(error as Error).message}`);
            res.status(400).send({
                status: "ERROR",
                message: (error as Error).message,
            } as ApiErrorResponse);
            return;
        }
    }

    const name = channel.internalName;

    channel.delete();

    Log.logAdvanced(LOGLEVEL.INFO, "route.channels.delete", `Channel ${name} deleted`);

    res.send({
        status: "OK",
        message: `Channel '${channel.internalName}' deleted`,
    });

}

export async function AddChannel(req: express.Request, res: express.Response): Promise<void> {

    const provider = req.body.provider as Providers;

    if (!provider) {
        res.status(400).send({
            status: "ERROR",
            message: "No provider",
        } as ApiErrorResponse);
        return;
    }

    const formdata: {
        login?: string;
        channel_id?: string;
        quality: string;
        match: string;
        download_chat: boolean;
        burn_chat: boolean;
        no_capture: boolean;
        live_chat: boolean;
        no_cleanup: boolean;
        max_storage: number;
        max_vods: number;
        download_vod_at_end: boolean;
        download_vod_at_end_quality: VideoQuality;
    } = req.body;

    let new_channel;

    if (provider == "twitch") {

        const channel_config: TwitchChannelConfig = {
            uuid: "",
            provider: "twitch",
            login: formdata.login || "",
            quality: formdata.quality ? formdata.quality.split(" ") as VideoQuality[] : [],
            match: formdata.match ? formdata.match.split(",").map(m => m.trim()) : [],
            download_chat: formdata.download_chat,
            burn_chat: formdata.burn_chat,
            no_capture: formdata.no_capture,
            live_chat: formdata.live_chat,
            no_cleanup: formdata.no_cleanup,
            max_storage: formdata.max_storage,
            max_vods: formdata.max_vods,
            download_vod_at_end: formdata.download_vod_at_end,
            download_vod_at_end_quality: formdata.download_vod_at_end_quality,
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
            api_channel_data = await TwitchChannel.getUserDataByLogin(channel_config.login);
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

        Log.logAdvanced(LOGLEVEL.SUCCESS, "route.channels.add", `Created channel: ${new_channel.internalName}`);

    } else if (provider == "youtube") {

        const channel_config: YouTubeChannelConfig = {
            uuid: "",
            provider: "youtube",
            channel_id: formdata.channel_id || "",
            quality: formdata.quality ? formdata.quality.split(" ") as VideoQuality[] : [],
            match: formdata.match ? formdata.match.split(",").map(m => m.trim()) : [],
            download_chat: formdata.download_chat,
            burn_chat: formdata.burn_chat,
            no_capture: formdata.no_capture,
            live_chat: formdata.live_chat,
            no_cleanup: formdata.no_cleanup,
            max_storage: formdata.max_storage,
            max_vods: formdata.max_vods,
            download_vod_at_end: formdata.download_vod_at_end,
            download_vod_at_end_quality: formdata.download_vod_at_end_quality,
        };

        if (!channel_config.channel_id) {
            res.status(400).send({
                status: "ERROR",
                message: "Channel ID not specified",
            } as ApiErrorResponse);
            return;
        }

        const channel = YouTubeChannel.getChannelById(channel_config.channel_id);
        if (channel) {
            Log.logAdvanced(LOGLEVEL.ERROR, "route.channels.add", `Failed to create channel, channel already exists: ${channel_config.channel_id}`);
            res.status(400).send({
                status: "ERROR",
                message: "Channel already exists",
            } as ApiErrorResponse);
            return;
        }

        let api_channel_data;

        try {
            api_channel_data = await YouTubeChannel.getUserDataById(channel_config.channel_id);
        } catch (error) {
            Log.logAdvanced(LOGLEVEL.ERROR, "route.channels.add", `Failed to create channel, API error: ${(error as Error).message}`);
            res.status(400).send({
                status: "ERROR",
                message: `API error: ${(error as Error).message}`,
            } as ApiErrorResponse);
            return;
        }

        /*
        if (api_channel_data && api_channel_data.login !== channel_config.login) {
            res.status(400).send({
                status: "ERROR",
                message: "Channel login does not match data fetched from API",
            } as ApiErrorResponse);
            return;
        }
        */

        try {
            new_channel = await YouTubeChannel.create(channel_config);
        } catch (error) {
            Log.logAdvanced(LOGLEVEL.ERROR, "route.channels.add", `Failed to create channel: ${error}`);
            res.status(400).send({
                status: "ERROR",
                message: (error as Error).message,
            } as ApiErrorResponse);
            return;
        }

        Log.logAdvanced(LOGLEVEL.SUCCESS, "route.channels.add", `Created channel: ${new_channel.displayName}`);

    }

    if (!new_channel) {
        res.status(400).send({
            status: "ERROR",
            message: "No channel created",
        } as ApiErrorResponse);
        return;
    }

    res.send({
        data: await new_channel.toAPI(),
        status: "OK",
        message: `Channel '${new_channel.displayName}' created`,
    });

    new_channel.broadcastUpdate();

}

export async function DownloadVideo(req: express.Request, res: express.Response): Promise<void> {

    const channel = LiveStreamDVR.getInstance().getChannelByUUID(req.params.uuid);

    if (!channel || !channel.internalName) {
        res.status(400).send({
            status: "ERROR",
            message: "Channel not found",
        } as ApiErrorResponse);
        return;
    }

    const video_id = req.params.video_id;
    const quality = req.query.quality && VideoQualityArray.includes(req.query.quality as string) ? req.query.quality as VideoQuality : "best";

    const template = (video: ProxyVideo, what: string) => {
        if (!video) return "";

        const date = parseJSON(video.created_at);

        if (!date || !isValid(date)) {
            Log.logAdvanced(LOGLEVEL.ERROR, "route.channels.download", `Invalid start date: ${video.created_at}`);
        }

        const variables: VodBasenameTemplate = {
            login: channel.internalName || "",
            internalName: channel.internalName,
            displayName: channel.displayName,
            date: video.created_at?.replaceAll(":", "_"),
            year: isValid(date) ? format(date, "yyyy") : "",
            year_short: isValid(date) ? format(date, "yy") : "",
            month: isValid(date) ? format(date, "MM") : "",
            day: isValid(date) ? format(date, "dd") : "",
            hour: isValid(date) ? format(date, "HH") : "",
            minute: isValid(date) ? format(date, "mm") : "",
            second: isValid(date) ? format(date, "ss") : "",
            id: video.stream_id?.toString() || randomUUID(), // bad solution
            season: channel.current_season,
            absolute_season: channel.current_absolute_season ? channel.current_absolute_season.toString().padStart(2, "0") : "",
            // episode: this.vod_episode ? this.vod_episode.toString().padStart(2, "0") : "",
            episode: "0", // episode won't work with random downloads
        };

        return sanitize(formatString(Config.getInstance().cfg(what), variables));
    };

    if (isTwitchChannel(channel)) {

        if (TwitchVOD.getVodByProviderId(video_id)) {
            res.status(400).send({
                status: "ERROR",
                message: "Video already downloaded",
            } as ApiErrorResponse);
            return;
        }

        let video: ProxyVideo | false;
        try {
            video = await TwitchVOD.getVideoProxy(video_id);
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

        // const basename = `${channel.login}_${replaceAll(video.created_at, ":", "-")}_${video.stream_id}`;



        /*

        const variables: VodBasenameTemplate = {
            login: channel.login,
            date: video.created_at.replaceAll(":", "_"),
            year: isValid(date) ? format(date, "yyyy") : "",
            year_short: isValid(date) ? format(date, "yy") : "",
            month: isValid(date) ? format(date, "MM") : "",
            day: isValid(date) ? format(date, "dd") : "",
            hour: isValid(date) ? format(date, "HH") : "",
            minute: isValid(date) ? format(date, "mm") : "",
            second: isValid(date) ? format(date, "ss") : "",
            id: video.stream_id?.toString() || randomUUID(), // bad solution
            season: channel.current_season,
            absolute_season: channel.current_absolute_season ? channel.current_absolute_season.toString().padStart(2, "0") : "",
            // episode: this.vod_episode ? this.vod_episode.toString().padStart(2, "0") : "",
            episode: "0", // episode won't work with random downloads
        };

        const basename = sanitize(formatString(Config.getInstance().cfg("filename_vod"), variables));
        const basefolder = "";
        */

        const basename = template(video, "filename_vod");
        const basefolder = path.join(channel.getFolder(), template(video, "filename_vod_folder"));

        const filepath = path.join(basefolder, `${basename}.${Config.getInstance().cfg("vod_container", "mp4")}`);

        if (TwitchVOD.hasVod(basename)) {
            res.status(400).send({
                status: "ERROR",
                message: `VOD already exists: ${basename}`,
            } as ApiErrorResponse);
            return;
        }

        if (!fs.existsSync(path.dirname(filepath))) {
            fs.mkdirSync(path.dirname(filepath), { recursive: true });
        }

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

            let vod;

            try {
                vod = await channel.createVOD(path.join(basefolder, `${basename}.json`));
            } catch (error) {
                res.status(400).send({
                    status: "ERROR",
                    message: (error as Error).message,
                } as ApiErrorResponse);
                return;
            }

            // vod.meta = video;
            // vod.streamer_name = channel.display_name || channel.login;
            // vod.streamer_login = channel.login;
            // vod.streamer_id = channel.userid || "";
            vod.started_at = parseJSON(video.created_at);

            // const duration = TwitchHelper.parseTwitchDuration(video.duration);
            vod.ended_at = new Date(vod.started_at.getTime() + (video.duration * 1000));
            await vod.saveJSON("manual creation");

            vod.addSegment(path.basename(filepath));
            await vod.finalize();
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

    } else if (isYouTubeChannel(channel)) {

        if (YouTubeVOD.getVodByProviderId(video_id)) {
            res.status(400).send({
                status: "ERROR",
                message: "Video already downloaded",
            } as ApiErrorResponse);
            return;
        }

        let video: ProxyVideo | false;
        try {
            video = await YouTubeVOD.getVideoProxy(video_id);
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

        console.debug("video", video);

        const basename = template(video, "filename_vod");
        const basefolder = path.join(channel.getFolder(), template(video, "filename_vod_folder"));

        const filepath = path.join(basefolder, `${basename}.${Config.getInstance().cfg("vod_container", "mp4")}`);

        if (YouTubeVOD.hasVod(basename)) {
            res.status(400).send({
                status: "ERROR",
                message: `VOD already exists: ${basename}`,
            } as ApiErrorResponse);
            return;
        }

        if (!fs.existsSync(path.dirname(filepath))) {
            fs.mkdirSync(path.dirname(filepath), { recursive: true });
        }

        let status = false;

        try {
            status = await YouTubeVOD.downloadVideo(video_id, quality, filepath) != "";
        } catch (error) {
            Log.logAdvanced(LOGLEVEL.ERROR, "route.channels.download", `Failed to download video: ${(error as Error).message}`);
            res.status(400).send({
                status: "ERROR",
                message: (error as Error).message,
            } as ApiErrorResponse);
            return;
        }

        if (status) {

            let vod;

            try {
                vod = await channel.createVOD(path.join(basefolder, `${basename}.json`));
            } catch (error) {
                res.status(400).send({
                    status: "ERROR",
                    message: (error as Error).message,
                } as ApiErrorResponse);
                return;
            }

            // vod.meta = video;
            // vod.streamer_name = channel.display_name || channel.login;
            // vod.streamer_login = channel.login;
            // vod.streamer_id = channel.userid || "";
            vod.started_at = parseJSON(video.created_at);

            // const duration = TwitchHelper.parseTwitchDuration(video.duration);
            vod.ended_at = new Date(vod.started_at.getTime() + (video.duration * 1000));
            await vod.saveJSON("manual creation");

            vod.addSegment(path.basename(filepath));
            await vod.finalize();
            await vod.saveJSON("manual finalize");

            if (!vod.channel_uuid) {
                Log.logAdvanced(LOGLEVEL.FATAL, "route.channels.download", `Channel UUID is empty for VOD ${vod.uuid}`);
                res.status(500).send({
                    status: "ERROR",
                    message: "Channel UUID is empty",
                } as ApiErrorResponse);
                return;
            }

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

    } else {
        res.status(400).send({
            status: "ERROR",
            message: "Channel is not supported",
        } as ApiErrorResponse);
        return;
    }

}

export async function SubscribeToChannel(req: express.Request, res: express.Response): Promise<void> {

    const channel = LiveStreamDVR.getInstance().getChannelByUUID(req.params.uuid);

    if (!channel || !(channel instanceof TwitchChannel) || !channel.userid) {
        res.status(400).send({
            status: "ERROR",
            message: `Channel ${req.params.uuid} not found`,
        } as ApiErrorResponse);
        return;
    }

    const sub = await channel.subscribe(true);

    res.send({
        data: {
            login: channel.login,
            status: sub === true ? "Subscription request sent, check logs for details" : "ERROR",
        },
        status: "OK",
    });

}

export async function CheckSubscriptions(req: express.Request, res: express.Response): Promise<void> {

    const channel = LiveStreamDVR.getInstance().getChannelByUUID(req.params.uuid);

    if (!channel || !(channel instanceof TwitchChannel) || !channel.userid) {
        res.status(400).send({
            status: "ERROR",
            message: `Channel ${req.params.uuid} not found`,
        } as ApiErrorResponse);
        return;
    }

    const all_subs = await TwitchHelper.getSubsList();

    if (!all_subs) {
        res.status(400).send({
            status: "ERROR",
            message: `No subscriptions for ${channel.internalName}`,
        } as ApiErrorResponse);
        return;
    }

    const channel_subs = all_subs.filter(sub => sub.condition.broadcaster_user_id == channel.internalId);

    res.send({
        data: {
            raw: channel_subs,
        },
        message: channel_subs.map(sub => `${sub.type}: ${sub.status}`).join("\n"),
        status: "OK",
    });

}

export async function CleanupChannelVods(req: express.Request, res: express.Response): Promise<void> {

    const channel = LiveStreamDVR.getInstance().getChannelByUUID(req.params.uuid);

    if (!channel || !channel.internalName) {
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

    const channel = LiveStreamDVR.getInstance().getChannelByUUID(req.params.uuid);

    if (!channel || !channel.internalName) {
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

    let isLive = false;
    try {
        isLive = await channel.isLiveApi();
    } catch (error) {
        Log.logAdvanced(LOGLEVEL.ERROR, "route.channels.refresh", `Could not get live status for ${channel.internalName}`);
    }

    if (!isLive) {
        KeyValue.getInstance().delete(`${channel.internalName}.online`);
        KeyValue.getInstance().delete(`${channel.internalName}.vod.id`);
        KeyValue.getInstance().delete(`${channel.internalName}.vod.started_at`);
    }

    if (success) {
        Log.logAdvanced(LOGLEVEL.SUCCESS, "route.channels.refresh", `Refreshed channel: ${channel.internalName}`);
        res.send({
            status: "OK",
            message: `Refreshed channel: ${channel.internalName}`,
        });
        channel.broadcastUpdate();
    } else {
        Log.logAdvanced(LOGLEVEL.ERROR, "route.channels.refresh", `Failed to refresh channel: ${channel.internalName}`);
        res.status(400).send({
            status: "ERROR",
            message: "Failed to refresh channel",
        } as ApiErrorResponse);
    }

}

export async function ForceRecord(req: express.Request, res: express.Response): Promise<void> {

    const channel = LiveStreamDVR.getInstance().getChannelByUUID(req.params.uuid);

    if (!channel || !channel.internalId) {
        res.status(400).send({
            status: "ERROR",
            message: "Channel not found",
        } as ApiErrorResponse);
        return;
    }

    if (isTwitchChannel(channel)) {

        const streams = await TwitchChannel.getStreams(channel.internalId);

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

                const TA = new TwitchAutomator();
                TA.handle(mock_data, req);

                res.send({
                    status: "OK",
                    message: `Forced recording of channel: ${channel.internalName}`,
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

    } else if (isYouTubeChannel(channel)) {

        const streams = await channel.getStreams();

        if (streams) {

            const YA = new YouTubeAutomator();
            YA.broadcaster_user_id = channel.internalId;
            YA.broadcaster_user_name = channel.displayName;
            YA.broadcaster_user_login = channel.internalName;
            YA.channel = channel;
            // YA.handle(mock_data, req);

            KeyValue.getInstance().set(`yt.${YA.getUserID()}.vod.started_at`, streams.snippet?.publishedAt || new Date().toISOString());
            KeyValue.getInstance().set(`yt.${YA.getUserID()}.vod.id`, streams.id?.videoId || "fake");

            YA.download();

            res.send({
                status: "OK",
                message: `Forced recording of channel: ${channel.internalName}`,
            });

        } else {

            res.status(400).send({
                status: "ERROR",
                message: "No streams found",
            } as ApiErrorResponse);

        }

        return;

    }

}

export async function RenameChannel(req: express.Request, res: express.Response): Promise<void> {

    const channel = LiveStreamDVR.getInstance().getChannelByUUID(req.params.uuid);

    if (!channel || !channel.internalName) {
        res.status(400).send({
            status: "ERROR",
            message: "Channel not found",
        } as ApiErrorResponse);
        return;
    }

    const success = await channel.rename(req.body.new_login);

    if (success) {
        Log.logAdvanced(LOGLEVEL.SUCCESS, "route.channels.rename", `Renamed channel: ${channel.internalName} to ${req.body.new_login}`);
        res.send({
            status: "OK",
            message: `Renamed channel: ${channel.internalName} to ${req.body.new_login}`,
        });
        channel.broadcastUpdate();
    } else {
        Log.logAdvanced(LOGLEVEL.ERROR, "route.channels.rename", `Failed to rename channel: ${channel.internalName} to ${req.body.new_login}`);
        res.status(400).send({
            status: "ERROR",
            message: "Failed to rename channel",
        } as ApiErrorResponse);
    }

}

export async function DeleteAllChannelVods(req: express.Request, res: express.Response): Promise<void> {

    const channel = LiveStreamDVR.getInstance().getChannelByUUID(req.params.uuid);

    if (!channel || !channel.internalName) {
        res.status(400).send({
            status: "ERROR",
            message: "Channel not found",
        } as ApiErrorResponse);
        return;
    }

    let success;

    try {
        success = await channel.deleteAllVods();
    } catch (error) {
        Log.logAdvanced(LOGLEVEL.ERROR, "route.channels.deleteAllVods", `Failed to delete all VODs of channel: ${(error as Error).message}`);
        res.status(400).send({
            status: "ERROR",
            message: (error as Error).message,
        } as ApiErrorResponse);
        return;
    }

    if (success) {
        Log.logAdvanced(LOGLEVEL.SUCCESS, "route.channels.deleteallvods", `Deleted all VODs of channel: ${channel.internalName}`);
        res.send({
            status: "OK",
            message: `Deleted all VODs of channel: ${channel.internalName}`,
        });
        channel.broadcastUpdate();
    } else {
        Log.logAdvanced(LOGLEVEL.ERROR, "route.channels.deleteallvods", `Failed to delete all VODs of channel: ${channel.internalName}`);
        res.status(400).send({
            status: "ERROR",
            message: "Failed to delete all VODs",
        } as ApiErrorResponse);
    }

}

interface StreamEvent {
    time: string;
    action: string;
}

type HistoryEntry = TwitchVODChapterJSON | StreamEvent;

export function GetHistory(req: express.Request, res: express.Response): void {

    const channel = LiveStreamDVR.getInstance().getChannelByUUID(req.params.uuid);

    if (!channel || !channel.internalName) {
        res.status(400).send({
            status: "ERROR",
            message: "Channel not found",
        } as ApiErrorResponse);
        return;
    }

    const history: HistoryEntry[] = [];

    const file = path.join(BaseConfigCacheFolder.history, `${channel.internalName}.jsonline`);
    if (!fs.existsSync(file)) {
        res.status(400).send({
            status: "ERROR",
            message: "No history found",
        } as ApiErrorResponse);
        return;
    }

    const lines = fs.readFileSync(file, "utf8").split("\n");
    for (const line of lines) {
        if (line.length > 0) {
            const chapter = JSON.parse(line) as HistoryEntry;
            history.push(chapter);
        }
    }

    res.send({
        status: "OK",
        // message: "History found",
        data: history,
    } as ApiResponse);

    return;

}

export async function ScanVods(req: express.Request, res: express.Response): Promise<void> {

    const channel = LiveStreamDVR.getInstance().getChannelByUUID(req.params.uuid);

    if (!channel || !channel.internalName) {
        res.status(400).send({
            status: "ERROR",
            message: "Channel not found",
        } as ApiErrorResponse);
        return;
    }

    if (channel.is_capturing || channel.is_converting) {
        res.status(400).send({
            status: "ERROR",
            message: "Channel is currently capturing. Please stop the capture first or wait until it is finished.",
        } as ApiErrorResponse);
        return;
    }

    // channel.vods_raw = channel.rescanVods();
    // Log.logAdvanced(LOGLEVEL.INFO, "channel", `Found ${channel.vods_raw.length} VODs from recursive file search for ${channel.login}`);
    // fs.writeFileSync(path.join(BaseConfigDataFolder.vods_db, `${channel.login}.json`), JSON.stringify(channel.vods_raw));
    // channel.broadcastUpdate();
    // console.log("vod amount sanity check 1", TwitchVOD.vods.length);
    channel.clearVODs();
    // console.log("vod amount sanity check 2", TwitchVOD.vods.length);
    await channel.parseVODs(true);
    // console.log("vod amount sanity check 3", TwitchVOD.vods.length);

    if (isTwitchChannel(channel)) {
        channel.video_list = [];
        channel.addAllLocalVideos();
    }

    channel.broadcastUpdate();

    res.send({
        status: "OK",
        message: `Channel '${channel.internalName}' scanned, found ${channel.vods_raw.length} VODs.`,
    });

}