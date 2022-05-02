import { useStore } from "../store";
import { ApiVod } from "../../../common/Api/Client";
import { JobStatus, MuteStatus } from "../../../common/Defs";
import { AudioMetadata, VideoMetadata } from "../../../common/MediaInfo";
import TwitchChannel from "./channel";
import { TwitchVODChapter } from "./chapter";
// import { useStore } from "../store";
import { TwitchGame } from "./game";
import { TwitchHelper } from "./helper";
import { TwitchVODSegment } from "./segment";

// const store = useStore();

export default class TwitchVOD {
    basename = "";

    is_capturing = false;
    is_converting = false;
    is_finalized = false;

    created_at?: Date;
    started_at?: Date;
    ended_at?: Date;
    saved_at?: Date;
    capture_started?: Date;
    capture_started2?: Date;
    conversion_started?: Date;

    segments: TwitchVODSegment[] = [];
    chapters: TwitchVODChapter[] = [];

    video_metadata: VideoMetadata | AudioMetadata | undefined;

    duration = 0;

    twitch_vod_id: string | undefined;
    twitch_vod_duration: number | undefined;
    twitch_vod_exists: boolean | undefined;
    twitch_vod_date: Date | undefined;
    twitch_vod_title: string | undefined;
    twitch_vod_muted: MuteStatus | undefined = MuteStatus.UNKNOWN;

    is_chat_downloaded = false;
    is_chatdump_captured = false;
    is_chat_rendered = false;
    is_chat_burned = false;
    is_vod_downloaded = false;
    is_lossless_cut_generated = false;
    is_capture_paused = false;

    stream_resolution: string | undefined = "";
    stream_title = "";

    streamer_login = "";
    streamer_id = "";

    webpath = "";

    convertingStatus: JobStatus = JobStatus.NONE;
    capturingStatus: JobStatus = JobStatus.NONE;
    chatDumpStatus: JobStatus = JobStatus.NONE;
    recordingSize: number | false = 0;

    total_size = 0;

    public static makeFromApiResponse(apiResponse: ApiVod): TwitchVOD {
        const vod = new TwitchVOD();
        vod.basename = apiResponse.basename;
        vod.is_capturing = apiResponse.is_capturing;
        vod.is_converting = apiResponse.is_converting;
        vod.is_finalized = apiResponse.is_finalized;
        vod.segments = apiResponse.segments.map((seg) => TwitchVODSegment.makeFromApiResponse(seg));
        vod.chapters = apiResponse.chapters.map((chap) => TwitchVODChapter.makeFromApiResponse(chap));
        vod.video_metadata = apiResponse.video_metadata;
        vod.created_at = apiResponse.created_at ? new Date(apiResponse.created_at) : undefined;
        vod.started_at = apiResponse.started_at ? new Date(apiResponse.started_at) : undefined;
        vod.ended_at = apiResponse.ended_at ? new Date(apiResponse.ended_at) : undefined;
        vod.saved_at = apiResponse.saved_at ? new Date(apiResponse.saved_at) : undefined;
        vod.capture_started = apiResponse.capture_started ? new Date(apiResponse.capture_started) : undefined;
        vod.capture_started2 = apiResponse.capture_started2 ? new Date(apiResponse.capture_started2) : undefined;
        vod.conversion_started = apiResponse.conversion_started ? new Date(apiResponse.conversion_started) : undefined;
        vod.duration = apiResponse.duration;
        vod.twitch_vod_id = apiResponse.twitch_vod_id;
        vod.twitch_vod_duration = apiResponse.twitch_vod_duration;
        vod.twitch_vod_exists = apiResponse.twitch_vod_exists;
        vod.twitch_vod_date = apiResponse.twitch_vod_date ? new Date(apiResponse.twitch_vod_date) : undefined;
        vod.twitch_vod_title = apiResponse.twitch_vod_title;
        vod.twitch_vod_muted = apiResponse.twitch_vod_muted;
        vod.is_chat_downloaded = apiResponse.is_chat_downloaded;
        vod.is_chatdump_captured = apiResponse.is_chatdump_captured;
        vod.is_chat_rendered = apiResponse.is_chat_rendered;
        vod.is_chat_burned = apiResponse.is_chat_burned;
        vod.is_vod_downloaded = apiResponse.is_vod_downloaded;
        vod.is_lossless_cut_generated = apiResponse.is_lossless_cut_generated;
        vod.is_capture_paused = apiResponse.is_capture_paused;
        vod.stream_resolution = apiResponse.stream_resolution;
        vod.stream_title = apiResponse.stream_title;
        vod.streamer_login = apiResponse.streamer_login;
        vod.streamer_id = apiResponse.streamer_id;
        vod.webpath = apiResponse.webpath;
        vod.convertingStatus = apiResponse.api_getConvertingStatus;
        vod.recordingSize = apiResponse.api_getRecordingSize;
        vod.capturingStatus = apiResponse.api_getCapturingStatus;
        vod.chatDumpStatus = apiResponse.api_getChatDumpStatus;
        vod.total_size = apiResponse.total_size;
        return vod;
    }

    public hasFavouriteGame() {
        return this.chapters.some((chapter) => chapter.game?.isFavourite());
    }

    public getUniqueGames(): TwitchGame[] {
        const games: TwitchGame[] = [];
        this.chapters.forEach((chapter) => {
            if (chapter.game && !games.find((g) => chapter.game?.id == g.id)) games.push(chapter.game);
        });
        return games;
    }

    public getWebhookDuration(): string | undefined {
        if (this.started_at && this.ended_at) {
            // format is H:i:s
            const diff_seconds = (this.ended_at.getTime() - this.started_at.getTime()) / 1000;
            return TwitchHelper.formatDuration(diff_seconds);
        } else {
            return undefined;
        }
    }

    public getDuration() {
        return this.duration;
    }

    public getConvertingStatus() {
        return this.convertingStatus;
    }

    public getCapturingStatus() {
        return this.capturingStatus;
    }

    public getChatDumpStatus() {
        return this.chatDumpStatus;
    }

    public getRecordingSize() {
        return this.recordingSize;
    }

    public getDurationLive(): number | false {
        if (!this.started_at) return false;
        const now = new Date();
        return Math.abs((this.started_at.getTime() - now.getTime()) / 1000);
    }

    public getChannel(): TwitchChannel | undefined {
        const store = useStore();
        return store.streamerList.find((streamer) => streamer.userid == this.streamer_id);
    }

    get current_game(): TwitchGame | undefined {
        if (this.chapters.length > 0) {
            return this.chapters[this.chapters.length - 1].game;
        } else {
            return undefined;
        }
    }

    get current_chapter(): TwitchVODChapter | undefined {
        if (this.chapters.length > 0) {
            return this.chapters[this.chapters.length - 1];
        } else {
            return undefined;
        }
    }
}
