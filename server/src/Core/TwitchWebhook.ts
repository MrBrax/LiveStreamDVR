import { TwitchAutomatorJob } from "./TwitchAutomatorJob";
import { TwitchConfig } from "./TwitchConfig";
import { TwitchVOD } from "./TwitchVOD";
import { TwitchVODChapter } from "./TwitchVODChapter";
import WebSocket from "ws";
import chalk from "chalk";
import { ClientBroker } from "./ClientBroker";
import axios from "axios";
import { LOGLEVEL, TwitchLog } from "./TwitchLog";

export type WebhookAction =
    "chapter_update" |
    "start_download" |
    "end_capture" |
    "end_convert" |
    "end_download" |
    "start_capture" |
    "job_save" |
    "job_clear" |
    "video_download" |
    "vod_removed" |
    "init"
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

export interface VodRemoved {
    basename: string;
}

export interface Init {
    hello: "world";
}

export type WebhookData =
    ChapterUpdateData |
    StartDownloadData |
    EndCaptureData |
    VideoDownloadData |
    JobSave |
    JobClear |
    VodRemoved |
    Init
    ;

export class TwitchWebhook {

    /**
     * Dispatch a webhook + websocket message to all connected clients
     * The payload constructed consists of a JSON object with the following properties:
     * - action: the action to perform
     * - data: the data to pass, can be anything.
     * 
     * @param action 
     * @param data 
     */
    static dispatch(action: WebhookAction, data: WebhookData): void {
        
        // console.log("Webhook:", action, data);

        if (TwitchConfig.cfg("debug")) console.log(chalk.bgGrey.whiteBright(`WebSocket payload ${action} dispatching...`));

        // send websocket broadcast
        const payload = {
            server: true,
            action: action,
            data: data,
        };

        ClientBroker.broadcast(payload);

        // send webhook
        if (TwitchConfig.cfg("webhook_url")) {

            let response;

            try {
                response = axios.post(TwitchConfig.cfg("webhook_url"), payload);
            } catch (error) {
                TwitchLog.logAdvanced(LOGLEVEL.ERROR, "webhook", `Webhook error: ${error}`);
            }

        }

    }

}