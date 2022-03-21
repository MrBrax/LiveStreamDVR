import { Pagination } from "./Shared";

interface MutedSegment {
    duration: number;
    offset: number;
}

export interface Video {
    id: string;
    stream_id?: any;
    user_id: string;
    user_login: string;
    user_name: string;
    title: string;
    description: string;
    created_at: string;
    published_at: string;
    url: string;
    thumbnail_url: string;
    viewable: string;
    view_count: number;
    language: string;
    type: string;
    duration: string;
    muted_segments: MutedSegment[] | null;
}

export interface VideosResponse {
    data: Video[];
    pagination: Pagination;
}


