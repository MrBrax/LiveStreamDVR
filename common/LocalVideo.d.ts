import { VideoMetadata } from "./MediaInfo";

export interface LocalVideo {
    basename: string;
    extension: string;
    channel?: string;
    duration: number;
    size: number;
    video_metadata: VideoMetadata;
    thumbnail?: string;
}