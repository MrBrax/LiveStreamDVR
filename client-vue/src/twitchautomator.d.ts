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

export type FormStatus = "IDLE" | "LOADING" | "ERROR" | "OK";

export const phpDateFormat = "yyyy-MM-dd HH:mm:ss.SSSSSS"; // 2020-11-03 02:48:01.000000
