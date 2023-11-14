import type { Providers } from "@common/Defs";
import { JobStatus } from "@common/Defs";
import type { ExportData } from "@common/Exporter";
import type { AudioMetadata, VideoMetadata } from "@common/MediaInfo";
import type { VodViewerEntry, StreamPause } from "@common/Vod";
import type { BaseVODChapter } from "./BaseVODChapter";
import { BaseVODSegment } from "./BaseVODSegment";
import type { ApiBaseVod } from "@common/Api/Client";

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
    stream_absolute_number?: number;

    external_vod_id?: string;
    external_vod_title?: string;
    external_vod_duration?: number;
    external_vod_exists?: boolean;
    external_vod_date?: Date;

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
        return this.segments.findIndex((s) => s.deleted) !== -1;
    }

    get totalPausedTime(): number {
        return this.stream_pauses.reduce((acc, pause) => {
            const duration = pause.end.getTime() - pause.start.getTime();
            return acc + duration;
        }, 0);
    }

    public static makeFromApiResponse(apiResponse: ApiBaseVod): BaseVOD {

        const vod = new BaseVOD();
        vod.uuid = apiResponse.uuid;
        vod.channel_uuid = apiResponse.channel_uuid;
        vod.basename = apiResponse.basename;
        vod.capture_id = apiResponse.capture_id;
        vod.is_capturing = apiResponse.is_capturing;
        vod.is_converting = apiResponse.is_converting;
        vod.is_finalized = apiResponse.is_finalized;
        vod.segments = apiResponse.segments.map((seg) => BaseVODSegment.makeFromApiResponse(seg));
        vod.video_metadata = apiResponse.video_metadata;
        vod.created_at = apiResponse.created_at ? new Date(apiResponse.created_at) : undefined;
        vod.started_at = apiResponse.started_at ? new Date(apiResponse.started_at) : undefined;
        vod.ended_at = apiResponse.ended_at ? new Date(apiResponse.ended_at) : undefined;
        vod.saved_at = apiResponse.saved_at ? new Date(apiResponse.saved_at) : undefined;
        vod.capture_started = apiResponse.capture_started ? new Date(apiResponse.capture_started) : undefined;
        vod.capture_started2 = apiResponse.capture_started2 ? new Date(apiResponse.capture_started2) : undefined;
        vod.conversion_started = apiResponse.conversion_started ? new Date(apiResponse.conversion_started) : undefined;
        vod.duration = apiResponse.duration;
        vod.external_vod_id = apiResponse.external_vod_id;
        vod.external_vod_title = apiResponse.external_vod_title;
        vod.external_vod_duration = apiResponse.external_vod_duration;
        vod.external_vod_exists = apiResponse.external_vod_exists;
        vod.external_vod_date = apiResponse.external_vod_date ? new Date(apiResponse.external_vod_date) : undefined;
        vod.is_chat_downloaded = apiResponse.is_chat_downloaded;
        vod.is_chatdump_captured = apiResponse.is_chatdump_captured;
        vod.is_chat_rendered = apiResponse.is_chat_rendered;
        vod.is_chat_burned = apiResponse.is_chat_burned;
        vod.is_vod_downloaded = apiResponse.is_vod_downloaded;
        vod.is_lossless_cut_generated = apiResponse.is_lossless_cut_generated;
        vod.is_capture_paused = apiResponse.is_capture_paused;
        vod.webpath = apiResponse.webpath;
        vod.convertingStatus = apiResponse.api_getConvertingStatus;
        vod.recordingSize = apiResponse.api_getRecordingSize;
        vod.capturingStatus = apiResponse.api_getCapturingStatus;
        
        vod.total_size = apiResponse.total_size;
        vod.stream_number = apiResponse.stream_number;
        vod.stream_season = apiResponse.stream_season;
        vod.stream_absolute_season = apiResponse.stream_absolute_season;
        vod.stream_absolute_number = apiResponse.stream_absolute_number;
        vod.comment = apiResponse.comment;
        vod.prevent_deletion = apiResponse.prevent_deletion;
        vod.failed = apiResponse.failed || false;
        
        vod.cloud_storage = apiResponse.cloud_storage || false;
        vod.exportData = apiResponse.export_data || {};
        vod.viewers = apiResponse.viewers
            ? apiResponse.viewers.map((entry) => {
                  return { timestamp: new Date(entry.timestamp), amount: entry.amount };
              })
            : [];
        vod.stream_pauses = apiResponse.stream_pauses
            ? apiResponse.stream_pauses.map((entry) => ({ start: new Date(entry.start), end: new Date(entry.end) }))
            : [];

        return vod;

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
