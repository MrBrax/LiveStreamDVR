import { ApiTwitchChannel, ApiJob, ApiTwitchVod, ApiVodBaseChapter, ApiVods, ApiChannels } from "./Api/Client";

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
    "job_progress" |
    "video_download" |
    "vod_removed" |
    "vod_updated" |
    "channel_updated" |
    "init" |
    "notify" |
    "connected" |
    "log" |
    "alert"
;

export type WebhookData =
    ChapterUpdateData |
    StartDownloadData |
    EndCaptureData |
    VideoDownloadData |
    JobSave |
    JobClear |
    JobUpdate |
    JobProgress |
    VodRemoved |
    VodUpdated |
    ChannelUpdated |
    Init |
    Alert
    ;

export interface StartDownloadData {
    vod: ApiVods;
}

export interface EndCaptureData {
    vod: ApiVods;
    success: boolean;
}

export interface EndConvertData {
    vod: ApiVods;
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
    vod: ApiVods;
}

export interface ChannelUpdated {
    channel: ApiChannels;
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

export interface JobProgress {
    job_name: string;
    progress: number;
}

// export interface LogData {
// 
// }

export interface ChapterUpdateData {
    chapter: ApiVodBaseChapter;
    vod: ApiTwitchVod;
}

export interface Alert {
    text: string;
}