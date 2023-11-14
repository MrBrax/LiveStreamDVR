import type { MutedSegment } from "../TwitchAPI/Video";

export interface ProxyVideo {
    id: string;
    title: string;
    description: string;
    thumbnail: string;
    url: string;
    created_at: string;
    duration: number;
    view_count: number;
    muted_segments?: MutedSegment[] | null;
    stream_id?: string;
    type: string;
}
