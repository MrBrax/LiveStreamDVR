import type { VideoQuality } from "@common/Config";
import type { EventSubResponse } from "@common/TwitchAPI/EventSub";
import type { MuteStatus, Providers } from "@common/Defs";
import type { AudioMetadata, VideoMetadata } from "@common/MediaInfo";
import type { TwitchVODBookmark } from "@common/Bookmark";
import type { ExportData } from "@common/Exporter";
import type { VodViewerEntry, StreamPause } from "@common/Vod";

export interface VODJSON {

    version: number;
    type: Providers;

    uuid?: string;
    capture_id?: string;
    channel_uuid: string;

    chapters: BaseVODChapterJSON[];

    stream_resolution: VideoQuality | undefined;

    segments: string[];

    is_capturing: boolean;
    is_converting: boolean;
    is_finalized: boolean;

    duration: number;

    // video_metadata?: MediaInfo;
    video_metadata?: VideoMetadata | AudioMetadata;

    saved_at: string;

    created_at?: string;
    capture_started?: string;
    capture_started2?: string;
    conversion_started?: string;
    started_at: string;
    ended_at: string;

    not_started: boolean;

    /** TODO: rename number to episode? */
    stream_number?: number;
    stream_season?: string;
    stream_absolute_season?: number;
    stream_absolute_number?: number;

    comment?: string;

    prevent_deletion: boolean;
    failed?: boolean;

    cloud_storage?: boolean;

    export_data?: ExportData;

    // viewers?: VodViewerEntry[];
    viewers?: { timestamp: string; amount: number }[];
    // stream_pauses?: StreamPause[];
    stream_pauses?: { start?: string; end?: string }[];

}
export interface TwitchVODJSON extends VODJSON {
    type: "twitch";

    meta?: EventSubResponse;

    streamer_name: string;
    streamer_id: string;
    streamer_login: string;

    chapters: TwitchVODChapterJSON[];
    bookmarks: TwitchVODBookmark[];

    twitch_vod_id?: string;
    twitch_vod_duration?: number
    twitch_vod_title?: string;
    twitch_vod_date?: string;
    twitch_vod_muted?: MuteStatus;
    // twitch_vod_status?: ExistStatus;
    twitch_vod_neversaved?: boolean;
    twitch_vod_exists?: boolean;
    twitch_vod_attempted?: boolean;

}

export interface YouTubeVODJSON extends VODJSON {
    channel_id?: string;
    youtube_vod_id?: string;
}

export interface BaseVODChapterJSON {
    started_at: string;
    title: string;
    online: boolean; // ?
}

export interface TwitchVODChapterJSON extends BaseVODChapterJSON {
    game_id?: string;
    game_name?: string;
    box_art_url?: string;
    is_mature: boolean;
    viewer_count?: number;
    // offset: number;
    // duration: number;
}