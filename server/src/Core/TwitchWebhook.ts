import { TwitchConfig } from "./TwitchConfig";
import { TwitchVODChapter } from "./TwitchVODChapter";
import chalk from "chalk";
import { ClientBroker } from "./ClientBroker";
import axios from "axios";
import { LOGLEVEL, TwitchLog } from "./TwitchLog";
import { ApiVod } from "../../../common/Api/Client";
import { ChapterUpdateData, EndCaptureData, Init, JobClear, JobSave, StartDownloadData, VideoDownloadData, VodRemoved, VodUpdated, WebhookAction } from "../../../common/Webhook";

export type WebhookData =
    ChapterUpdateData |
    StartDownloadData |
    EndCaptureData |
    VideoDownloadData |
    JobSave |
    JobClear |
    VodRemoved |
    VodUpdated |
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