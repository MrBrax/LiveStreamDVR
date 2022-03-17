import { VideoQuality } from "../../../common/Config";
import { MediaInfo } from "../../../common/mediainfofield";
import { EventSubResponse } from "../../../common/TwitchAPI/EventSub";
import { ExistStatus, MuteStatus } from "../../../common/Vod";

export interface TwitchVODJSON {

    version: number;

    capture_id?: string;

    meta?: EventSubResponse;

    stream_resolution: VideoQuality | undefined;
    
    streamer_name: string;
    streamer_id: string;
    streamer_login: string;

    chapters: TwitchVODChapterJSON[];
    segments: string[];

    is_capturing: boolean;
    is_converting: boolean;
    is_finalized: boolean;

    duration: number;

    video_metadata?: MediaInfo;

    saved_at: string;

    capture_started?: string;
    conversion_started?: string;
    started_at: string;
    ended_at: string;

    twitch_vod_id?: string;
    twitch_vod_duration?: number
    twitch_vod_title?: string;
    twitch_vod_date?: string;
    twitch_vod_muted?: MuteStatus;
    twitch_vod_status?: ExistStatus;

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