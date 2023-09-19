import z from "zod";

// export type VideoQuality = "best" | "1080p60" | "1080p" | "720p60" | "720p" | "480p" | "360p" | "160p" | "140p" | "worst" | "audio_only";

export const Provider = z.enum(["base", "twitch", "youtube", "kick"]);

export const VideoQuality = z.enum([
    "best",
    "1080p60",
    "1080p",
    "720p60",
    "720p",
    "480p",
    "360p",
    "160p",
    "140p",
    "worst",
    "audio_only",
]);
