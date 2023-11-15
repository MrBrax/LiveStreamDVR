import type { BaseChannel } from "@/Core/Providers/Base/BaseChannel";
import type { BaseVOD } from "@/Core/Providers/Base/BaseVOD";
import type { KickChannel } from "@/Core/Providers/Kick/KickChannel";
import type { TwitchChannel } from "@/Core/Providers/Twitch/TwitchChannel";
import type { TwitchVOD } from "@/Core/Providers/Twitch/TwitchVOD";
import type { TwitchVODChapter } from "@/Core/Providers/Twitch/TwitchVODChapter";
import type { YouTubeChannel } from "@/Core/Providers/YouTube/YouTubeChannel";
import type { YouTubeVOD } from "@/Core/Providers/YouTube/YouTubeVOD";

export function isBaseChannel(
    compareData: unknown
): compareData is BaseChannel {
    return (compareData as BaseChannel).config?.provider === undefined;
}

export function isBaseVOD(compareData: unknown): compareData is BaseVOD {
    return (compareData as BaseVOD).provider === "base";
}

export function isTwitchChannel(
    compareData: unknown
): compareData is TwitchChannel {
    return (compareData as TwitchChannel).provider === "twitch";
}

export function isTwitchVOD(compareData: unknown): compareData is TwitchVOD {
    return (compareData as TwitchVOD).provider === "twitch";
}

export function isTwitchVODChapter(
    compareData: unknown
): compareData is TwitchVODChapter {
    return (compareData as TwitchVODChapter).provider === "twitch";
}

export function isYouTubeChannel(
    compareData: unknown
): compareData is YouTubeChannel {
    return (compareData as YouTubeChannel).provider === "youtube";
}

export function isYouTubeVOD(compareData: unknown): compareData is YouTubeVOD {
    return (compareData as YouTubeVOD).provider === "youtube";
}

export function isKickChannel(
    compareData: unknown
): compareData is KickChannel {
    return (compareData as KickChannel).provider === "kick";
}

export function isError(compareData: unknown): compareData is Error {
    return compareData instanceof Error;
}

export function isNumber(compareData: string): boolean {
    return !isNaN(Number(compareData));
}
