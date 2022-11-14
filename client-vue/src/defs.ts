import type { SidemenuShow, VideoBlockShow } from "./twitchautomator";

export const defaultSidemenuShow: SidemenuShow = {
    vod_date: true,
    vod_sxe: false,
    vod_sxe_absolute: false,
    vod_size: true,
    vod_duration: true,
    vod_basename: false,
    vod_icon: true,
    vod_title: false,
};

export const defaultVideoBlockShow: VideoBlockShow = { // TODO: invert name
    general: false,
    segments: false,
    bookmarks: true,
    chapters: false,
};