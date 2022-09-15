import TwitchChannel from "@/core/Providers/Twitch/TwitchChannel";
import TwitchVOD from "@/core/Providers/Twitch/TwitchVOD";
import YouTubeChannel from "@/core/Providers/YouTube/YouTubeChannel";
import YouTubeVOD from "@/core/Providers/YouTube/YouTubeVOD";
import { ChannelTypes, VODTypes } from "@/store";
import { format, formatDistance, formatDistanceToNow, parseISO, parseJSON } from "date-fns";
// const dateFormat = "yyyy-MM-dd HH:mm:ss.SSSSSS"; // 2020-11-03 02:48:01.000000

export default {
    methods: {
        formatDate(date: string | Date, fmt = "yyyy-MM-dd HH:mm:ss"): string {
            if (!date) return "";

            if (date instanceof Date) {
                return format(date, fmt);
            }

            const o = parseJSON(date);
            return format(o, fmt);
        },
        formatLogicalDate(date: string | Date) {
            if (!date) return "";
            const absDate = parseJSON(date);
            const now = new Date();

            if (now.getTime() - absDate.getTime() < 22 * 60 * 60 * 1000) {
                return this.formatDate(date, "HH:mm:ss");
            } else if (now.getFullYear() == absDate.getFullYear()) {
                return this.formatDate(date, "dd/MM HH:mm:ss");
            } else {
                return this.formatDate(date, "yyyy-MM-dd HH:mm:ss");
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
        },
        formatTimestamp(timestamp: number, fmt = "yyyy-MM-dd HH:mm:ss"): string {
            const o = new Date(timestamp * 1000);
            return format(o, fmt);
        },
        humanDuration(duration: number): string {
            if (duration < 0) {
                return `(NEGATIVE DURATION: ${duration})`;
            }
            const hours = Math.floor(duration / 3600);
            const minutes = Math.floor((duration / 60) % 60);
            const seconds = Math.floor(duration % 60);
            return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
        },
        formatBytes(bytes: number, precision = 2): string {
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
        },
        niceDuration(durationInSeconds: number): string {
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
        },
        twitchDuration(seconds: number): string {
            return this.niceDuration(seconds).replaceAll(" ", "").trim();
            // return trim(str_replace(" ", "", self::getNiceDuration($seconds)));
        },
        formatNumber(num: number, decimals = 0): string {
            return num.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        },
        humanDate(date: string | Date, suffix = false): string {
            if (!date) return "";
            let d;
            if (date instanceof Date) {
                d = date;
            } else {
                d = parseJSON(date);
            }
            return formatDistance(d, new Date(), { addSuffix: suffix });
        },
        parseTwitchDuration(duration: string): number {
            const regex = /(\d+)([hdms])/g;
            let match;
            let total = 0;
            while ((match = regex.exec(duration)) !== null) {
                const amount = parseInt(match[1]);
                const unit = match[2];
                switch (unit) {
                    case "h":
                        total += amount * 3600;
                        break;
                    case "d":
                        total += amount * 86400;
                        break;
                    case "m":
                        total += amount * 60;
                        break;
                    case "s":
                        total += amount;
                        break;
                }
            }
            return total;
        },
        // sortObject(game: Record<string, any>, value: string) {
        //     return Object.entries(game).sort((a, b) => {
        //         return (a as any)[value] - (b as any)[value];
        //     });
        // },
        formatDurationSince(date: string): string {
            const o = parseISO(date);
            return formatDistanceToNow(o, { addSuffix: true });
        },
        prefersReducedMotion(): boolean {
            return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        },
        formatDuration(duration_seconds: number) {
            const hours = Math.floor(duration_seconds / (60 * 60));
            const minutes = Math.floor((duration_seconds - (hours * 60 * 60)) / 60);
            const seconds = Math.floor(duration_seconds - (hours * 60 * 60) - (minutes * 60));
            return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
        },
        isTwitch(vod: ChannelTypes): vod is TwitchChannel {
            return vod instanceof TwitchChannel;
        },
        isYouTube(vod: ChannelTypes): vod is YouTubeChannel {
            return vod instanceof YouTubeChannel;
        },
        isTwitchVOD(vod: VODTypes): vod is TwitchVOD {
            return vod instanceof TwitchVOD;
        },
        isYouTubeVOD(vod: VODTypes): vod is YouTubeVOD {
            return vod instanceof YouTubeVOD;
        }
    },
};

declare module "@vue/runtime-core" {
    export interface ComponentCustomProperties {
        formatDate: (date: string | Date, fmt?: string) => string;
        formatLogicalDate: (date: Date | string) => string;
        formatTimestamp: (timestamp: number, fmt?: string) => string;
        humanDuration: (duration: number) => string;
        formatBytes: (bytes: number, precision?: number) => string;
        niceDuration: (durationInSeconds: number) => string;
        twitchDuration: (seconds: number) => string;
        formatNumber: (num: number, decimals?: number) => string;
        humanDate: (date: string | Date, suffix?: boolean) => string;
        parseTwitchDuration: (duration: string) => number;
        formatDurationSince: (date: string) => string;
        // sortObject: (game: Record<string, any>, value: string) => any;
        prefersReducedMotion: () => boolean;
        formatDuration: (duration_seconds: number) => string;
        isTwitch: (channel: ChannelTypes) => boolean;
        isYouTube: (channel: ChannelTypes) => boolean;
        isTwitchVOD: (vod: VODTypes) => boolean;
        isYouTubeVOD: (vod: VODTypes) => boolean;
    }
}
