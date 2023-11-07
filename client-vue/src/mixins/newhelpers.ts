import TwitchChannel from "@/core/Providers/Twitch/TwitchChannel";
import TwitchVOD from "@/core/Providers/Twitch/TwitchVOD";
import YouTubeChannel from "@/core/Providers/YouTube/YouTubeChannel";
import YouTubeVOD from "@/core/Providers/YouTube/YouTubeVOD";
import type { ChannelTypes, VODTypes } from "@/twitchautomator";
import { format, formatDistance, parseJSON, isDate } from "date-fns";
import type { ApiTwitchChannel, ApiYouTubeChannel, ApiTwitchVod, ApiYouTubeVod } from "@common/Api/Client";

export function niceDuration(durationInSeconds: number): string {
    if (durationInSeconds < 0) {
        return `(NEGATIVE DURATION: ${durationInSeconds})`;
    }
    let duration = "";
    const days = Math.floor(durationInSeconds / 86400);
    durationInSeconds -= days * 86400;
    const hours = Math.floor(durationInSeconds / 3600);
    durationInSeconds -= hours * 3600;
    const minutes = Math.floor(durationInSeconds / 60);
    const seconds = durationInSeconds - minutes * 60;

    if (days > 0) {
        duration += Math.round(days) + "d";
    }
    if (hours > 0) {
        duration += " " + Math.round(hours) + "h";
    }
    if (minutes > 0) {
        duration += " " + Math.round(minutes) + "m";
    }
    if (seconds > 0) {
        duration += " " + Math.round(seconds) + "s";
    }
    return duration.trim();
}

export function humanDuration(duration: number): string {
    if (duration < 0) {
        return `(NEGATIVE DURATION: ${duration})`;
    }
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration / 60) % 60);
    const seconds = Math.floor(duration % 60);
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function prefersReducedMotion(): boolean {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function shortDuration(durationInSeconds: number): string {
    if (durationInSeconds > 3600) {
        return `${Math.round(durationInSeconds / 3600)} hours`;
    } else if (durationInSeconds > 60) {
        return `${Math.round(durationInSeconds / 60)} minutes`;
    } else {
        return `${Math.round(durationInSeconds)} seconds`;
    }
}

/**
 * @deprecated
 */
export const formatDuration = humanDuration;

export function formatBytes(bytes: number, precision = 2): string {
    const units = ["B", "KB", "MB", "GB", "TB"];
    bytes = Math.max(bytes, 0);
    let pow = Math.floor((bytes ? Math.log(bytes) : 0) / Math.log(1024));
    pow = Math.min(pow, units.length - 1);
    // Uncomment one of the following alternatives
    bytes /= Math.pow(1024, pow);
    // bytes /= (1 << (10 * pow));
    // const finalAmount = Math.round(bytes)
    const finalAmount = bytes.toFixed(precision);
    return `${finalAmount} ${units[pow]}`;
}

export function formatDate(date: string | Date, fmt = "yyyy-MM-dd HH:mm:ss"): string {
    if (!date) return "";

    if (date instanceof Date) {
        return format(date, fmt);
    }

    const o = parseJSON(date);

    if (!isDate(o) || !(o instanceof Date) || isNaN(o.getTime())) {
        return `[Invalid Date: ${date}]`;
    }

    return format(o, fmt);
}

export function formatLogicalDate(date: string | Date) {
    if (!date) return "";
    const absDate = parseJSON(date);
    const now = new Date();

    if (now.getTime() - absDate.getTime() < 22 * 60 * 60 * 1000) {
        return formatDate(date, "HH:mm:ss");
    } else if (now.getFullYear() == absDate.getFullYear()) {
        return formatDate(date, "dd/MM HH:mm:ss");
    } else {
        return formatDate(date, "yyyy-MM-dd HH:mm:ss");
    }
    // if older than 24 hours, show date with time
    /*
    if (new Date().getTime() - new Date(date).getTime() > 22 * 60 * 60 * 1000) {
        return this.formatDate(date, "yyyy-MM-dd HH:mm:ss");
    // if newer than current year, show date with time
    } else if (new Date().getFullYear() == new Date(date).getFullYear()) {
        return this.formatDate(date, "dd/MM HH:mm:ss");
    } else {
        return this.formatDate(date, "HH:mm:ss");
    }*/
}

export function formatNumber(num: number, decimals = 0): string {
    return num.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatTimestamp(timestamp: number, fmt = "yyyy-MM-dd HH:mm:ss"): string {
    const o = new Date(timestamp * 1000);
    return format(o, fmt);
}

export function humanDate(date: string | Date, suffix = false): string {
    if (!date) return "";
    let d;
    if (date instanceof Date) {
        d = date;
    } else {
        d = parseJSON(date);
    }
    return formatDistance(d, new Date(), { addSuffix: suffix });
}

export function twitchDuration(seconds: number): string {
    return niceDuration(seconds).replaceAll(" ", "").trim();
    // return trim(str_replace(" ", "", self::getNiceDuration($seconds)));
}

export function isTwitchChannel(vod: ChannelTypes): vod is TwitchChannel {
    return vod instanceof TwitchChannel;
}

export function isYouTubeChannel(vod: ChannelTypes): vod is YouTubeChannel {
    return vod instanceof YouTubeChannel;
}

export function isTwitchApiChannel(vod: any): vod is ApiTwitchChannel {
    return vod.provider == "twitch";
}

export function isTwitchApiVOD(vod: any): vod is ApiTwitchVod {
    return vod.provider == "twitch";
}

export function isYouTubeApiVOD(vod: any): vod is ApiYouTubeVod {
    return vod.provider == "youtube";
}

export function isYouTubeApiChannel(vod: any): vod is ApiYouTubeChannel {
    return vod.provider == "youtube";
}

export function isTwitchVOD(vod: VODTypes): vod is TwitchVOD {
    return vod instanceof TwitchVOD;
}

export function isYouTubeVOD(vod: VODTypes): vod is YouTubeVOD {
    return vod instanceof YouTubeVOD;
}
