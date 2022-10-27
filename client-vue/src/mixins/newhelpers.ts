import TwitchChannel from "@/core/Providers/Twitch/TwitchChannel";
import TwitchVOD from "@/core/Providers/Twitch/TwitchVOD";
import YouTubeChannel from "@/core/Providers/YouTube/YouTubeChannel";
import YouTubeVOD from "@/core/Providers/YouTube/YouTubeVOD";
import { ChannelTypes, VODTypes } from "@/store";

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

export function shortDuration(durationInSeconds: number): string {
    if (durationInSeconds > 3600) {
        return `${Math.round(durationInSeconds / 3600)} hours`;
    } else if (durationInSeconds > 60) {
        return `${Math.round(durationInSeconds / 60)} minutes`;
    } else {
        return `${Math.round(durationInSeconds)} seconds`;
    }
}

export function formatDuration(duration_seconds: number) {
    const hours = Math.floor(duration_seconds / (60 * 60));
    const minutes = Math.floor((duration_seconds - (hours * 60 * 60)) / 60);
    const seconds = Math.floor(duration_seconds - (hours * 60 * 60) - (minutes * 60));
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

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

export function isTwitch(vod: ChannelTypes): vod is TwitchChannel {
    return vod instanceof TwitchChannel;
}

export function isYouTube(vod: ChannelTypes): vod is YouTubeChannel {
    return vod instanceof YouTubeChannel;
}

export function isTwitchVOD(vod: VODTypes): vod is TwitchVOD {
    return vod instanceof TwitchVOD;
}

export function isYouTubeVOD(vod: VODTypes): vod is YouTubeVOD {
    return vod instanceof YouTubeVOD;
}