import type { TwitchVODChapter } from "./core/Providers/Twitch/TwitchVODChapter";
import type { BaseVODChapter } from "./core/Providers/Base/BaseVODChapter";
import type TwitchVOD from "./core/Providers/Twitch/TwitchVOD";
import type YouTubeVOD from "./core/Providers/YouTube/YouTubeVOD";
import type TwitchChannel from "./core/Providers/Twitch/TwitchChannel";
import type YouTubeChannel from "./core/Providers/YouTube/YouTubeChannel";

export type PHPDateTimeJSON = {
    date: string;
    timezone_type: number;
    timezone: string;
};

export type SidemenuShow = {
    vod_date: boolean;
    vod_sxe: boolean;
    vod_sxe_absolute: boolean;
    vod_size: boolean;
    vod_duration: boolean;
    vod_basename: boolean;
    vod_icon: boolean;
    vod_title: boolean;
};

export type VideoBlockShow = {
    general: boolean;
    segments: boolean;
    bookmarks: boolean;
    chapters: boolean;
    viewers: boolean;
};

export type FormStatus = "IDLE" | "LOADING" | "ERROR" | "OK";

// export const phpDateFormat = "yyyy-MM-dd HH:mm:ss.SSSSSS"; // 2020-11-03 02:48:01.000000

export type ChannelTypes = TwitchChannel | YouTubeChannel;
export type VODTypes = TwitchVOD | YouTubeVOD;
export type ChapterTypes = TwitchVODChapter | BaseVODChapter;
