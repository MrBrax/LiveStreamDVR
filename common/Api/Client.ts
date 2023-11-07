import type {
    BaseVODChapterJSON,
    TwitchVODChapterJSON,
} from "../../server/src/Storage/JSON";
import type { VODBookmark } from "../Bookmark";
import type { VideoQuality } from "../Config";
import type { ExistStatus, JobStatus, MuteStatus, Providers } from "../Defs";
import type { ExportData } from "../Exporter";
import type { LocalClip } from "../LocalClip";
import type { LocalVideo } from "../LocalVideo";
import type { AudioMetadata, VideoMetadata } from "../MediaInfo";
import type { BroadcasterType } from "../TwitchAPI/Users";
import type { UserData } from "../User";

export type ApiVodSegment = {
    basename: string;
    filesize: number;
    deleted: boolean;
};

export interface ApiVodBaseChapter {
    title: string;
    duration: number;
    started_at: string;
    // datetime: PHPDateTimeJSON;
    offset: number;
}

export interface ApiVodTwitchChapter extends ApiVodBaseChapter {
    game_id?: string;
    game_name?: string;
    game?: ApiGame;
    box_art_url?: string;
    viewer_count?: number;
    // width: number; // why
    is_mature: boolean;
}

export type ApiGame = {
    id: string;
    name: string;
    game_name: string;
    box_art_url: string;
    favourite: boolean;
    image_url: string;
    added: string;
    deleted?: boolean;
};

export interface ApiBaseVod {
    provider: Providers;
    uuid: string;
    channel_uuid: string;
    basename: string;
    segments: ApiVodSegment[];
    chapters: ApiVodBaseChapter[];
    segments_raw: string[];
    created_at?: string;
    saved_at?: string;
    started_at: string;
    ended_at?: string;
    capture_started?: string;
    capture_started2?: string;
    conversion_started?: string;

    capture_id?: string;

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
    path_chat: string;
    path_downloaded_vod: string;
    path_losslesscut: string;
    path_chatrender: string;
    path_chatburn: string;
    path_chatdump: string;
    path_chatmask: string;
    // path_adbreak: string;
    path_playlist: string;
    duration_live: number | false;
    duration: number;
    total_size: number;
    video_metadata?: VideoMetadata | AudioMetadata;
    webpath: string;

    stream_title: string;
    stream_number?: number;
    stream_season?: string;
    stream_absolute_season?: number;
    stream_absolute_number?: number;

    external_vod_id?: string;
    external_vod_title?: string;
    external_vod_duration?: number;
    external_vod_exists?: boolean;
    external_vod_date?: string;

    comment?: string;
    prevent_deletion: boolean;

    failed?: boolean;
    cloud_storage?: boolean;

    api_getRecordingSize: number | false;
    api_getDuration: number | null;
    api_getCapturingStatus: JobStatus;
    api_getConvertingStatus: JobStatus;
    api_getDurationLive: number | false;

    export_data?: ExportData;

    viewers: { amount: number; timestamp: string }[];
    stream_pauses: { start: string; end: string }[];

    bookmarks: VODBookmark[];
}

export interface ApiTwitchVod extends ApiBaseVod {
    provider: "twitch";
    stream_resolution?: VideoQuality;

    // twitch_vod_duration?: number;
    twitch_vod_muted?: MuteStatus;
    twitch_vod_status?: ExistStatus;
    // twitch_vod_id?: string;
    // twitch_vod_date?: string;
    // twitch_vod_title?: string;

    twitch_vod_neversaved?: boolean;
    // twitch_vod_exists?: boolean;
    twitch_vod_attempted?: boolean;

    api_hasFavouriteGame: boolean;
    api_getUniqueGames: ApiGame[];
    api_getWebhookDuration?: string;

    api_getChatDumpStatus: JobStatus;

    // game_offset: number;

    // video_metadata: MediaInfo;
    // video_metadata_public?: MediaInfoPublic;

    chapters: ApiVodTwitchChapter[];
}

