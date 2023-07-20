import { Pagination } from "./Shared";

export interface StreamRequestParams {
    user_id?: string;
    user_login?: string;
    game_id?: string;
    type?: "all" | "live";
    language?: string;
    first?: number;
    before?: string;
    after?: string;
}


export interface Stream {
    id: string;
    user_id: string;
    user_login: string;
    user_name: string;
    game_id: string;
    game_name: string;
    type: string;
    title: string;
    viewer_count: number;
    started_at: string;
    language: string;
    thumbnail_url: string;
    tag_ids: string[];
    is_mature: boolean;
}

export interface StreamsResponse {
    data: Stream[];
    pagination: Pagination;
}
