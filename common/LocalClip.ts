import type { VideoMetadata } from "./MediaInfo";
import type { Clip } from "./TwitchAPI/Clips";

export interface LocalClip {
    folder: string;
    basename: string;
    extension: string;
    channel?: string;
    duration: number;
    size: number;
    video_metadata: VideoMetadata;
    thumbnail?: string;
    clip_metadata?: Clip;
}