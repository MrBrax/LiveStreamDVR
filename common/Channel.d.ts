import { User } from "./TwitchAPI/Users";
import { Snippet } from "./YouTubeAPI/Channels";

export interface TwitchChannelData extends User {
    realm: "twitch";
    _updated: number;
    cache_avatar: string;
}

export interface YouTubeChannelData extends Snippet {
    realm: "youtube";
    _updated: number;
    cache_avatar: string;
}

export type AllChannelData = TwitchChannelData | YouTubeChannelData;