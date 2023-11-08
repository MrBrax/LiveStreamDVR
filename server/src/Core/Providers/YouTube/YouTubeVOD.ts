import { BaseConfigCacheFolder } from "@/Core/BaseConfig";
import { Helper } from "@/Core/Helper";
import { LiveStreamDVR } from "@/Core/LiveStreamDVR";
import { log, LOGLEVEL } from "@/Core/Log";
import { execAdvanced } from "@/Helpers/Execute";
import { isYouTubeVOD } from "@/Helpers/Types";
import { YouTubeHelper } from "@/Providers/YouTube";
import type { VODJSON, YouTubeVODJSON } from "@/Storage/JSON";
import type { ApiYouTubeVod } from "@common/Api/Client";
import type { VideoQuality } from "@common/Config";
import type { Providers } from "@common/Defs";
import type { ProxyVideo } from "@common/Proxies/Video";
import { youtube_v3 } from "@googleapis/youtube";
import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";
import { BaseVOD } from "../Base/BaseVOD";
import type { BaseVODChapter } from "../Base/BaseVODChapter";
import type { YouTubeChannel } from "./YouTubeChannel";

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
        return await Promise.resolve({
            ...(await super.toAPI()),
            provider: "youtube",
            // uuid: this.uuid,
            // channel_uuid: this.channel_uuid,
            // basename: this.basename || "",

            // stream_title: this.stream_title,
            // stream_resolution: this.stream_resolution,

            segments: this.segments.map((s) => s.toAPI()),
            segments_raw: this.segments_raw,

            streamer_name: this.streamer_name || "",
            streamer_id: this.streamer_id || "",
            // streamer_login: this.streamer_login || "",

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

            chapters: this.chapters.map((c) => c.toAPI()),
        });
    }

    public async toJSON(): Promise<YouTubeVODJSON> {
        const generated = (await super.toJSON()) as YouTubeVODJSON;

        generated.version = 2;
        generated.type = "youtube";

        generated.chapters = this.chapters.map((chapter) => chapter.toJSON());
        generated.segments = this.segments.map(
            (segment) => segment.filename || ""
        ); // hack?

        generated.youtube_vod_id = this.youtube_vod_id;

        return await Promise.resolve(generated);
    }

    public async saveJSON(reason = ""): Promise<boolean> {
        if (!this.filename) {
            throw new Error("Filename not set.");
        }

        if (
            !this.not_started &&
            (!this.chapters || this.chapters.length == 0)
        ) {
            log(
                LOGLEVEL.WARNING,
                "vod.saveJSON",
                `Saving JSON of ${this.basename} with no chapters!!`
            );
        }

        await super.saveJSON(reason);

        const generated = await this.toJSON();

        log(
            LOGLEVEL.SUCCESS,
            "vod.saveJSON",
            `Saving JSON of ${this.basename} ${
                reason ? " (" + reason + ")" : ""
            }`
        );

        await this.stopWatching();

        this._writeJSON = true;

        try {
            fs.writeFileSync(this.filename, JSON.stringify(generated, null, 4));
        } catch (error) {
            log(
                LOGLEVEL.FATAL,
                "vod.saveJSON",
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
                "vod.setupUserData",
                `No channel UUID for VOD ${this.basename}`
            );
        }

        return await Promise.resolve();
    }

    public async migrate(): Promise<boolean> {
        if (!this.json) {
            throw new Error("No JSON loaded for migration!");
        }

        let migrated = false;

        if (this.youtube_vod_id && !this.json.external_vod_id) {
            this.json.external_vod_id = this.youtube_vod_id;
            migrated = true;
        }

        return await Promise.resolve(migrated);
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
                "vod.load",
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
                "vod.getVideosProxy",
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
                "vod.getVideosProxy",
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
                "vod.getVideo",
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
        log(LOGLEVEL.INFO, "vod.downloadVideo", `Download VOD ${video_id}`);

        const video = await this.getVideoProxy(video_id);

        if (!video) {
            log(
                LOGLEVEL.ERROR,
                "vod.downloadVideo",
                `Failed to get video ${video_id}`
            );
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
                log(
                    LOGLEVEL.ERROR,
                    "channel.downloadVideo",
                    "Failed to find ytdl binary!"
                );
                throw new Error("Failed to find ytdl binary!");
            }

            const cmd = [];

            cmd.push(video_url);

            cmd.push("-f", "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4] / bv*+ba/b");

            cmd.push("-o", converted_filename);

            log(
                LOGLEVEL.INFO,
                "channel.downloadVideo",
                `Downloading VOD ${video_id}...`
            );

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
                "channel.downloadVideo",
                `Failed to download VOD ${video_id}`
            );
            throw new Error(`Failed to download VOD ${video_id}`);
        }

        log(
            LOGLEVEL.INFO,
            "channel.downloadVideo",
            `Downloaded VOD ${video_id}`
        );

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
