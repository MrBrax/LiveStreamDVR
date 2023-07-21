import { youtube_v3 } from "@googleapis/youtube";
import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";
import type { ApiYouTubeVod } from "@common/Api/Client";
import type { VideoQuality } from "@common/Config";
import type { Providers } from "@common/Defs";
import type { ProxyVideo } from "@common/Proxies/Video";
import { BaseConfigCacheFolder } from "../../../Core/BaseConfig";
import { Helper } from "../../../Core/Helper";
import { LiveStreamDVR } from "../../../Core/LiveStreamDVR";
import { log, LOGLEVEL } from "../../../Core/Log";
import { isYouTubeVOD } from "../../../Helpers/Types";
import { YouTubeHelper } from "../../../Providers/YouTube";
import type { VODJSON, YouTubeVODJSON } from "../../../Storage/JSON";
import { BaseVOD } from "../Base/BaseVOD";
import type { BaseVODChapter } from "../Base/BaseVODChapter";
import type { YouTubeChannel } from "./YouTubeChannel";
import { execAdvanced } from "../../../Helpers/Execute";

export class YouTubeVOD extends BaseVOD {
    public provider: Providers = "youtube";

    json?: YouTubeVODJSON;

    streamer_name = "";
    streamer_id = "";

    chapters: Array<BaseVODChapter> = [];

    youtube_vod_id?: string;

    public async toAPI(): Promise<ApiYouTubeVod> {
        if (!this.uuid) throw new Error(`No UUID set on VOD ${this.basename}`);
        if (!this.channel_uuid)
            throw new Error(`No channel UUID set on VOD ${this.basename}`);
        return {
            provider: "youtube",
            uuid: this.uuid,
            channel_uuid: this.channel_uuid,
            basename: this.basename || "",

            // stream_title: this.stream_title,
            // stream_resolution: this.stream_resolution,

            segments: this.segments.map((s) => s.toAPI()),
            segments_raw: this.segments_raw,

            streamer_name: this.streamer_name || "",
            streamer_id: this.streamer_id || "",
            // streamer_login: this.streamer_login || "",

            created_at: this.created_at ? this.created_at.toISOString() : "",
            saved_at: this.saved_at ? this.saved_at.toISOString() : "",
            started_at: this.started_at ? this.started_at.toISOString() : "",
            ended_at: this.ended_at ? this.ended_at.toISOString() : undefined,
            capture_started: this.capture_started
                ? this.capture_started.toISOString()
                : undefined,
            capture_started2: this.capture_started2
                ? this.capture_started2.toISOString()
                : undefined,
            conversion_started: this.conversion_started
                ? this.conversion_started.toISOString()
                : undefined,

            is_converted: this.is_converted,
            is_capturing: this.is_capturing,
            is_converting: this.is_converting,
            is_finalized: this.is_finalized,

            is_chat_downloaded: this.is_chat_downloaded,
            is_vod_downloaded: this.is_vod_downloaded,
            is_chat_rendered: this.is_chat_rendered,
            is_chat_burned: this.is_chat_burned,
            is_lossless_cut_generated: this.is_lossless_cut_generated,
            is_chatdump_captured: this.is_chatdump_captured,
            is_capture_paused: this.is_capture_paused,

            // api_hasFavouriteGame: this.hasFavouriteGame(),
            // api_getUniqueGames: this.getUniqueGames().map((g) => g.toAPI()),
            // api_getWebhookDuration: this.getWebhookDuration(),
            // // api_getDuration: this.duration, // this.getDuration(),
            // api_getDuration: await this.getDuration(true),
            // api_getCapturingStatus: await this.getCapturingStatus(),
            api_getRecordingSize: this.getRecordingSize(),
            // api_getChatDumpStatus: await this.getChatDumpStatus(),
            // api_getDurationLive: this.getDurationLive(),
            // api_getConvertingStatus: await this.getConvertingStatus(),

            path_chat: this.path_chat,
            path_downloaded_vod: this.path_downloaded_vod,
            path_losslesscut: this.path_losslesscut,
            path_chatrender: this.path_chatrender,
            path_chatburn: this.path_chatburn,
            path_chatdump: this.path_chatdump,
            path_chatmask: this.path_chatmask,
            // path_adbreak: this.path_adbreak,
            path_playlist: this.path_playlist,

            duration_live: this.getDurationLive(),
            duration: this.duration || 0,

            total_size: this.total_size,

            chapters: this.chapters.map((c) => c.toAPI()),
            // chapters_raw: this.chapters_raw,

            webpath: this.webpath,

            video_metadata: this.video_metadata,

            stream_number: this.stream_number,
            stream_season: this.stream_season,
            stream_absolute_number: this.stream_absolute_number,
            stream_absolute_season: this.stream_absolute_season,

            comment: this.comment,

            prevent_deletion: this.prevent_deletion,

            failed: this.failed,

            bookmarks: this.bookmarks,

            viewers: this.viewers.map((v) => {
                return {
                    timestamp: v.timestamp.toISOString(),
                    amount: v.amount,
                };
            }),
            stream_pauses: this.stream_pauses.map((v) => {
                return {
                    start: v.start.toISOString(),
                    end: v.end.toISOString(),
                };
            }),

            // bookmarks: this.bookmarks,

            // game_offset: this.game_offset || 0,
            // twitch_vod_url: this.twitch_vod_url,
            // twitch_vod_exists: this.twitch_vod_exists,
            // twitch_vod_attempted: this.twitch_vod_attempted,
            // twitch_vod_neversaved: this.twitch_vod_neversaved,
            // video_fail2: this.video_fail2,
            // json_hash: this.json_hash,
            // created: this.created,
            // force_record: this.force_record,
            // automator_fail: this.automator_fail,
            // dt_started_at: this.dt_started_at ? TwitchHelper.JSDateToPHPDate(this.dt_started_at) : null,
            // dt_ended_at: this.dt_ended_at ? TwitchHelper.JSDateToPHPDate(this.dt_ended_at) : null,
        };
    }

