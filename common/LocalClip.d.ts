import { VideoMetadata } from "./MediaInfo";

export interface LocalClip {
    folder: string;
    basename: string;
    extension: string;
    channel?: string;
    duration: number;
    size: number;
    video_metadata: VideoMetadata;
    thumbnail?: string;
}