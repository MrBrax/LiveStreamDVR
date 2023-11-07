import type { BaseChannel } from "@/Core/Providers/Base/BaseChannel";
import { BaseVOD } from "@/Core/Providers/Base/BaseVOD";
import type { KickChannel } from "@/Core/Providers/Kick/KickChannel";
import type { TwitchChannel } from "@/Core/Providers/Twitch/TwitchChannel";
import type { TwitchVOD } from "@/Core/Providers/Twitch/TwitchVOD";
import type { TwitchVODChapter } from "@/Core/Providers/Twitch/TwitchVODChapter";
import type { YouTubeChannel } from "@/Core/Providers/YouTube/YouTubeChannel";
import type { YouTubeVOD } from "@/Core/Providers/YouTube/YouTubeVOD";

export function isBaseChannel(data: unknown): data is BaseChannel {
    return (data as BaseChannel).config?.provider === undefined;
}

export function isBaseVOD(data: unknown): data is BaseVOD {
    return (data as BaseVOD).provider === "base";
}

export function isTwitchChannel(data: unknown): data is TwitchChannel {
    return (data as TwitchChannel).provider === "twitch";
}

export function isTwitchVOD(data: unknown): data is TwitchVOD {
    return (data as TwitchVOD).provider === "twitch";
}

export function isTwitchVODChapter(data: unknown): data is TwitchVODChapter {
    return (data as TwitchVODChapter).provider === "twitch";
}

export function isYouTubeChannel(data: unknown): data is YouTubeChannel {
    return (data as YouTubeChannel).provider === "youtube";
}

export function isYouTubeVOD(data: unknown): data is YouTubeVOD {
    return (data as YouTubeVOD).provider === "youtube";
}

export function isKickChannel(data: unknown): data is KickChannel {
    return (data as KickChannel).provider === "kick";
}

export function isError(data: unknown): data is Error {
    return data instanceof Error;
}