    public async saveJSON(reason = ""): Promise<boolean> {
        if (!this.filename) {
            throw new Error("Filename not set.");
        }

        // if (!this.created && (this.is_capturing || this.is_converting || !this.is_finalized)) {
        //     TwitchlogAdvanced(LOGLEVEL.WARNING, "vod", `Saving JSON of ${this.basename} while not finalized!`);
        // }

        if (
            !this.not_started &&
            (!this.chapters || this.chapters.length == 0)
        ) {
            log(
                LOGLEVEL.WARNING,
                "vod",
                `Saving JSON of ${this.basename} with no chapters!!`
            );
        }

        /*
        if (!this.streamer_name && !this.created) {
            logAdvanced(LOGLEVEL.FATAL, "vod", `Found no streamer name in class of ${this.basename}, not saving!`);
            return false;
        }
        */

        // clone this.json
        const generated: YouTubeVODJSON =
            this.json && Object.keys(this.json).length > 0
                ? JSON.parse(JSON.stringify(this.json))
                : {};
        // const generated: TwitchVODJSON = Object.assign({}, this.json || {});

        generated.version = 2;
        generated.type = "youtube";
        generated.uuid = this.uuid;
        generated.capture_id = this.capture_id;
        // if (this.meta) generated.meta = this.meta;
        generated.stream_resolution = this.stream_resolution ?? undefined;

        // generated.streamer_name = this.streamer_name ?? "";
        // generated.streamer_id = this.streamer_id ?? "";
        // generated.streamer_login = this.streamer_login ?? "";
        if (this.channel_uuid) generated.channel_uuid = this.channel_uuid;

        // generated.chapters = this.chapters_raw;
        // generated.segments = this.segments_raw;
        generated.chapters = this.chapters.map((chapter) => chapter.toJSON());
        generated.segments = this.segments.map(
            (segment) => segment.filename || ""
        ); // hack?

        generated.is_capturing = this.is_capturing;
        generated.is_converting = this.is_converting;
        generated.is_finalized = this.is_finalized;

        generated.duration = this.duration ?? undefined;

        generated.video_metadata = this.video_metadata;

        generated.saved_at = new Date().toISOString();

        if (this.created_at)
            generated.created_at = this.created_at.toISOString();
        if (this.capture_started)
            generated.capture_started = this.capture_started.toISOString();
        if (this.capture_started2)
            generated.capture_started2 = this.capture_started2.toISOString();
        if (this.conversion_started)
            generated.conversion_started =
                this.conversion_started.toISOString();
        if (this.started_at)
            generated.started_at = this.started_at.toISOString();
        if (this.ended_at) generated.ended_at = this.ended_at.toISOString();

        generated.not_started = this.not_started;

        generated.stream_number = this.stream_number;
        generated.stream_season = this.stream_season;
        generated.stream_absolute_season = this.stream_absolute_season;
        generated.stream_absolute_number = this.stream_absolute_number;

        generated.comment = this.comment;

        generated.prevent_deletion = this.prevent_deletion;

        generated.failed = this.failed;

        generated.youtube_vod_id = this.youtube_vod_id;

        // generated.bookmarks = this.bookmarks;

        log(
            LOGLEVEL.SUCCESS,
            "vod",
            `Saving JSON of ${this.basename} ${
                reason ? " (" + reason + ")" : ""
            }`
        );

        //file_put_contents(this.filename, json_encode(generated));
        // this.setPermissions();

        await this.stopWatching();

        this._writeJSON = true;

        try {
            fs.writeFileSync(this.filename, JSON.stringify(generated, null, 4));
        } catch (error) {
            log(
                LOGLEVEL.FATAL,
                "vod",
                `Failed to save JSON of ${this.basename}: ${
                    (error as Error).message
                }`
            );
            console.log(
                chalk.bgRedBright.whiteBright(
                    `Failed to save JSON of ${this.basename}: ${
                        (error as Error).message
                    }`
                )
            );
            return false;
        }

        this._writeJSON = false;

        await this.startWatching();

        this.broadcastUpdate(); // should this be here?

        return true;
    }

