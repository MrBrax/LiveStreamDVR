import z from "zod";
import { Provider, VideoQuality } from "./defs";

export const BaseChannelConfig = z.object({
    provider: Provider,
    uuid: z.string(),
    quality: z.array(VideoQuality),
    match: z.array(z.string()),
    download_chat: z.boolean(),
    burn_chat: z.boolean(),
    no_capture: z.boolean(),
    live_chat: z.boolean(),
    no_cleanup: z.boolean(),
    max_storage: z.number(),
    max_vods: z.number(),
    download_vod_at_end: z.boolean(),
    download_vod_at_end_quality: VideoQuality.optional(),
    // login: z.string().optional(),
    // channel_id: z.string().optional(),
    // slug: z.string().optional(),
});

export const TwitchChannelConfig = BaseChannelConfig.extend({
    provider: z.literal("twitch"),
    login: z.string(),
});

export const YouTubeChannelConfig = BaseChannelConfig.extend({
    provider: z.literal("youtube"),
    channel_id: z.string(),
});

export const KickChannelConfig = BaseChannelConfig.extend({
    provider: z.literal("kick"),
    slug: z.string(),
});
