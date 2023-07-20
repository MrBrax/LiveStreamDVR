import { VideoMetadata } from "./MediaInfo";
import { Clip } from "./TwitchAPI/Clips";

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