    public setupProvider(): void {
        if (!this.json) {
            throw new Error("No JSON loaded for provider setup!");
        }

        this.youtube_vod_id = this.json.youtube_vod_id;
    }

    public async setupUserData(): Promise<void> {
        if (!this.json) {
            throw new Error("No JSON loaded for user data setup!");
        }

        if (this.json.channel_uuid) {
            this.channel_uuid = this.json.channel_uuid;
        } else {
            log(
                LOGLEVEL.ERROR,
                "vod",
                `No channel UUID for VOD ${this.basename}`
            );
        }
    }

    public static async load(
        filename: string,
        noFixIssues = false
    ): Promise<YouTubeVOD> {
        const basename = path.basename(filename);

        // check if file exists
        if (!fs.existsSync(filename)) {
            throw new Error("VOD JSON does not exist: " + filename);
        }

        // load file
        const data = fs.readFileSync(filename, "utf8");
        if (data.length == 0) {
            throw new Error("File is empty: " + filename);
        }

        // parse file
        const json: VODJSON = JSON.parse(data);

        if (json.capture_id) {
            const cached_vod = this.getVodByCaptureId(json.capture_id);
            if (cached_vod) {
                console.log(`[TwitchVOD] Returning cached vod ${basename}`);
                return cached_vod;
            }
        }

        // create object
        const vod = new YouTubeVOD();

        vod.uuid = json.uuid || "";
        vod.capture_id = json.capture_id || "";
        vod.filename = filename;
        vod.basename = path.basename(filename, ".json");
        vod.directory = path.dirname(filename);

        vod.json = json;

        vod.setupDates();
        await vod.setupUserData();
        vod.setupBasic();
        vod.setupProvider();
        await vod.setupAssoc();
        await vod.setupFiles();

        // add to cache
        this.addVod(vod);

        await vod.startWatching();

        if (!noFixIssues) {
            let noIssues = false;
            do {
                noIssues = await vod.fixIssues("VOD load");
            } while (!noIssues);
        }

        if (!vod.not_started && !vod.is_finalized) {
            log(
                LOGLEVEL.WARNING,
                "vod",
                `Loaded VOD ${vod.basename} is not finalized!`
            );
        }

        // vod.compareDumpedChatAndDownloadedChat();
        // vod.getFFProbe();

        vod.loaded = true;

        return vod;
    }

