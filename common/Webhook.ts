import { ApiJob, ApiVod, ApiVodChapter } from "./Api/Client";

export type WebhookAction =
    "chapter_update" |
    "start_download" |
    "end_capture" |
    "start_convert" |
    "end_convert" |
    "end_download" |
    "start_capture" |
    "job_save" |
    "job_clear" |
    "job_update" |
    "video_download" |
    "vod_removed" |
    "vod_updated" |
    "init" |
    "notify" |
    "connected" |
    "log"
;

export type WebhookData =
    ChapterUpdateData |
    StartDownloadData |
    EndCaptureData |
    VideoDownloadData |
    JobSave |
    JobClear |
    JobUpdate |
    VodRemoved |
    VodUpdated |
    Init
    ;

export interface StartDownloadData {
    vod: ApiVod;
}

export interface EndCaptureData {
    vod: ApiVod;
    success: boolean;
}

export interface EndConvertData {
    vod: ApiVod;
    success: boolean;
}

export interface VideoDownloadData {
    success: boolean;
    path: string;
}

export interface VodRemoved {
    basename: string;
}

export interface VodUpdated {
    vod: ApiVod;
}

export interface Init {
    hello: "world";
}

export interface NotifyData {
    title: string;
    body: string;
    icon: string;
    url: string;
    tts: boolean;
}

export interface JobSave {
    job_name: string;
    job: ApiJob;
}

export interface JobClear {
    job_name: string;
    job: ApiJob;
}

export interface JobUpdate {
    job_name: string;
    job: ApiJob;
}

// export interface LogData {
// 
// }

export interface ChapterUpdateData {
    chapter: ApiVodChapter;
    vod: ApiVod;
}
