import { MediaInfo, MediaInfoPublic } from "../mediainfofield";
import { VideoQuality } from "../Config";
import { ChannelData } from "../Channel";
import { MuteStatus, ExistStatus, JobStatus } from "../../common/Defs";
import { AudioMetadata, VideoMetadata } from "../MediaInfo";
import { BroadcasterType } from "../TwitchAPI/Users";

export type ApiVodSegment = {
    basename: string;
    filesize: number;
    deleted: boolean;
};

export type ApiVodChapter = {
    title: string;

    game_id?: string;
    game_name?: string;
    game?: ApiGame;
    box_art_url?: string;

    strings: Record<string, string>;
    duration: number;

    started_at: string;
    // datetime: PHPDateTimeJSON;
    offset: number;
    viewer_count?: number;
    // width: number; // why
    is_mature: boolean;
};

export type ApiGame = {
    id: string;
    name: string;
    game_name: string;
    box_art_url: string;
    favourite: boolean;
    image_url: string;
    added: string;
};

export type ApiVod = {
    basename: string;

    stream_title: string;
    stream_resolution?: VideoQuality;

    segments: ApiVodSegment[];
    segments_raw: string[];

    streamer_name: string;
    streamer_id: string;
    streamer_login: string;

    twitch_vod_duration?: number;
    twitch_vod_muted?: MuteStatus;
    twitch_vod_status?: ExistStatus;
    twitch_vod_id?: string;
    twitch_vod_date?: string;
    twitch_vod_title?: string;

    twitch_vod_neversaved?: boolean;
    twitch_vod_exists?: boolean;
    twitch_vod_attempted?: boolean;

    created_at?: string;
    saved_at?: string;
    started_at: string;
    ended_at?: string;
    capture_started?: string;
    capture_started2?: string;
    conversion_started?: string;

    is_capturing: boolean;
    is_converting: boolean;
    is_converted: boolean;
    is_finalized: boolean;

    is_chat_downloaded: boolean;
    is_chatdump_captured: boolean;
    is_chat_rendered: boolean;
    is_chat_burned: boolean;
    is_vod_downloaded: boolean;
    is_capture_paused: boolean;
    is_lossless_cut_generated: boolean;

    api_hasFavouriteGame: boolean;
    api_getUniqueGames: ApiGame[];
    api_getWebhookDuration?: string;
    api_getDuration: number | null;
    api_getCapturingStatus: JobStatus;
    api_getConvertingStatus: JobStatus;
    api_getRecordingSize: number | false;
    api_getChatDumpStatus: JobStatus;
    api_getDurationLive: number | false;

    path_chat: string;
    path_downloaded_vod: string;
    path_losslesscut: string;
    path_chatrender: string;
    path_chatburn: string;
    path_chatdump: string;
    path_chatmask: string;
    path_adbreak: string;
    path_playlist: string;

    duration_live: number | false;
    duration: number;

    total_size: number;

    // game_offset: number;

    // video_metadata: MediaInfo;
    // video_metadata_public?: MediaInfoPublic;
    video_metadata?: VideoMetadata | AudioMetadata;

    chapters: ApiVodChapter[];

    webpath: string;

    stream_number?: number;
    stream_season?: string;

    comment?: string;
    prevent_deletion: boolean;

    failed?: boolean;

};

export type ApiSettingsField = {
    key: string;
    group: string;
    text: string;
    type: string;
    default?: any;
    required: boolean;
    help: string;
    choices?: string[];
    deprecated?: boolean;
    pattern?: string;
};

export type ApiChannel = {
    userid: string;
    display_name: string;
    login: string;
    description: string;
    quality: VideoQuality[] | undefined;

    vods_raw: string[];
    vods_list: ApiVod[];
    vods_size: number;


    is_live: boolean;
    is_converting: boolean;
    profile_image_url: string;
    broadcaster_type: BroadcasterType;

    subbed_at?: string;
    expires_at?: string;
    last_online?: string;

    match: string[] | undefined;

    download_chat: boolean;
    no_capture: boolean;
    burn_chat: boolean;
    live_chat: boolean;
    no_cleanup: boolean;

    current_chapter?: ApiVodChapter;
    current_game?: ApiGame;
    current_vod?: ApiVod;
    // channel_data: {
    //     profile_image_url: string;
    // };
    channel_data: ChannelData | undefined;

    // api_getSubscriptionStatus: SubStatus;
    api_getSubscriptionStatus: boolean;

    clips_list: string[];

    current_stream_number?: number;
    current_season?: string;

};

export type ApiSubscription = {
    type: string;
    id: string;
    username: string;
    user_id: string;
    callback: string;
    instance_match: boolean;
    status: string;
    created_at: string;
};

export type ApiChannelConfig = {
    login: string;
    match: string[];
    quality: VideoQuality[];
    download_chat: boolean;
    no_capture: boolean;
    burn_chat: boolean;
    live_chat: boolean;
    no_cleanup: boolean;
};

export type ApiJob = {
    name: string;
    pid?: number;
    status: JobStatus;
    process_running: boolean;
};

export type ApiLogLine = {
    level: string;
    module: string;
    date_string: string;
    time: number; // unix timestamp in ms
    date: string; // Date;
    text: string;
    pid?: number;
    metadata?: any;
};