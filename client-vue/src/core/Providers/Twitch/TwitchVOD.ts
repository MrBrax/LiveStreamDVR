import { useStore } from "../../../store";
import { MuteStatus } from "../../../../../common/Defs";
import TwitchChannel from "./TwitchChannel";
import { TwitchVODChapter } from "./TwitchVODChapter";
// import { useStore } from "../store";
import { TwitchGame } from "./TwitchGame";
import { TwitchHelper } from "../../helper";
import { BaseVODSegment } from "../Base/BaseVODSegment";
import { TwitchVODBookmark } from "@common/Bookmark";
import BaseVOD from "../Base/BaseVOD";
import { ApiTwitchVod } from "@common/Api/Client";

// const store = useStore();

export default class TwitchVOD extends BaseVOD {
    readonly provider = "twitch";
    // segments: BaseVODSegment[] = [];
    chapters: TwitchVODChapter[] = [];
    bookmarks: TwitchVODBookmark[] = [];

    twitch_vod_id: string | undefined;
    twitch_vod_duration: number | undefined;
    twitch_vod_exists: boolean | undefined;
    twitch_vod_date: Date | undefined;
    twitch_vod_title: string | undefined;
    twitch_vod_muted: MuteStatus | undefined = MuteStatus.UNKNOWN;

    stream_resolution: string | undefined = "";
    stream_title = "";

    /** @deprecated */
    streamer_login = "";

    /** @deprecated */
    streamer_id = "";


    public static makeFromApiResponse(apiResponse: ApiTwitchVod): TwitchVOD {
        const vod = new TwitchVOD();
        vod.uuid = apiResponse.uuid;
        vod.channel_uuid = apiResponse.channel_uuid;
        vod.basename = apiResponse.basename;
        vod.is_capturing = apiResponse.is_capturing;
        vod.is_converting = apiResponse.is_converting;
        vod.is_finalized = apiResponse.is_finalized;
        vod.segments = apiResponse.segments.map((seg) => BaseVODSegment.makeFromApiResponse(seg));
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
        vod.stream_number = apiResponse.stream_number;
        vod.stream_season = apiResponse.stream_season;
        vod.stream_absolute_season = apiResponse.stream_absolute_season;
        vod.comment = apiResponse.comment;
        vod.prevent_deletion = apiResponse.prevent_deletion;
        vod.failed = apiResponse.failed || false;
        vod.bookmarks = apiResponse.bookmarks || [];
        vod.cloud_storage = apiResponse.cloud_storage || false;
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

    public getDurationLive(): number | false {
        if (!this.started_at) return false;
        const now = new Date();
        return Math.abs((this.started_at.getTime() - now.getTime()) / 1000);
    }

    public getChannel(): TwitchChannel {
        const store = useStore();
        const streamer = store.streamerList.find<TwitchChannel>((streamer): streamer is TwitchChannel => streamer.uuid == this.channel_uuid);
        if (!streamer) {
            throw new Error("No streamer for vod");
        }
        return streamer;
    }

    get current_game(): TwitchGame | undefined {
        if (this.chapters.length > 0) {
            return this.chapters[this.chapters.length - 1].game;
        } else {
            return undefined;
        }
    }

    public getTitle() {
        if (this.twitch_vod_title) {
            return this.twitch_vod_title;
        }
        if (this.chapters && this.chapters.length > 0) {
            return this.chapters[0].title;
        }
        return this.basename;
    }

}
