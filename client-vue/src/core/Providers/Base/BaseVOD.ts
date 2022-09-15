import { JobStatus, Providers } from "@common/Defs";
import { VideoMetadata, AudioMetadata } from "@common/MediaInfo";
import { BaseVODChapter } from "./BaseVODChapter";
import { BaseVODSegment } from "./BaseVODSegment";

export default class BaseVOD {
    provider: Providers = "base";
    uuid? = "";
    basename = "";
    is_capturing = false;
    is_converting = false;
    is_finalized = false;

    created_at?: Date;
    started_at?: Date;
    ended_at?: Date;
    saved_at?: Date;
    capture_started?: Date;
    capture_started2?: Date;
    conversion_started?: Date;

    segments: BaseVODSegment[] = [];
    chapters: BaseVODChapter[] = [];
    video_metadata: VideoMetadata | AudioMetadata | undefined;

    duration = 0;

    is_chat_downloaded = false;
    is_chatdump_captured = false;
    is_chat_rendered = false;
    is_chat_burned = false;
    is_vod_downloaded = false;
    is_lossless_cut_generated = false;
    is_capture_paused = false;
    webpath = "";

    convertingStatus: JobStatus = JobStatus.NONE;
    capturingStatus: JobStatus = JobStatus.NONE;
    chatDumpStatus: JobStatus = JobStatus.NONE;
    recordingSize: number | false = 0;

    total_size = 0;

    stream_number?: number;
    stream_season?: string;
    stream_absolute_season?: number;

    comment?: string;
    prevent_deletion = false;

    failed = false;

    get current_chapter(): BaseVODChapter | undefined {
        if (this.chapters.length > 0) {
            return this.chapters[this.chapters.length - 1];
        } else {
            return undefined;
        }
    }

    get hasDeletedSegment(): boolean {
        return this.segments.findIndex(s => s.deleted) !== -1;
    }

    public getDuration() {
        return this.duration;
    }

    public getConvertingStatus() {
        return this.convertingStatus;
    }

    public getCapturingStatus() {
        return this.capturingStatus;
    }

    public getChatDumpStatus() {
        return this.chatDumpStatus;
    }

    public getRecordingSize() {
        return this.recordingSize;
    }

}