    public static getVodByCaptureId(
        capture_id: string
    ): YouTubeVOD | undefined {
        return LiveStreamDVR.getInstance()
            .getVods()
            .find<YouTubeVOD>(
                (vod): vod is YouTubeVOD =>
                    isYouTubeVOD(vod) && vod.capture_id == capture_id
            );
    }

    public static getVodByProviderId(
        provider_id: string
    ): YouTubeVOD | undefined {
        return LiveStreamDVR.getInstance()
            .getVods()
            .find<YouTubeVOD>(
                (vod): vod is YouTubeVOD =>
                    isYouTubeVOD(vod) && vod.youtube_vod_id == provider_id
            );
    }

    static async getVideosProxy(
        channel_id: string
    ): Promise<false | ProxyVideo[]> {
        if (!channel_id) throw new Error("No channel id");

        const service = new youtube_v3.Youtube({
            auth: YouTubeHelper.oAuth2Client,
        });

        let searchResponse;
        try {
            searchResponse = await service.search.list({
                channelId: channel_id,
                order: "date",
                type: ["video"],
                part: ["snippet"],
            });
        } catch (error) {
            log(
                LOGLEVEL.WARNING,
                "helper",
                `Channel video search for ${channel_id} error: ${
                    (error as Error).message
                }`
            );
            return false;
        }

        // console.log(searchResponse.data);

        if (!searchResponse.data) return false;
        if (!searchResponse.data.items || searchResponse.data.items.length == 0)
            return false;

        const ids: string[] = [];
        searchResponse.data.items.forEach((item) => {
            if (item && item.id && item.id.videoId) ids.push(item.id.videoId);
        });

        console.log("ids", ids);

        let videosResponse;
        try {
            videosResponse = await service.videos.list({
                id: ids,
                part: ["contentDetails"],
            });
        } catch (error) {
            log(
                LOGLEVEL.WARNING,
                "helper",
                `Channel video details for ${channel_id} error: ${
                    (error as Error).message
                }`
            );
            return false;
        }

        if (!videosResponse.data) return false;
        if (!videosResponse.data.items || videosResponse.data.items.length == 0)
            return false;

        const details: Record<string, youtube_v3.Schema$VideoContentDetails> =
            {};
        videosResponse.data.items.forEach((item) => {
            if (!item.id || !item.contentDetails) return;
            details[item.id] = item.contentDetails;
        });

        // durations[item.id] = item.contentDetails?.duration ? Helper.parseYouTubeDuration(item.contentDetails?.duration) : -1;

        return searchResponse.data.items.map((item) => {
            return {
                id: item.id?.videoId,
                title: item.snippet?.title,
                description: item.snippet?.description,
                url: `https://www.youtube.com/watch?v=${item.id?.videoId}`,
                thumbnail: item.snippet?.thumbnails?.default?.url,
                created_at: item.snippet?.publishedAt,
                duration: item.id?.videoId
                    ? YouTubeHelper.parseYouTubeDuration(
                          details[item.id?.videoId].duration || ""
                      )
                    : -1,
                view_count: -1, // what
            } as ProxyVideo;
        });
    }

    static async getVideo(
        video_id: string
    ): Promise<false | youtube_v3.Schema$Video> {
        const service = new youtube_v3.Youtube({
            auth: YouTubeHelper.oAuth2Client,
        });

        let searchResponse;
        try {
            searchResponse = await service.videos.list({
                id: [video_id],
                part: ["contentDetails", "snippet"],
            });
        } catch (error) {
            log(
                LOGLEVEL.WARNING,
                "helper",
                `Channel video details for ${video_id} error: ${
                    (error as Error).message
                }`
            );
            return false;
        }

        if (!searchResponse.data) return false;
        if (!searchResponse.data.items || searchResponse.data.items.length == 0)
            return false;

        return searchResponse.data.items[0];
    }

