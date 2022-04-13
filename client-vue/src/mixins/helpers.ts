import { format, formatDistance, formatDistanceToNow, parseISO, parseJSON } from "date-fns";
// const dateFormat = "yyyy-MM-dd HH:mm:ss.SSSSSS"; // 2020-11-03 02:48:01.000000

export default {
    methods: {
        formatDate(date: string | Date, fmt = "yyyy-MM-dd HH:mm:ss") {
            if (!date) return "";

            if (date instanceof Date) {
                return format(date, fmt);
            }

            const o = parseJSON(date);
            return format(o, fmt);
        },
        formatTimestamp(timestamp: number, fmt = "yyyy-MM-dd HH:mm:ss") {
            const o = new Date(timestamp * 1000);
            return format(o, fmt);
        },
        humanDuration(duration: number) {
            if (duration < 0) {
                return "(NEGATIVE DURATION)";
            }
            const hours = Math.floor(duration / 3600);
            const minutes = Math.floor((duration / 60) % 60);
            const seconds = Math.floor(duration % 60);
            return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
        },
        formatBytes(bytes: number, precision = 2) {
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
        formatNumber(num: number, decimals = 0) {
            return num.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        },
        humanDate(date: string | Date, suffix = false) {
            if (!date) return "";
            let d;
            if (date instanceof Date) {
                d = date;
            } else {
                d = parseJSON(date);
            }
            return formatDistance(d, new Date(), { addSuffix: suffix });
        },
        parseTwitchDuration(duration: string) {
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
        formatDurationSince(date: string) {
            const o = parseISO(date);
            return formatDistanceToNow(o, { addSuffix: true });
        },
    },
    data() {
        return {
            twitchQuality: ["best", "1080p60", "1080p", "720p60", "720p", "480p", "360p", "160p", "140p", "worst"],
        };
    },
};

declare module "@vue/runtime-core" {
    export interface ComponentCustomProperties {
        formatDate: (date: string | Date, fmt?: string) => string;
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
    }
}
