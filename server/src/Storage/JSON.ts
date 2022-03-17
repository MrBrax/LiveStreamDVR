export interface TwitchVODJSON {

    /*
    meta: EventSubResponse | undefined;

    stream_resolution: string;

    streamer_name: string | undefined;
    streamer_id: string | undefined;
    streamer_login: string | undefined;

    chapters_raw: TwitchVODChapterMinimalJSON[];
    chapters: TwitchVODChapterJSON[];

    segments_raw: string[];
    segments: TwitchVODSegmentJSON[];

    ads: AdBreak[];

    is_capturing: boolean;
    is_converting: boolean;
    is_finalized: boolean;
    duration_seconds: number | undefined;
    video_metadata?: MediaInfo;
    video_fail2?: boolean;
    force_record?: boolean;
    automator_fail?: boolean;
    saved_at?: PHPDateTimeProxy;
    dt_capture_started?: PHPDateTimeProxy;
    dt_conversion_started?: PHPDateTimeProxy;
    dt_started_at?: PHPDateTimeProxy;
    dt_ended_at?: PHPDateTimeProxy;
    capture_id: string | undefined;

    twitch_vod_id: number | undefined;
    twitch_vod_url: string | undefined;
    twitch_vod_duration: number | undefined;
    twitch_vod_title: string | undefined;
    twitch_vod_date: string | undefined; // Date
    twitch_vod_exists?: boolean | null;
    twitch_vod_attempted?: boolean | null;
    twitch_vod_neversaved?: boolean | null;
    twitch_vod_muted?: MUTE_STATUS | boolean | null;
    twitch_vod_status?: EXIST_STATUS;
    */

    version: number;

    capture_id: string;

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
    twitch_vod_muted?: MUTE_STATUS;
    twitch_vod_status?: EXIST_STATUS;

}

export interface TwitchVODChapterJSON {
    started_at: string;
    game_id: string;
    game_name: string;
    title: string;
    is_mature: boolean;
    online: boolean; // ?
    viewer_count?: number;
    offset: number;
    duration: number;
    box_art_url: string;
}