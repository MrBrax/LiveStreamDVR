import type { User } from "./TwitchAPI/Users";

export interface UserData extends User {
    _updated: number;
    // cache_avatar: string;
    avatar_cache?: string;
    avatar_thumb?: string;
    cache_offline_image: string;
}