import { Config } from "./Config";
import chalk from "chalk";
import { ClientBroker } from "./ClientBroker";
import axios from "axios";
import {  Log } from "./Log";
import { WebhookData, WebhookAction } from "@common/Webhook";
import { LiveStreamDVR } from "./LiveStreamDVR";

export class Webhook {

    /**
     * Dispatch a webhook + websocket message to all connected clients
     * The payload constructed consists of a JSON object with the following properties:
     * - action: the action to perform
     * - data: the data to pass, can be anything.
     * 
     * @param action 
     * @param data 
     */
    static dispatchAll(action: WebhookAction, data: WebhookData): void {

        if (LiveStreamDVR.shutting_down) return;

        // console.log("Webhook:", action, data);

        // if (Config.debug) console.log(chalk.bgGrey.whiteBright(`WebSocket payload ${action} dispatching...`));

        Log.logAdvanced(Log.Level.DEBUG, "webhook", `Dispatching all for ${action}...`);

        Webhook.dispatchWebsocket(action, data);
        Webhook.dispatchWebhook(action, data);

    }

    static dispatchWebhook(action: WebhookAction, data: WebhookData): void {

        // send websocket broadcast
        const payload = {
            server: true,
            action: action,
            data: data,
        };

        // send webhook
        if (Config.getInstance().hasValue("webhook_url")) {
            Log.logAdvanced(Log.Level.DEBUG, "webhook", `Dispatching webhook for ${action}...`);
            const url = Config.getInstance().cfg("webhook_url");
            axios.post(url, payload).then(response => {
                Log.logAdvanced(Log.Level.DEBUG, "webhook", `Webhook response from '${url}': ${response.status} ${response.statusText}`);
            }).catch(error => {
                if (axios.isAxiosError(error)) {
                    Log.logAdvanced(Log.Level.ERROR, "webhook", `Webhook error to '${url}': ${error.response?.status} ${error.response?.statusText}`, error);
                } else {
                    Log.logAdvanced(Log.Level.ERROR, "webhook", `Webhook error to '${url}': ${error}`, error);
                }
            });
        } else {
            Log.logAdvanced(Log.Level.DEBUG, "webhook", `Not dispatching webhook for ${action} because no webhook_url is set.`);
        }

    }

    static dispatchWebsocket(action: WebhookAction, data: WebhookData): void {

        if (LiveStreamDVR.shutting_down) return;

        const payload = {
            action: action,
            data: data,
        };

        Log.logAdvanced(Log.Level.DEBUG, "webhook", `Dispatching websocket for ${action}...`);

        ClientBroker.broadcast(payload);

    }

}