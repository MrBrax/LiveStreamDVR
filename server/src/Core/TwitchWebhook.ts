import { TwitchAutomatorJob } from "./TwitchAutomatorJob";
import { TwitchVOD } from "./TwitchVOD";
import { TwitchVODChapter } from "./TwitchVODChapter";

export type WebhookAction = 
    "chapter_update" | 
    "start_download" | 
    "end_capture" | 
    "end_convert" | 
    "end_download" | 
    "start_capture" |
    "job_save" |
    "job_clear" |
    "video_download"
;

export interface ChapterUpdateData {
    chapter: TwitchVODChapter;
    vod: TwitchVOD;
}

export interface StartDownloadData {
    vod: TwitchVOD;
}

export interface EndCaptureData {
    vod: TwitchVOD;
    success: boolean;
}

export interface VideoDownloadData {
    success: boolean;
    path: string;
}

export interface JobSave {
    job_name: string;
    job: TwitchAutomatorJob;
}

export interface JobClear {
    job_name: string;
    job: TwitchAutomatorJob;
}

export type WebhookData = 
    ChapterUpdateData | 
    StartDownloadData |
    EndCaptureData |
    VideoDownloadData |
    JobSave |
    JobClear
;

export class TwitchWebhook {

    // dispatch function, infer data type from action
    static dispatch(action: WebhookAction, data: WebhookData) {
        console.log("Webhook:", action, data);
    }

}