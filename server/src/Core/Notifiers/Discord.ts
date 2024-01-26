import type { NotificationCategory } from "@common/Defs";
import type { AxiosError } from "axios";
import axios from "axios";
import { Config } from "../Config";
import { LOGLEVEL, log } from "../Log";

interface DiscordSendMessagePayload {
    content: string;
    username?: string;
    avatar_url?: string;
    tts?: boolean;
    embeds?: DiscordEmbed[];
    allowed_mentions?: unknown;
    components?: unknown;
    files?: unknown;
    payload_json?: string;
    attachments?: unknown;
    flags?: number;
}

interface DiscordEmbed {
    title?: string;
    type?: string;
    description?: string;
    url?: string;
    timestamp?: string;
    color?: number;
    footer?: DiscordEmbedFooter;
    image?: DiscordEmbedImage;
    thumbnail?: DiscordEmbedThumbnail;
    video?: DiscordEmbedVideo;
    provider?: DiscordEmbedProvider;
    author?: DiscordEmbedAuthor;
    fields?: DiscordEmbedField[];
}

interface DiscordEmbedFooter {
    text: string;
    icon_url?: string;
    proxy_icon_url?: string;
}

interface DiscordEmbedImage {
    url?: string;
    proxy_url?: string;
    height?: number;
    width?: number;
}

interface DiscordEmbedThumbnail {
    url?: string;
    proxy_url?: string;
    height?: number;
    width?: number;
}

interface DiscordEmbedVideo {
    url?: string;
    proxy_url?: string;
    height?: number;
    width?: number;
}

interface DiscordEmbedProvider {
    name?: string;
    url?: string;
}

interface DiscordEmbedAuthor {
    name?: string;
    url?: string;
    icon_url?: string;
    proxy_icon_url?: string;
}

interface DiscordEmbedField {
    name: string;
    value: string;
    inline?: boolean;
}

export default function notify(
    title: string,
    body = "",
    icon = "",
    category: NotificationCategory, // change this?
    url = "",
    tts = false
) {
    axios
        .post(Config.getInstance().cfg("discord_webhook"), {
            content: `**${title}**\n${body}${url ? `\n\n${url}` : ""}`,
            avatar_url: icon && icon.startsWith("https") ? icon : undefined, // only allow https
            tts: tts,
        } as DiscordSendMessagePayload)
        .then((res) => {
            log(
                LOGLEVEL.DEBUG,
                "clientBroker.notify",
                "Discord response",
                res.data
            );
        })
        .catch((err: AxiosError) => {
            if (axios.isAxiosError(err)) {
                log(
                    LOGLEVEL.ERROR,
                    "clientBroker.notify",
                    `Discord axios error: ${err.message} (${JSON.stringify(
                        err.response?.data
                    )})`,
                    { err: err, response: err.response?.data }
                );
            } else {
                log(
                    LOGLEVEL.ERROR,
                    "clientBroker.notify",
                    `Discord error: ${(err as Error).message}`,
                    err
                );
            }
        });
}
