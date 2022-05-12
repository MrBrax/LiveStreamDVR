import { User } from "./TwitchAPI/Users";

interface ChannelData extends User {
    _updated: number;
    cache_avatar: string;
}