    static async getVideoProxy(video_id: string): Promise<false | ProxyVideo> {
        const item = await this.getVideo(video_id);

        if (!item) return false;

        return {
            id: item.id,
            title: item.snippet?.title,
            description: item.snippet?.description,
            url: `https://www.youtube.com/watch?v=${item.id}`,
            thumbnail: item.snippet?.thumbnails?.default?.url,
            created_at: item.snippet?.publishedAt,
            duration: item.contentDetails?.duration
                ? YouTubeHelper.parseYouTubeDuration(
                      item.contentDetails?.duration
                  )
                : -1,
            view_count: -1, // what
            stream_id: item.id,
        } as ProxyVideo;
    }

    static async downloadVideo(
        video_id: string,
        quality: VideoQuality,
        filename: string
    ): Promise<string> {
        log(LOGLEVEL.INFO, "channel", `Download VOD ${video_id}`);

        const video = await this.getVideoProxy(video_id);

        if (!video) {
            log(LOGLEVEL.ERROR, "channel", `Failed to get video ${video_id}`);
            throw new Error(`Failed to get video ${video_id}`);
        }

        const basename = path.basename(filename);

        const capture_filename = path.join(
            BaseConfigCacheFolder.cache,
            `${video_id}.ts`
        );
        const converted_filename = filename;

        if (!fs.existsSync(converted_filename)) {
            const video_url = video.url;

            const ytdl_bin = Helper.path_youtubedl();

            if (!ytdl_bin) {
                log(LOGLEVEL.ERROR, "channel", "Failed to find ytdl binary!");
                throw new Error("Failed to find ytdl binary!");
            }

            const cmd = [];

            cmd.push(video_url);

            cmd.push("-f", "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4] / bv*+ba/b");

            cmd.push("-o", converted_filename);

            log(LOGLEVEL.INFO, "channel", `Downloading VOD ${video_id}...`);

            const ret = await execAdvanced(
                ytdl_bin,
                cmd,
                `download_vod_${video_id}`,
                (log_line: string) => {
                    const progressMatch = log_line.match(/([\d.]+)%/);
                    if (progressMatch) {
                        const progress = parseFloat(progressMatch[1]);
                        return progress / 100;
                    }
                }
            );
        }

        const successful =
            fs.existsSync(converted_filename) &&
            fs.statSync(converted_filename).size > 0;

        if (!successful) {
            log(
                LOGLEVEL.ERROR,
                "channel",
                `Failed to download VOD ${video_id}`
            );
            throw new Error(`Failed to download VOD ${video_id}`);
        }

        log(LOGLEVEL.INFO, "channel", `Downloaded VOD ${video_id}`);

        return converted_filename;
    }

    public async finalize(): Promise<boolean> {
        log(
            LOGLEVEL.INFO,
            "vod.finalize",
            `Finalize ${this.basename} @ ${this.directory}`
        );
        try {
            await this.getMediainfo();
        } catch (error) {
            log(
                LOGLEVEL.ERROR,
                "vod.finalize",
                `Failed to get mediainfo for ${this.basename}: ${error}`
            );
        }

        this.is_finalized = true;
        return true;
    }

    public getChannel(): YouTubeChannel {
        if (!this.channel_uuid)
            throw new Error("No channel UUID set for getChannel");
        // return YouTubeChannel.getChannelByLogin(this.streamer_login);
        const channel =
            LiveStreamDVR.getInstance().getChannelByUUID<YouTubeChannel>(
                this.channel_uuid
            );
        if (!channel)
            throw new Error(
                `No channel found for getChannel (uuid: ${this.channel_uuid})`
            );
        return channel;
    }
}
