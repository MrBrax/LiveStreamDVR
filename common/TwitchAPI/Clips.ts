import type { Pagination } from "./Shared";

export interface Clip {
    id: string;
    url: string;
    embed_url: string;
    broadcaster_id: string;
    /** Broadcaster name, not login */
    broadcaster_name: string;
    creator_id: string;
    creator_name: string;
    video_id: string;
    game_id: string;
    language: string;
    title: string;
    view_count: number;
    created_at: string;
    thumbnail_url: string;
    duration: number;
    /** 2022‑07‑20 - added */
    vod_offset: number;
}

export interface ClipsResponse {
    data: Clip[];
    pagination: Pagination;
}
