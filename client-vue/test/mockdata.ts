import { ApiChannel, ApiGame, ApiVod, ApiVodChapter } from "@common/Api/Client";
import { ChannelData } from "@common/Channel";
import { JobStatus } from "@common/Defs";

export const MockApiGameData = {
    id: "123",
    name: "Test Game 1",
    game_name: "Test Game 1",
    box_art_url: "http://example.com/image.jpg",
    favourite: false,
    image_url: "http://example.com/image.jpg",
    added: "2020-11-03 02:48:01.000000",
};

export const GamesData: Record<string, ApiGame> = {
    "123": {
        id: "123",
        name: "Test Game 1",
        game_name: "Test Game 1",
        box_art_url: "http://example.com/image.jpg",
        favourite: false,
        image_url: "http://example.com/image.jpg",
        added: "2020-11-03 02:48:01.000000",
    },
    "456": {
        id: "456",
        name: "Test Game 2",
        game_name: "Test Game 2",
        box_art_url: "http://example.com/image.jpg",
        favourite: false,
        image_url: "http://example.com/image.jpg",
        added: "2021-11-03 02:48:01.000000",
    }
};

export const TwitchChannelData: ChannelData = {
    id: "",
    login: "",
    display_name: "",
    type: "",
    broadcaster_type: "partner",
    description: "",
    profile_image_url: "",
    offline_image_url: "",
    view_count: 1234,
    created_at: "",

    _updated: 1605849081,
    cache_avatar: "",
};

export const MockApiChannelData: ApiChannel = {
    userid: "123",
    display_name: "test",
    login: "test",
    description: "test",
    quality: [],
    vods_raw: [],
    vods_list: [],
    profile_image_url: "",
    api_getSubscriptionStatus: false,
    broadcaster_type: "",
    clips_list: [],
    vods_size: 0,
    is_live: false,
    is_converting: false,
    match: [],
    download_chat: true,
    no_capture: false,
    burn_chat: true,
    live_chat: false,
    channel_data: TwitchChannelData,
};

export const MockApiVODData: ApiVod = {
    basename: "",
    stream_title: "",
    segments: [],
    segments_raw: [],
    streamer_name: "",
    streamer_id: "",
    streamer_login: "",
    started_at: "",
    is_capturing: false,
    is_converting: false,
    is_converted: false,
    is_finalized: false,
    is_chat_downloaded: false,
    is_chatdump_captured: false,
    is_chat_rendered: false,
    is_chat_burned: false,
    is_vod_downloaded: false,
    is_capture_paused: false,
    is_lossless_cut_generated: false,
    api_hasFavouriteGame: false,
    api_getUniqueGames: [],
    api_getDuration: null,
    api_getCapturingStatus: JobStatus.NONE,
    api_getConvertingStatus: JobStatus.NONE,
    api_getRecordingSize: 0,
    api_getChatDumpStatus: JobStatus.NONE,
    api_getDurationLive: 0,
    path_chat: "",
    path_downloaded_vod: "",
    path_losslesscut: "",
    path_chatrender: "",
    path_chatburn: "",
    path_chatdump: "",
    path_chatmask: "",
    path_adbreak: "",
    path_playlist: "",
    duration_live: 0,
    duration: 0,
    total_size: 0,
    chapters: [],
    webpath: ""
};

export const MockApiChapterData: ApiVodChapter = {
    title: "",
    strings: {},
    duration: 0,
    started_at: "",
    offset: 0,
    is_mature: false,
    game_id: undefined,
    game_name: undefined,
    game: undefined,
};