import path from "path";
import fs from "fs";
import { ApiYouTubeVod } from "../../../../../common/Api/Client";
import { ProxyVideo } from "../../../../../common/Proxies/Video";
import { BaseVOD } from "../Base/BaseVOD";
import { VODJSON } from "../../../Storage/JSON";
import { Log, LOGLEVEL } from "../../../Core/Log";
import { LiveStreamDVR } from "../../../Core/LiveStreamDVR";
import { BaseVODChapter } from "../Base/BaseVODChapter";
import { youtube_v3 } from "@googleapis/youtube";
import { YouTubeHelper } from "Providers/YouTube";
import { Helper } from "Core/Helper";

export class YouTubeVOD extends BaseVOD {

    streamer_name = "";
    streamer_id = "";

    chapters: Array<BaseVODChapter> = [];

    public async toAPI(): Promise<ApiYouTubeVod> {
        return {
            provider: "youtube",
            uuid: this.uuid || "",
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
            capture_started: this.capture_started ? this.capture_started.toISOString() : undefined,
            capture_started2: this.capture_started2 ? this.capture_started2.toISOString() : undefined,
            conversion_started: this.conversion_started ? this.conversion_started.toISOString() : undefined,

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
            // api_getRecordingSize: this.getRecordingSize(),
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
            path_adbreak: this.path_adbreak,
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

            comment: this.comment,

            prevent_deletion: this.prevent_deletion,

            failed: this.failed,

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

    public static async load(filename: string, noFixIssues = false): Promise<YouTubeVOD> {

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
        vod.setupFiles();

        // add to cache
        this.addVod(vod);

        await vod.startWatching();

        if (!noFixIssues) await vod.fixIssues();

        if (!vod.not_started && !vod.is_finalized) {
            Log.logAdvanced(LOGLEVEL.WARNING, "vodclass", `Loaded VOD ${vod.basename} is not finalized!`);
        }

        // vod.compareDumpedChatAndDownloadedChat();
        // vod.getFFProbe();

        vod.loaded = true;

        return vod;

    }

    public static getVodByCaptureId(capture_id: string): YouTubeVOD | undefined {
        return LiveStreamDVR.getInstance().vods.find<YouTubeVOD>((vod): vod is YouTubeVOD => vod instanceof YouTubeVOD && vod.capture_id == capture_id);
    }

    static async getVideosProxy(channel_id: string): Promise<false | ProxyVideo[]> {
        if (!channel_id) throw new Error("No channel id");

        const service = new youtube_v3.Youtube({ auth: YouTubeHelper.oAuth2Client });

        let searchResponse;
        try {
            searchResponse = await service.search.list({
                channelId: channel_id,
                order: "date",
                type: ["video"],
                part: ["snippet"],
            });
        } catch (error) {
            Log.logAdvanced(LOGLEVEL.WARNING, "helper", `Channel video search for ${channel_id} error: ${(error as Error).message}`);
            return false;
        }

        // console.log(searchResponse.data);

        if (!searchResponse.data) return false;
        if (!searchResponse.data.items || searchResponse.data.items.length == 0) return false;
        
        const ids: string[] = [];
        searchResponse.data.items.forEach(item => {
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
            Log.logAdvanced(LOGLEVEL.WARNING, "helper", `Channel video details for ${channel_id} error: ${(error as Error).message}`);
            return false;
        }

        if (!videosResponse.data) return false;
        if (!videosResponse.data.items || videosResponse.data.items.length == 0) return false;

        const details: Record<string, youtube_v3.Schema$VideoContentDetails> = {};
        videosResponse.data.items.forEach((item) => {
            if (!item.id || !item.contentDetails) return;
            details[item.id] = item.contentDetails;
        });

        // durations[item.id] = item.contentDetails?.duration ? Helper.parseYouTubeDuration(item.contentDetails?.duration) : -1;

        return searchResponse.data.items.map(item => {
            return {
                id: item.id?.videoId,
                title: item.snippet?.title,
                description: item.snippet?.description,
                url: `https://www.youtube.com/watch?v=${item.id?.videoId}`,
                thumbnail: item.snippet?.thumbnails?.default?.url,
                created_at: item.snippet?.publishedAt,
                duration: item.id?.videoId ? Helper.parseYouTubeDuration(details[item.id?.videoId].duration || "") : -1,
                view_count: -1, // what
            } as ProxyVideo;
        });

    }

}