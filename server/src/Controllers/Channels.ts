import { BaseConfigCacheFolder } from "@/Core/BaseConfig";
import { Config } from "@/Core/Config";
import { KeyValue } from "@/Core/KeyValue";
import { LiveStreamDVR } from "@/Core/LiveStreamDVR";
import { LOGLEVEL, log } from "@/Core/Log";
import { BaseChannel } from "@/Core/Providers/Base/BaseChannel";
import { KickChannel } from "@/Core/Providers/Kick/KickChannel";
import type { AutomatorMetadata } from "@/Core/Providers/Twitch/TwitchAutomator";
import { TwitchAutomator } from "@/Core/Providers/Twitch/TwitchAutomator";
import { TwitchChannel } from "@/Core/Providers/Twitch/TwitchChannel";
import { TwitchVOD } from "@/Core/Providers/Twitch/TwitchVOD";
import { YouTubeAutomator } from "@/Core/Providers/YouTube/YouTubeAutomator";
import { YouTubeChannel } from "@/Core/Providers/YouTube/YouTubeChannel";
import { YouTubeVOD } from "@/Core/Providers/YouTube/YouTubeVOD";
import { Webhook } from "@/Core/Webhook";
import { debugLog } from "@/Helpers/Console";
import {
    sanitizePath,
    validateAbsolutePath,
    validateFilename,
    validateRelativePath,
} from "@/Helpers/Filesystem";
import { generateStreamerList } from "@/Helpers/StreamerList";
import { isError, isTwitchChannel, isYouTubeChannel } from "@/Helpers/Types";
import type {
    ApiChannelResponse,
    ApiChannelsResponse,
    ApiErrorResponse,
    ApiGenericResponse,
    ApiResponse,
} from "@common/Api/Api";
import type {
    KickChannelConfig,
    TwitchChannelConfig,
    VideoQuality,
    YouTubeChannelConfig,
} from "@common/Config";
import type { Providers } from "@common/Defs";
import { VideoQualityArray } from "@common/Defs";
import { formatString } from "@common/Format";
import type { ProxyVideo } from "@common/Proxies/Video";
import type { VodBasenameTemplate } from "@common/Replacements";
import type { EventSubStreamOnline } from "@common/TwitchAPI/EventSub/StreamOnline";
import { addSeconds, format, isValid, parseJSON } from "date-fns";
import type express from "express";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { TwitchHelper } from "../Providers/Twitch";
import type { TwitchVODChapterJSON } from "../Storage/JSON";

export async function ListChannels(
    req: express.Request,
    res: express.Response
): Promise<void> {
    const { channels, total_size } = generateStreamerList();

    const streamer_list = await Promise.all(
        channels.map(async (c) => await c.toAPI())
    );

    res.api<ApiChannelsResponse>(200, {
        data: {
            streamer_list: streamer_list,
            total_size: total_size,
            // free_size: fs.statSync(TwitchHelper.vodFolder()).size,
            free_size: LiveStreamDVR.getInstance().freeStorageDiskSpace, // broken until further notice
        },
        status: "OK",
    });
}

const getChannelFromRequest = (
    req: express.Request
): TwitchChannel | YouTubeChannel | KickChannel | undefined => {
    if (req.params.uuid) {
        return (
            LiveStreamDVR.getInstance().getChannelByUUID(req.params.uuid) ||
            undefined
        );
    }

    if (req.params.name) {
        return (
            LiveStreamDVR.getInstance().getChannelByInternalName(
                req.params.internalname
            ) || undefined
        );
    }

    return undefined;
};

export async function GetChannel(
    req: express.Request,
    res: express.Response
): Promise<void> {
    const channel = getChannelFromRequest(req);

    if (!channel) {
        res.api<ApiErrorResponse>(400, {
            status: "ERROR",
            message: req.t("route.channels.channel-not-found"),
        });
        return;
    }

    /*
    if (isBaseChannel(channel)) {
        res.api<ApiErrorResponse>(400, {
            status: "ERROR",
            message: "Channel is not supported",
        });
        return;
    }
    */

    res.api<ApiChannelResponse>(200, {
        data: (await channel.toAPI()) as any, // screw typescript
        status: "OK",
    });
}

