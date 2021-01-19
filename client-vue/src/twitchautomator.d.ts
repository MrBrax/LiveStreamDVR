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
    offset: number;
    viewer_count: number;
    width: number; // why
};

export type ApiGame = {
    name: string;
    box_art_url: string;
};

export type ApiVod = {

    basename: string;

    segments: ApiVodSegment[];

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
    
    api_hasFavouriteGame: boolean;
    api_getUniqueGames: array;
    api_getWebhookDuration: string;
    api_getDuration: number;
    api_getCapturingStatus: number;
    api_getConvertingStatus: number;
    api_getRecordingSize: number;
    api_getChatDumpStatus: number;
    api_getDurationLive: number;

    duration_live: number;

    game_offset: number;

    video_metadata: array;

    chapters: ApiVodChapter[];

    webpath: string;
    
};


export type ApiSettingsField = {
    text: string;
};

export type ApiConfig = {

};

export type ApiStreamer = {
  username: string;
  display_name: string;
  quality: string[];
  vods_list: ApiVod[];
  vods_size: number;
  expires_at: PHPDateTimeJSON;
  is_live: boolean;
  profile_image_url: string;
  subbed_at: PHPDateTimeJSON;
};



export const phpDateFormat = "yyyy-MM-dd HH:mm:ss.SSSSSS"; // 2020-11-03 02:48:01.000000