export interface ApiYouTubeVod extends ApiBaseVod {
    streamer_name: string;
    streamer_id: string;
    provider: "youtube";
}

export interface ApiKickVod extends ApiBaseVod {
    // streamer_id: string;
}

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

export interface ApiBaseChannel {
    provider: Providers;
    uuid: string;
    description: string;
    vods_raw: string[];
    vods_size: number;
    is_live: boolean;
    is_capturing: boolean;
    is_converting: boolean;
    subbed_at?: string;
    expires_at?: string;
    last_online?: string;
    match: string[] | undefined;
    download_chat: boolean;
    no_capture: boolean;
    burn_chat: boolean;
    live_chat: boolean;
    no_cleanup: boolean;
    max_storage: number;
    max_vods: number;
    download_vod_at_end: boolean;
    download_vod_at_end_quality: VideoQuality;
    clips_list: LocalClip[];
    video_list: LocalVideo[];

    current_stream_number?: number;
    current_season?: string;
    current_absolute_season?: number;

    displayName: string;
    internalName: string;
    internalId: string;
    url: string;
    profilePictureUrl: string;
    cloud_storage?: boolean;
}

export interface ApiTwitchChannel extends ApiBaseChannel {
    provider: "twitch";
    userid: string;
    display_name: string;
    login: string;
    quality: VideoQuality[] | undefined;
    vods_list: ApiTwitchVod[];
    profile_image_url: string;
    offline_image_url: string;
    banner_image_url: string;
    broadcaster_type: BroadcasterType;
    current_chapter?: ApiVodBaseChapter;
    current_game?: ApiGame;
    current_vod?: ApiTwitchVod;
    // channel_data: {
    //     profile_image_url: string;
    // };
    channel_data: UserData | undefined;

    // api_getSubscriptionStatus: SubStatus;
    api_getSubscriptionStatus: boolean;

    chapter_data?: TwitchVODChapterJSON;

    saves_vods: boolean;
}

export interface ApiYouTubeChannel extends ApiBaseChannel {
    provider: "youtube";
    channel_id: string;
    display_name: string;
    // quality: VideoQuality[] | undefined;
    vods_list: ApiYouTubeVod[];
    profile_image_url: string;
    // offline_image_url: string;
    // banner_image_url: string;
    // broadcaster_type: BroadcasterType;
    current_chapter?: ApiVodBaseChapter;
    // current_game?: ApiGame;
    current_vod?: ApiYouTubeVod;
    // channel_data: {
    //     profile_image_url: string;
    // };
    // channel_data: UserData | undefined;

    // api_getSubscriptionStatus: SubStatus;
    api_getSubscriptionStatus: boolean;

    chapter_data?: BaseVODChapterJSON;
}

export interface ApiKickChannel extends ApiBaseChannel {
    provider: "kick";
}

export type ApiChannels = ApiTwitchChannel | ApiYouTubeChannel | ApiKickChannel;
export type ApiVods = ApiTwitchVod | ApiYouTubeVod | ApiKickVod;

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
    provider: Providers;
    uuid: string;
    login?: string;
    channel_id?: string;
    match: string[];
    quality: VideoQuality[];
    download_chat: boolean;
    no_capture: boolean;
    burn_chat: boolean;
    live_chat: boolean;
    no_cleanup: boolean;
    max_storage: number;
    max_vods: number;
    download_vod_at_end: boolean;
    download_vod_at_end_quality: VideoQuality;
};

export type ApiJob = {
    name: string;
    pid?: number;
    status: JobStatus;
    process_running: boolean;
    progress: number;
    dt_started_at: string;
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

export interface EditableChapter {
    originalIndex?: number;
    offset: number;
    title: string;
    game_id?: string;
    viewer_count?: number;
    is_mature?: boolean;
    // online: boolean;
}

export interface ApiFile {
    name: string;
    size: number;
    date: string;
    is_dir: boolean;
    extension: string;
    is_public: boolean;
}
