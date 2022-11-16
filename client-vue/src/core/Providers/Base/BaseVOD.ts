import type { Providers } from "@common/Defs";
import { JobStatus } from "@common/Defs";
import type { ExportData } from "@common/Exporter";
import type { AudioMetadata, VideoMetadata } from "@common/MediaInfo";
import type { VodViewerEntry, StreamPause } from "@common/Vod";
import type { BaseVODChapter } from "./BaseVODChapter";
import type { BaseVODSegment } from "./BaseVODSegment";

export default class BaseVOD {
    provider: Providers = "base";
    uuid = "";
    channel_uuid = "";
    basename = "";
    capture_id? = "";
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

    cloud_storage = false;

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

    exportData?: ExportData;

    viewers: VodViewerEntry[] = [];
    stream_pauses: StreamPause[] = [];

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

    public getTitle() {
        if (this.chapters && this.chapters.length > 0) {
            return this.chapters[0].title;
        }
        return this.basename;
    }

    public hasError() {
        if (this.failed) return true;
        if (!this.is_finalized && !this.is_capturing && !this.is_converting && this.segments.length == 0) return true;
        return false;
    }

    public dateToTimestamp(date: Date): number | null {
        const start = this.started_at;
        if (start) {
            return Math.floor((date.getTime() - start.getTime()) / 1000);
        } else {
            return null;
        }
    }

    public timestampToDate(timestamp: number): Date | null {
        const start = this.started_at;
        if (start) {
            return new Date(start.getTime() + timestamp * 1000);
        } else {
            return null;
        }
    }


}