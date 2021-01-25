export type PHPDateTimeJSON = {
    date: string;
    timezone_type: number;
    timezone: string;
};

export type ApiVodSegment = {
    basename: string;
    filesize: number;
    deleted: boolean;
};

export type ApiVodChapter = {
    title: string;
    game_id: number;
    strings: array;
    duration: number;
    box_art_url: string;
    game_name: string;
    started_at: PHPDateTimeJSON;
    datetime: PHPDateTimeJSON;
    offset: number;
    viewer_count: number;
    width: number; // why
};

export type ApiGame = {
    id: string;
    name: string;
    game_name: string;
    box_art_url: string;
    favourite: boolean;
    image_url: string;
};

export type ApiVod = {
    basename: string;

    stream_title: string;
    stream_quality: string;

    segments: ApiVodSegment[];
    segments_raw: string[];

    twitch_vod_duration: number;
    twitch_vod_muted: boolean;
    twitch_vod_exists: boolean;
    twitch_vod_url: string;
    twitch_vod_id: string;
    twitch_vod_date: string;
    twitch_vod_title: string;

    dt_started_at: PHPDateTimeJSON;
    dt_ended_at: PHPDateTimeJSON;
    dt_capture_started: PHPDateTimeJSON;
    dt_conversion_started: PHPDateTimeJSON;

    is_capturing: boolean;
    is_converting: boolean;
    is_finalized: boolean;
    is_chat_downloaded: boolean;
    is_chatdump_captured: boolean;
    is_chat_rendered: boolean;
    is_chat_burned: boolean;
    is_vod_downloaded: boolean;
    is_capture_paused: boolean;

    api_hasFavouriteGame: boolean;
    api_getUniqueGames: ApiGame[];
    api_getWebhookDuration: string;
    api_getDuration: number;
    api_getCapturingStatus: number;
    api_getConvertingStatus: number;
    api_getRecordingSize: number;
    api_getChatDumpStatus: number;
    api_getDurationLive: number;

    duration_live: number;
    duration_seconds: number;

    total_size: number;

    game_offset: number;

    video_metadata: array;
    video_metadata_public: array;

    chapters: ApiVodChapter[];

    webpath: string;
};

export type ApiSettingsField = {
    text: string;
};

export type ApiConfig = {
    app_name: string;
    bin_dir: string;
    ffmpeg_path: string;
    mediainfo_path: string;
    twitchdownloader_path: string;
    basepath: string;
    instance_id: string;
    app_url: string;
    webhook_url: string;
    password: string;
    password_secure: boolean;
    storage_per_streamer: number;
    hls_timeout: number;
    vods_to_keep: number;
    download_retries: number;
    sub_lease: number;
    sub_secret: string;
    api_client_id: string;
    api_secret: string;
    youtube_api_client_id: string;
    hook_callback: string;
    timezone: string[];
    vod_container: string[];
    burn_preset: string[];
    burn_crf: number;
    disable_ads: boolean;
    debug: boolean;
    app_verbose: boolean;
    channel_folders: boolean;
    chat_compress: boolean;
    relative_time: boolean;
    low_latency: boolean;
    youtube_dlc: boolean;
    pipenv_enabled: boolean;
    chat_dump: boolean;
    ts_sync: boolean;
    encode_audio: boolean;
    fix_corruption: boolean;
    playlist_dump: boolean;
    process_wait_method: number;
    youtube_api_key: string;
    favourites: Record<string, string>;
};

export type ApiStreamer = {
    userid: string;
    username: string;
    display_name: string;
    quality: string[];
    vods_list: ApiVod[];
    vods_size: number;
    expires_at: PHPDateTimeJSON;
    is_live: boolean;
    is_converting: boolean;
    profile_image_url: string;
    subbed_at: PHPDateTimeJSON;
    current_game: ApiGame;
    current_vod: ApiVod;
    channel_data: {
        profile_image_url: string;
    };
};

export type ApiJob = {
    name: string;
    pid: number;
    status: number;
};

export type ApiLogLine = {
    level: string;
    module: string;
    date_string: string;
    text: string;
};


export const phpDateFormat = "yyyy-MM-dd HH:mm:ss.SSSSSS"; // 2020-11-03 02:48:01.000000
