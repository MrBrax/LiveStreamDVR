import { VideoQuality } from "../../../common/Config";
import { EventSubResponse } from "../../../common/TwitchAPI/EventSub";
import { MuteStatus } from "../../../common/Defs";
import { AudioMetadata, VideoMetadata } from "../../../common/MediaInfo";

export interface VODJSON {

    version: number;
    type: string;

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

    stream_number?: number;

    comment?: string;

    prevent_deletion: boolean;

}
export interface TwitchVODJSON extends VODJSON {

    version: number;
    type: "twitch";

    capture_id?: string;

    meta?: EventSubResponse;

    streamer_name: string;
    streamer_id: string;
    streamer_login: string;

    chapters: TwitchVODChapterJSON[];

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

export interface TwitchVODChapterJSON {

    started_at: string;
    title: string;

    game_id?: string;
    game_name?: string;
    box_art_url?: string;

    is_mature: boolean;
    online: boolean; // ?
    viewer_count?: number;

    // offset: number;
    // duration: number;

}