export function UpdateChannel(
    req: express.Request,
    res: express.Response
): void {
    const channel = getChannelFromRequest(req);

    if (!channel || !channel.internalName) {
        res.api<ApiErrorResponse>(400, {
            status: "ERROR",
            message: req.t("route.channels.channel-not-found"),
        });
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

    const quality = formdata.quality
        ? (formdata.quality.split(" ") as VideoQuality[])
        : [];
    const match = formdata.match
        ? formdata.match.split(",").map((m) => m.trim())
        : [];
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

    res.api<ApiGenericResponse>(200, {
        status: "OK",
        message: req
            .t("route.channels.channel-internalname-updated", [
                channel.internalName,
            ])
            .toString(),
    });
}

export async function DeleteChannel(
    req: express.Request,
    res: express.Response
): Promise<void> {
    const channel = getChannelFromRequest(req);

    if (!channel || !channel.internalName) {
        if (
            LiveStreamDVR.getInstance().channels_config.find(
                (c) => c instanceof TwitchChannel && c.uuid === req.params.uuid
            )
        ) {
            LiveStreamDVR.getInstance().channels_config =
                LiveStreamDVR.getInstance().channels_config.filter(
                    (c) =>
                        c instanceof TwitchChannel && c.uuid !== req.params.uuid
                );
            LiveStreamDVR.getInstance().saveChannelsConfig();

            res.api<ApiGenericResponse>(200, {
                status: "OK",
                message: req
                    .t(
                        "route.channels.channel-found-in-config-but-not-in-memory-removed-from-config"
                    )
                    .toString(),
            });
            log(
                LOGLEVEL.INFO,
                "route.channels.delete",
                `Channel ${req.params.login} found in config but not in memory, removed from config`
            );
            return;
        }

        res.api<ApiErrorResponse>(400, {
            status: "ERROR",
            message: req.t("route.channels.channel-not-found"),
        });
        return;
    }

    if (req.query.deletevods == "1" && channel.vods_list.length > 0) {
        try {
            await channel.deleteAllVods();
        } catch (error) {
            log(
                LOGLEVEL.ERROR,
                "route.channels.deleteAllVods",
                `Failed to delete all VODs of channel: ${
                    (error as Error).message
                }`
            );
            res.api<ApiErrorResponse>(400, {
                status: "ERROR",
                message: (error as Error).message,
            });
            return;
        }
    }

    const name = channel.internalName;

    channel.delete();

    log(LOGLEVEL.INFO, "route.channels.delete", `Channel ${name} deleted`);

    res.api<ApiGenericResponse>(200, {
        status: "OK",
        message: req
            .t("route.channels.channel-internalname-deleted", [
                channel.internalName,
            ])
            .toString(),
    });
}

export async function AddChannel(
    req: express.Request,
    res: express.Response
): Promise<void> {
    const provider = req.body.provider as Providers;

    if (!provider) {
        res.api(400, {
            status: "ERROR",
            message: req.t("route.channels.provider-not-found"),
        } as ApiErrorResponse);
        return;
    }

    const formdata: {
        login?: string;
        channel_id?: string;
        slug?: string;
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
            quality: formdata.quality
                ? (formdata.quality.split(" ") as VideoQuality[])
                : [],
            match: formdata.match
                ? formdata.match.split(",").map((m) => m.trim())
                : [],
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
            res.api(400, {
                status: "ERROR",
                message: req.t("route.channels.channel-login-not-specified"),
            } as ApiErrorResponse);
            return;
        }

        if (channel_config.quality.length === 0) {
            res.api(400, {
                status: "ERROR",
                message: req.t("route.channels.no-quality-selected"),
            } as ApiErrorResponse);
            return;
        }

        if (
            channel_config.quality.some((q) => !VideoQualityArray.includes(q))
        ) {
            res.api(400, {
                status: "ERROR",
                message: req.t("route.channels.invalid-quality-selected"),
            } as ApiErrorResponse);
            return;
        }

        const channel = TwitchChannel.getChannelByLogin(channel_config.login);
        if (channel) {
            log(
                LOGLEVEL.ERROR,
                "route.channels.add",
                `Failed to create channel, channel already exists: ${channel_config.login}`
            );
            res.api(400, {
                status: "ERROR",
                message: req.t("route.channels.channel-already-exists"),
            } as ApiErrorResponse);
            return;
        }

        let api_channel_data;

        try {
            api_channel_data = await TwitchChannel.getUserDataByLogin(
                channel_config.login
            );
        } catch (error) {
            log(
                LOGLEVEL.ERROR,
                "route.channels.add",
                `Failed to create channel, API error: ${
                    (error as Error).message
                }`
            );
            res.api(400, {
                status: "ERROR",
                message: `API error: ${(error as Error).message}`,
            } as ApiErrorResponse);
            return;
        }

        if (
            api_channel_data &&
            api_channel_data.login !== channel_config.login
        ) {
            res.api(400, {
                status: "ERROR",
                message: req.t(
                    "route.channels.channel-login-does-not-match-data-fetched-from-api"
                ),
            } as ApiErrorResponse);
            return;
        }

        try {
            new_channel = await TwitchChannel.create(channel_config);
        } catch (error) {
            log(
                LOGLEVEL.ERROR,
                "route.channels.add",
                `Failed to create channel: ${error}`
            );
            res.api(400, {
                status: "ERROR",
                message: (error as Error).message,
            } as ApiErrorResponse);
            return;
        }

        log(
            LOGLEVEL.SUCCESS,
            "route.channels.add",
            `Created channel: ${new_channel.internalName}`
        );
    } else if (provider == "youtube") {
        const channel_config: YouTubeChannelConfig = {
            uuid: "",
            provider: "youtube",
            channel_id: formdata.channel_id || "",
            quality: formdata.quality
                ? (formdata.quality.split(" ") as VideoQuality[])
                : [],
            match: formdata.match
                ? formdata.match.split(",").map((m) => m.trim())
                : [],
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
            res.api(400, {
                status: "ERROR",
                message: req.t("route.channels.channel-id-not-specified"),
            } as ApiErrorResponse);
            return;
        }

        const channel = YouTubeChannel.getChannelById(
            channel_config.channel_id
        );
        if (channel) {
            log(
                LOGLEVEL.ERROR,
                "route.channels.add",
                `Failed to create channel, channel already exists: ${channel_config.channel_id}`
            );
            res.api(400, {
                status: "ERROR",
                message: req.t("route.channels.channel-already-exists"),
            } as ApiErrorResponse);
            return;
        }

        let api_channel_data;

        try {
            api_channel_data = await YouTubeChannel.getUserDataById(
                channel_config.channel_id
            );
        } catch (error) {
            log(
                LOGLEVEL.ERROR,
                "route.channels.add",
                `Failed to create channel, API error: ${
                    (error as Error).message
                }`
            );
            res.api(400, {
                status: "ERROR",
                message: `API error: ${(error as Error).message}`,
            } as ApiErrorResponse);
            return;
        }

        /*
        if (api_channel_data && api_channel_data.login !== channel_config.login) {
            res.api(400, {
                status: "ERROR",
                message: "Channel login does not match data fetched from API",
            } as ApiErrorResponse);
            return;
        }
        */

        try {
            new_channel = await YouTubeChannel.create(channel_config);
        } catch (error) {
            log(
                LOGLEVEL.ERROR,
                "route.channels.add",
                `Failed to create channel: ${error}`
            );
            res.api(400, {
                status: "ERROR",
                message: (error as Error).message,
            } as ApiErrorResponse);
            return;
        }

        log(
            LOGLEVEL.SUCCESS,
            "route.channels.add",
            `Created channel: ${new_channel.displayName}`
        );
    } else if (provider == "kick") {
        const channel_config: KickChannelConfig = {
            uuid: "",
            provider: "kick",
            slug: formdata.slug || "",
            quality: formdata.quality
                ? (formdata.quality.split(" ") as VideoQuality[])
                : [],
            match: formdata.match
                ? formdata.match.split(",").map((m) => m.trim())
                : [],
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

        if (!channel_config.slug) {
            res.api(400, {
                status: "ERROR",
                message: req.t("route.channels.channel-slug-not-specified"),
            } as ApiErrorResponse);
            return;
        }

        const channel = KickChannel.getChannelBySlug(channel_config.slug);
        if (channel) {
            log(
                LOGLEVEL.ERROR,
                "route.channels.add",
                `Failed to create channel, channel already exists: ${channel_config.slug}`
            );
            res.api(400, {
                status: "ERROR",
                message: req.t("route.channels.channel-already-exists"),
            } as ApiErrorResponse);
            return;
        }

        let api_channel_data;

        try {
            api_channel_data = await KickChannel.getUserDataBySlug(
                channel_config.slug
            );
        } catch (error) {
            log(
                LOGLEVEL.ERROR,
                "route.channels.add",
                `Failed to create channel, API error: ${
                    (error as Error).message
                }`
            );
            res.api(400, {
                status: "ERROR",
                message: `API error: ${(error as Error).message}`,
            } as ApiErrorResponse);
            return;
        }

        try {
            new_channel = await KickChannel.create(channel_config);
        } catch (error) {
            log(
                LOGLEVEL.ERROR,
                "route.channels.add",
                `Failed to create channel: ${error}`
            );
            res.api(400, {
                status: "ERROR",
                message: (error as Error).message,
            } as ApiErrorResponse);
            return;
        }

        log(
            LOGLEVEL.SUCCESS,
            "route.channels.add",
            `Created channel: ${new_channel.displayName}`
        );
    }

    if (!new_channel) {
        res.api(400, {
            status: "ERROR",
            message: req.t("route.channels.no-channel-created"),
        } as ApiErrorResponse);
        return;
    }

    res.api(200, {
        data: await new_channel.toAPI(),
        status: "OK",
        message: req.t("route.channels.channel-displayname-created", [
            new_channel.displayName,
        ]),
    });

    new_channel.broadcastUpdate();
}

export async function DownloadVideo(
    req: express.Request,
    res: express.Response
): Promise<void> {
    const channel = getChannelFromRequest(req);

    if (!channel || !channel.internalName) {
        res.api(400, {
            status: "ERROR",
            message: req.t("route.channels.channel-not-found"),
        } as ApiErrorResponse);
        return;
    }

    const video_id = req.params.video_id;
    const quality =
        req.query.quality &&
        VideoQualityArray.includes(req.query.quality as string)
            ? (req.query.quality as VideoQuality)
            : "best";

    const template = (
        video: ProxyVideo,
        extraData: Record<string, any>,
        what: string
    ) => {
        if (!video) return "";

        const date = parseJSON(video.created_at);

        if (!date || !isValid(date)) {
            log(
                LOGLEVEL.ERROR,
                "route.channels.download",
                `Invalid start date: ${video.created_at}`
            );
        }

        const variables: VodBasenameTemplate = {
            // login: channel.internalName || "",
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
            season: channel.current_season, // TODO make from date
            absolute_season: channel.current_absolute_season
                ? channel.current_absolute_season.toString().padStart(2, "0")
                : "", // TODO make from date
            absolute_episode: "0", // episode won't work with random downloads
            // episode: this.vod_episode ? this.vod_episode.toString().padStart(2, "0") : "",
            episode: "0", // episode won't work with random downloads
            title: video.title || "",
            game_name: extraData.game_name || "",
            game_id: extraData.game_id || "",
        };

        return formatString(Config.getInstance().cfg(what), variables);
    };

    if (isTwitchChannel(channel)) {
        // check if vod is already downloaded
        if (TwitchVOD.getVodByProviderId(video_id)) {
            res.api(400, {
                status: "ERROR",
                message: req.t("route.channels.video-already-downloaded"),
            } as ApiErrorResponse);
            return;
        }

        // fetch vod info online
        let video: ProxyVideo | false;
        try {
            video = await TwitchVOD.getVideoProxy(video_id);
        } catch (error) {
            res.api(400, {
                status: "ERROR",
                message: req.t(
                    "route.channels.error-while-fetching-video-data-error",
                    [(error as Error).message]
                ),
            } as ApiErrorResponse);
            return;
        }

        if (!video) {
            res.api(400, {
                status: "ERROR",
                message: req.t("route.channels.video-not-found"),
            } as ApiErrorResponse);
            return;
        }

        // fetch supplementary data
        let videoGqlData;
        try {
            videoGqlData = await TwitchVOD.getGqlVideoInfo(video_id);
        } catch (error) {
            log(
                LOGLEVEL.ERROR,
                "route.channels.download",
                `Failed to fetch video data: ${(error as Error).message}`
            );
        }

        // make filename
        const basename = template(
            video,
            {
                game_name: videoGqlData?.game?.displayName || "",
                game_id: videoGqlData?.game?.id || "",
            },
            "filename_vod"
        );

        if (!validateFilename(basename)) {
            res.api(400, {
                status: "ERROR",
                message: req.t("message.invalid-filesystem-entry", [basename]),
            } as ApiErrorResponse);
            return;
        }

        const basefolderPathTemplate = template(
            video,
            {
                game_name: videoGqlData?.game?.displayName || "",
                game_id: videoGqlData?.game?.id || "",
            },
            "filename_vod_folder"
        );

        if (!validateRelativePath(basefolderPathTemplate)) {
            res.api(400, {
                status: "ERROR",
                message: req.t("message.invalid-filesystem-entry", [
                    basefolderPathTemplate,
                ]),
            } as ApiErrorResponse);
            return;
        }

        // make folder name
        const basefolder = sanitizePath(
            path.join(channel.getFolder(), basefolderPathTemplate)
        );

        if (!validateAbsolutePath(basefolder)) {
            res.api(400, {
                status: "ERROR",
                message: req.t("message.invalid-filesystem-entry", [
                    basefolder,
                ]),
            } as ApiErrorResponse);
            return;
        }

        // make filepath
        const filepath = path.join(
            basefolder,
            `${basename}.${Config.getInstance().cfg("vod_container", "mp4")}`
        );

        if (TwitchVOD.hasVod(basename)) {
            res.api(400, {
                status: "ERROR",
                message: req.t("route.channels.vod-already-exists-basename", [
                    basename,
                ]),
            } as ApiErrorResponse);
            return;
        }

        // create folder if it doesn't exist
        try {
            fs.mkdirSync(path.dirname(filepath), { recursive: true });
        } catch (error) {
            if (isError(error)) {
                if (!error.message.includes("EEXIST")) {
                    log(
                        LOGLEVEL.ERROR,
                        "route.channels.download",
                        `Failed to create folder: ${error.message}`
                    );
                    res.api(400, {
                        status: "ERROR",
                        message: error.message,
                    } as ApiErrorResponse);
                    return;
                }
            }
        }

        // download video

        let status = false;

        try {
            status =
                (await TwitchVOD.downloadVideo(video_id, quality, filepath)) !=
                "";
        } catch (error) {
            log(
                LOGLEVEL.ERROR,
                "route.channels.download",
                `Failed to download video: ${(error as Error).message}`
            );
            res.api(400, {
                status: "ERROR",
                message: (error as Error).message,
            } as ApiErrorResponse);
            return;
        }

        if (status) {
            // create vod object
            let vod: TwitchVOD;
            try {
                vod = await channel.createVOD(
                    path.join(basefolder, `${basename}.json`)
                );
            } catch (error) {
                res.api(400, {
                    status: "ERROR",
                    message: (error as Error).message,
                } as ApiErrorResponse);
                return;
            }

            // substitute started at with created at
            vod.started_at = parseJSON(video.created_at);

            if (video.stream_id) vod.capture_id = video.stream_id;

            // calculate ended at from started at and duration
            vod.ended_at = new Date(
                vod.started_at.getTime() + video.duration * 1000
            );
            await vod.saveJSON("manual creation");

            // add segment to vod
            vod.addSegment(path.basename(filepath));

            // fetch supplementary chapter data
            let chapterData;

            try {
                chapterData = await TwitchVOD.getGqlVideoChapters(video_id);
            } catch (error) {
                log(
                    LOGLEVEL.ERROR,
                    "route.channels.download",
                    `Failed to fetch chapter data: ${(error as Error).message}`
                );
            }

            if (chapterData && chapterData.length > 0) {
                const chapters: TwitchVODChapterJSON[] = [];
                for (const c of chapterData) {
                    if (!vod.started_at) continue;
                    const start_time = addSeconds(
                        vod.started_at,
                        c.positionMilliseconds / 1000
                    );
                    chapters.push({
                        title: c.description,
                        game_id: c.details.game.id,
                        game_name: c.details.game.displayName,
                        started_at: start_time.toJSON(),
                        is_mature: false,
                        online: true,
                    });
                }

                await vod.parseChapters(chapters);
            } else if (videoGqlData) {
                const chapters: TwitchVODChapterJSON[] = [];
                chapters.push({
                    title: videoGqlData.title,
                    game_id: videoGqlData.game.id,
                    game_name: videoGqlData.game.displayName,
                    started_at: vod.started_at.toJSON(),
                    is_mature: false,
                    online: true,
                });

                await vod.parseChapters(chapters);
            }

            await vod.finalize();
            await vod.saveJSON("manual finalize");

            Webhook.dispatchAll("end_download", {
                vod: await vod.toAPI(),
            });
        } else {
            res.api(400, {
                status: "ERROR",
                message: req.t("route.channels.video-download-failed"),
            } as ApiErrorResponse);
            return;
        }
    } else if (isYouTubeChannel(channel)) {
        if (YouTubeVOD.getVodByProviderId(video_id)) {
            res.api(400, {
                status: "ERROR",
                message: req.t("route.channels.video-already-downloaded"),
            } as ApiErrorResponse);
            return;
        }

        let video: ProxyVideo | false;
        try {
            video = await YouTubeVOD.getVideoProxy(video_id);
        } catch (error) {
            res.api(400, {
                status: "ERROR",
                message: `Error while fetching video data: ${
                    (error as Error).message
                }`,
            } as ApiErrorResponse);
            return;
        }

        if (!video) {
            res.api(400, {
                status: "ERROR",
                message: req.t("route.channels.video-not-found"),
            } as ApiErrorResponse);
            return;
        }

        debugLog("video", video);

        const basename = template(video, {}, "filename_vod");
        const basefolder = path.join(
            channel.getFolder(),
            template(video, {}, "filename_vod_folder")
        );

        const filepath = path.join(
            basefolder,
            `${basename}.${Config.getInstance().cfg("vod_container", "mp4")}`
        );

        if (YouTubeVOD.hasVod(basename)) {
            res.api<ApiErrorResponse>(400, {
                status: "ERROR",
                message: req.t("route.channels.vod-already-exists-basename", [
                    basename,
                ]),
            });
            return;
        }

        try {
            fs.mkdirSync(path.dirname(filepath), { recursive: true });
        } catch (error) {
            if (isError(error)) {
                if (!error.message.includes("EEXIST")) {
                    log(
                        LOGLEVEL.ERROR,
                        "route.channels.download",
                        `Failed to create folder: ${error.message}`
                    );
                    res.api<ApiErrorResponse>(400, {
                        status: "ERROR",
                        message: error.message,
                    });
                    return;
                }
            }
        }

        let status = false;

        try {
            status =
                (await YouTubeVOD.downloadVideo(video_id, quality, filepath)) !=
                "";
        } catch (error) {
            log(
                LOGLEVEL.ERROR,
                "route.channels.download",
                `Failed to download video: ${(error as Error).message}`
            );
            res.api(400, {
                status: "ERROR",
                message: (error as Error).message,
            } as ApiErrorResponse);
            return;
        }

        if (status) {
            let vod;

            try {
                vod = await channel.createVOD(
                    path.join(basefolder, `${basename}.json`)
                );
            } catch (error) {
                res.api(400, {
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
            vod.ended_at = new Date(
                vod.started_at.getTime() + video.duration * 1000
            );
            await vod.saveJSON("manual creation");

            vod.addSegment(path.basename(filepath));
            await vod.finalize();
            await vod.saveJSON("manual finalize");

            if (!vod.channel_uuid) {
                log(
                    LOGLEVEL.FATAL,
                    "route.channels.download",
                    `Channel UUID is empty for VOD ${vod.uuid}`
                );
                res.api(500, {
                    status: "ERROR",
                    message: req.t("route.channels.channel-uuid-is-empty"),
                } as ApiErrorResponse);
                return;
            }

            Webhook.dispatchAll("end_download", {
                vod: await vod.toAPI(),
            });
        } else {
            res.api(400, {
                status: "ERROR",
                message: req.t("route.channels.video-download-failed"),
            } as ApiErrorResponse);
            return;
        }
    } else {
        res.api(400, {
            status: "ERROR",
            message: req.t("route.channels.channel-is-not-supported"),
        } as ApiErrorResponse);
        return;
    }
}

export async function SubscribeToChannel(
    req: express.Request,
    res: express.Response
): Promise<void> {
    const channel = getChannelFromRequest(req);

    if (!channel || !channel.internalId) {
        res.api(400, {
            status: "ERROR",
            message: req.t("route.channels.channel-uuid-not-found", [
                req.params.uuid ?? req.params.name,
            ]),
        } as ApiErrorResponse);
        return;
    }

    if (channel.subscribe == BaseChannel.prototype.subscribe) {
        res.api(400, {
            status: "ERROR",
            message: req.t("route.channels.channel-not-subscribable", [
                req.params.uuid ?? req.params.name,
            ]),
        } as ApiErrorResponse);
        return;
    }

    const sub = await channel.subscribe(true);

    res.api(200, {
        data: {
            login: channel.internalName,
            status: sub
                ? "Subscription request sent, check logs for details"
                : "ERROR",
        },
        status: "OK",
    });
}

export async function UnsubscribeFromChannel(
    req: express.Request,
    res: express.Response
): Promise<void> {
    const channel = getChannelFromRequest(req);

    if (!channel || !channel.internalId) {
        res.api(400, {
            status: "ERROR",
            message: req.t("route.channels.channel-uuid-not-found", [
                req.params.uuid ?? req.params.name,
            ]),
        } as ApiErrorResponse);
        return;
    }

    if (channel.unsubscribe == BaseChannel.prototype.unsubscribe) {
        res.api(400, {
            status: "ERROR",
            message: req.t("route.channels.channel-not-subscribable", [
                req.params.uuid ?? req.params.name,
            ]),
        } as ApiErrorResponse);
        return;
    }

    const sub = await channel.unsubscribe();

    res.api(200, {
        status: "OK",
        message: sub ? "Unsubscribed" : "ERROR",
    });
}

export async function CheckSubscriptions(
    req: express.Request,
    res: express.Response
): Promise<void> {
    const channel = getChannelFromRequest(req);

    if (!channel || !channel.internalId) {
        res.api(400, {
            status: "ERROR",
            message: req.t("route.channels.channel-uuid-not-found", [
                req.params.uuid ?? req.params.name,
            ]),
        } as ApiErrorResponse);
        return;
    }

    if (channel.subscribe == BaseChannel.prototype.subscribe) {
        res.api(400, {
            status: "ERROR",
            message: req.t("route.channels.channel-not-subscribable", [
                req.params.uuid ?? req.params.name,
            ]),
        } as ApiErrorResponse);
        return;
    }

    const all_subs = await TwitchHelper.getSubsList();

    if (!all_subs) {
        res.api(400, {
            status: "ERROR",
            message: req.t(
                "route.channels.no-subscriptions-for-channel-internalname"
            ),
        } as ApiErrorResponse);
        return;
    }

    const channel_subs = all_subs.filter(
        (sub) => sub.condition.broadcaster_user_id == channel.internalId
    );

    res.api(200, {
        data: {
            raw: channel_subs,
        },
        message: channel_subs
            .map((sub) => `${sub.type}: ${sub.status}`)
            .join("\n"),
        status: "OK",
    });
}

export async function CleanupChannelVods(
    req: express.Request,
    res: express.Response
): Promise<void> {
    const channel = getChannelFromRequest(req);

    if (!channel || !channel.internalName) {
        res.api<ApiErrorResponse>(400, {
            status: "ERROR",
            message: req.t("route.channels.channel-not-found"),
        } as ApiErrorResponse);
        return;
    }

    const deleted = await channel.cleanupVods();

    res.api(200, {
        status: "OK",
        // message: `Deleted ${deleted ? deleted : "no"} ${deleted === 1 ? "VOD" : "VODs"}`,
        message: req.t("route.channels.deleted-vods", { count: deleted || 0 }),
    });
}

export async function RefreshChannel(
    req: express.Request,
    res: express.Response
): Promise<void> {
    const channel = getChannelFromRequest(req);

    if (!channel || !channel.internalName) {
        res.api<ApiErrorResponse>(400, {
            status: "ERROR",
            message: req.t("route.channels.channel-not-found"),
        });
        return;
    }

    let success;
    try {
        success = await channel.refreshData();
    } catch (error) {
        log(
            LOGLEVEL.ERROR,
            "route.channels.refresh",
            `Failed to refresh channel: ${(error as Error).message}`
        );
        res.api<ApiErrorResponse>(400, {
            status: "ERROR",
            message: (error as Error).message,
        });
        return;
    }

    let isLive = false;
    try {
        isLive = await channel.isLiveApi();
    } catch (error) {
        log(
            LOGLEVEL.ERROR,
            "route.channels.refresh",
            `Could not get live status for ${channel.internalName}`
        );
    }

    if (!isLive) {
        await KeyValue.getInstance().deleteAsync(
            `${channel.internalName}.online`
        );
        await KeyValue.getInstance().deleteAsync(
            `${channel.internalName}.vod.id`
        );
        await KeyValue.getInstance().deleteAsync(
            `${channel.internalName}.vod.started_at`
        );
    }

    if (success) {
        log(
            LOGLEVEL.SUCCESS,
            "route.channels.refresh",
            `Refreshed channel: ${channel.internalName}`
        );
        res.api<ApiGenericResponse>(200, {
            status: "OK",
            message: req
                .t("route.channels.refreshed-channel-channel-internalname", [
                    channel.internalName,
                ])
                .toString(),
        });
        channel.broadcastUpdate();
    } else {
        log(
            LOGLEVEL.ERROR,
            "route.channels.refresh",
            `Failed to refresh channel: ${channel.internalName}`
        );
        res.api<ApiErrorResponse>(400, {
            status: "ERROR",
            message: req.t("route.channels.failed-to-refresh-channel"),
        });
    }
}

export async function ForceRecord(
    req: express.Request,
    res: express.Response
): Promise<void> {
    const channel = getChannelFromRequest(req);

    if (!channel || !channel.internalId) {
        res.api(400, {
            status: "ERROR",
            message: req.t("route.channels.channel-not-found"),
        } as ApiErrorResponse);
        return;
    }

    if (isTwitchChannel(channel)) {
        const streams = await TwitchChannel.getStreams(channel.internalId);

        if (streams) {
            const stream = streams.find((s) => s.type === "live");
            if (stream) {
                const mock_data: EventSubStreamOnline = {
                    subscription: {
                        id: "fake",
                        type: "stream.online",
                        condition: {
                            broadcaster_user_id: stream.user_id,
                        },
                        version: "1",
                        status: "enabled",
                        created_at: new Date().toISOString(),
                        cost: 0,
                        transport: {
                            method: "webhook",
                            callback: "https://example.com/webhook",
                        },
                    },
                    event: {
                        type: "live",
                        id: stream.id,
                        broadcaster_user_id: stream.user_id,
                        broadcaster_user_login: stream.user_login,
                        broadcaster_user_name: stream.user_name,
                        // "title": stream.title,
                        // "category_id": stream.game_id,
                        // "category_name": stream.game_name,
                        started_at: stream.started_at,
                        // "is_mature": stream.is_mature,
                    },
                };

                // req.headers["twitch-eventsub-message-id"] = "fake";
                // req.headers["twitch-eventsub-signature"] = "fake";
                // req.headers["twitch-eventsub-message-retry"] = "0";

                const metadata_proxy: AutomatorMetadata = {
                    message_id: "fake",
                    message_retry: 0,
                    message_type: "notification",
                    message_signature: "fake",
                    message_timestamp: new Date().toISOString(),
                    subscription_type: "stream.online",
                    subscription_version: "1",
                };

                const chapter_data = {
                    started_at: JSON.stringify(parseJSON(stream.started_at)),
                    game_id: stream.game_id,
                    game_name: stream.game_name,
                    viewer_count: stream.viewer_count,
                    title: stream.title,
                    is_mature: stream.is_mature,
                    online: true,
                } as TwitchVODChapterJSON;

                await KeyValue.getInstance().setObjectAsync(
                    `${stream.user_login}.chapterdata`,
                    chapter_data
                );

                log(
                    LOGLEVEL.INFO,
                    "route.channels.force_record",
                    `Forcing record for ${channel.internalName}`
                );

                const TA = new TwitchAutomator();
                TA.handle(mock_data, metadata_proxy);

                res.api(200, {
                    status: "OK",
                    message: req.t(
                        "route.channels.forced-recording-of-channel-channel-internalname",
                        [channel.internalName]
                    ),
                });

                return;
            } else {
                res.api(400, {
                    status: "ERROR",
                    message: "No live stream found",
                } as ApiErrorResponse);
                return;
            }
        } else {
            res.api(400, {
                status: "ERROR",
                message: "No streams found",
            } as ApiErrorResponse);
            return;
        }
    } else if (isYouTubeChannel(channel)) {
        const streams = await channel.getStreams();

        if (streams) {
            log(
                LOGLEVEL.INFO,
                "route.channels.force_record",
                `Forcing record for ${channel.internalName}`
            );

            const YA = new YouTubeAutomator();
            YA.broadcaster_user_id = channel.internalId;
            YA.broadcaster_user_name = channel.displayName;
            YA.broadcaster_user_login = channel.internalName;
            YA.channel = channel;
            // YA.handle(mock_data, req);

            await KeyValue.getInstance().setAsync(
                `yt.${YA.getUserID()}.vod.started_at`,
                streams.snippet?.publishedAt || new Date().toISOString()
            );
            await KeyValue.getInstance().setAsync(
                `yt.${YA.getUserID()}.vod.id`,
                streams.id?.videoId || "fake"
            );

            YA.download();

            res.api(200, {
                status: "OK",
                message: req.t(
                    "route.channels.forced-recording-of-channel-channel-internalname",
                    [channel.internalName]
                ),
            });
        } else {
            res.api(400, {
                status: "ERROR",
                message: req.t("route.channels.no-streams-found"),
            } as ApiErrorResponse);
        }

        return;
    }
}

export async function RenameChannel(
    req: express.Request,
    res: express.Response
): Promise<void> {
    const channel = getChannelFromRequest(req);

    if (!channel || !channel.internalName) {
        res.api(400, {
            status: "ERROR",
            message: req.t("route.channels.channel-not-found"),
        } as ApiErrorResponse);
        return;
    }

    const success = await channel.rename(req.body.new_login);

    if (success) {
        log(
            LOGLEVEL.SUCCESS,
            "route.channels.rename",
            `Renamed channel: ${channel.internalName} to ${req.body.new_login}`
        );
        res.api(200, {
            status: "OK",
            message: req.t(
                "route.channels.renamed-channel-channel-internalname-to-req-body-new_login",
                [channel.internalName, req.body.new_login]
            ),
        });
        channel.broadcastUpdate();
    } else {
        log(
            LOGLEVEL.ERROR,
            "route.channels.rename",
            `Failed to rename channel: ${channel.internalName} to ${req.body.new_login}`
        );
        res.api(400, {
            status: "ERROR",
            message: req.t("route.channels.failed-to-rename-channel"),
        } as ApiErrorResponse);
    }
}

export async function DeleteAllChannelVods(
    req: express.Request,
    res: express.Response
): Promise<void> {
    const channel = getChannelFromRequest(req);

    if (!channel || !channel.internalName) {
        res.api(400, {
            status: "ERROR",
            message: req.t("route.channels.channel-not-found"),
        } as ApiErrorResponse);
        return;
    }

    let success;

    try {
        success = await channel.deleteAllVods();
    } catch (error) {
        log(
            LOGLEVEL.ERROR,
            "route.channels.deleteAllVods",
            `Failed to delete all VODs of channel: ${(error as Error).message}`
        );
        res.api(400, {
            status: "ERROR",
            message: (error as Error).message,
        } as ApiErrorResponse);
        return;
    }

    if (success) {
        log(
            LOGLEVEL.SUCCESS,
            "route.channels.deleteallvods",
            `Deleted all VODs of channel: ${channel.internalName}`
        );
        res.api(200, {
            status: "OK",
            message: req.t(
                "route.channels.deleted-all-vods-of-channel-channel-internalname",
                [channel.internalName]
            ),
        });
        channel.broadcastUpdate();
    } else {
        log(
            LOGLEVEL.ERROR,
            "route.channels.deleteallvods",
            `Failed to delete all VODs of channel: ${channel.internalName}`
        );
        res.api(400, {
            status: "ERROR",
            message: req.t("route.channels.failed-to-delete-all-vods"),
        } as ApiErrorResponse);
    }
}

interface StreamEvent {
    time: string;
    action: string;
}

type HistoryEntry = TwitchVODChapterJSON | StreamEvent;

export function GetHistory(req: express.Request, res: express.Response): void {
    const channel = getChannelFromRequest(req);

    if (!channel || !channel.internalName) {
        res.api<ApiErrorResponse>(400, {
            status: "ERROR",
            message: req.t("route.channels.channel-not-found"),
        });
        return;
    }

    const history: HistoryEntry[] = [];

    const file = path.join(
        BaseConfigCacheFolder.history,
        `${channel.internalName}.jsonline`
    );
    if (!fs.existsSync(file)) {
        res.api<ApiErrorResponse>(400, {
            status: "ERROR",
            message: req.t("route.channels.no-history-found"),
        });
        return;
    }

    const lines = fs.readFileSync(file, "utf8").split("\n");
    for (const line of lines) {
        if (line.length > 0) {
            const chapter = JSON.parse(line) as HistoryEntry;
            history.push(chapter);
        }
    }

    res.api<ApiResponse>(200, {
        status: "OK",
        // message: "History found",
        data: history,
    });

    return;
}

export async function ScanVods(
    req: express.Request,
    res: express.Response
): Promise<void> {
    const channel = getChannelFromRequest(req);

    if (!channel || !channel.internalName) {
        res.api(400, {
            status: "ERROR",
            message: req.t("route.channels.channel-not-found"),
        } as ApiErrorResponse);
        return;
    }

    if (channel.is_capturing || channel.is_converting) {
        res.api(400, {
            status: "ERROR",
            message: req.t(
                "route.channels.channel-is-currently-capturing-please-stop-the-capture-first-or-wait-until-it-is-finished"
            ),
        } as ApiErrorResponse);
        return;
    }

    // channel.vods_raw = channel.rescanVods();
    // logAdvanced(LOGLEVEL.INFO, "channel", `Found ${channel.vods_raw.length} VODs from recursive file search for ${channel.login}`);
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

    res.api(200, {
        status: "OK",
        message: `Channel '${channel.internalName}' scanned, found ${channel.vods_raw.length} VODs.`,
    });
}

export function ScanLocalVideos(
    req: express.Request,
    res: express.Response
): void {
    const channel = getChannelFromRequest(req);

    if (!channel || !channel.internalName) {
        res.api(400, {
            status: "ERROR",
            message: req.t("route.channels.channel-not-found"),
        } as ApiErrorResponse);
        return;
    }

    if (isTwitchChannel(channel)) {
        channel.video_list = [];
        channel.addAllLocalVideos();
    }

    channel.broadcastUpdate();

    res.api(200, {
        status: "OK",
        message: `Channel '${channel.internalName}' scanned, found ${channel.video_list.length} local videos.`,
    });
}

export async function GetClips(
    req: express.Request,
    res: express.Response
): Promise<void> {
    const channel = getChannelFromRequest(req);

    if (!channel || !channel.internalName) {
        res.api(400, {
            status: "ERROR",
            message: req.t("route.channels.channel-not-found"),
        } as ApiErrorResponse);
        return;
    }

    if (!isTwitchChannel(channel)) {
        res.api(400, {
            status: "ERROR",
            message: req.t("route.channels.channel-is-not-a-twitch-channel"),
        } as ApiErrorResponse);
        return;
    }

    const clips = await channel.getClips(undefined, 40);

    res.api(200, {
        status: "OK",
        data: clips,
    });
}

export async function ExportAllVods(
    req: express.Request,
    res: express.Response
): Promise<void> {
    const channel = getChannelFromRequest(req);
    const force = req.query.force === "true";

    if (!channel || !channel.internalName) {
        res.api(400, {
            status: "ERROR",
            message: req.t("route.channels.channel-not-found"),
        } as ApiErrorResponse);
        return;
    }

    const [completedVods, failedVods] = await channel.exportAllVods(force);

    res.api(failedVods > 0 ? 500 : 200, {
        status: "OK",
        message: `Exported ${completedVods} VODs, ${failedVods} failed`,
    });
}
