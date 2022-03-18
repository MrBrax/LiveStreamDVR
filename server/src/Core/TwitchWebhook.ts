import { TwitchAutomatorJob } from "./TwitchAutomatorJob";
import { TwitchConfig } from "./TwitchConfig";
import { TwitchVOD } from "./TwitchVOD";
import { TwitchVODChapter } from "./TwitchVODChapter";
import WebSocket from "ws";
import chalk from "chalk";

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
    Init
    ;

export class TwitchWebhook {

    // dispatch function, infer data type from action
    static dispatch(action: WebhookAction, data: WebhookData): Promise<boolean> {
        
        // console.log("Webhook:", action, data);

        if (TwitchConfig.cfg("debug")) console.log(chalk.bgGrey.whiteBright(`WebSocket payload ${action} dispatching...`));

        /*
        $public_websocket_url = TwitchConfig::cfg("websocket_server_address") ?: (preg_replace("/https?/", "ws", TwitchConfig::cfg('app_url')) . "/socket/");
        $docker_websocket_url = "ws://broker:8765/socket/";
        $local_websocket_url = "ws://localhost:8765/socket/";
        $websocket_url = getenv('TCD_DOCKER') == 1 ? $docker_websocket_url : $public_websocket_url;

        /** @todo: developement instead of debug *
        if (TwitchConfig::cfg('debug') && !TwitchConfig::cfg("websocket_server_address")) {
            $websocket_url = $local_websocket_url;
        }
        */
        const public_websocket_url = TwitchConfig.cfg<string>("websocket_server_address") ?? TwitchConfig.cfg<string>("app_url").replace(/https?/, "ws") + "/socket/";
        const docker_websocket_url = "ws://broker:8765/socket/";
        const local_websocket_url = "ws://localhost:8765/socket/";
        let websocket_url = process.env.TCD_DOCKER === "1" ? docker_websocket_url : public_websocket_url;

        /** @todo: developement instead of debug */
        if (TwitchConfig.cfg("debug") && !TwitchConfig.cfg("websocket_server_address")) {
            websocket_url = local_websocket_url;
        }

        const payload = {
            server: true,
            action: action,
            data: { action, ...data },
        };

        return new Promise((resolve, reject) => {

            const ws = new WebSocket(websocket_url);
            ws.on("open", () => {
                console.log(chalk.bgGreen.whiteBright(`WebSocket payload ${action} sent`));
                ws.send(JSON.stringify(payload));
                ws.close();
                resolve(true);
            });

            ws.on("error", (err) => {
                console.error(chalk.bgRed.whiteBright(`WebSocket error: ${err.message}. Is client-broker running?`));
                // reject(false);
            });

            ws.on("message", (data) => {
                if (TwitchConfig.cfg("debug")) console.log(chalk.bgBlue.whiteBright(`WebSocket message: ${data}`));
            });

            ws.on("close", () => {
                if (TwitchConfig.cfg("debug")) console.log(chalk.bgBlue.whiteBright("WebSocket closed"));
            });

        });

    }

}