import { Config } from "./Config";
import chalk from "chalk";
import { ClientBroker } from "./ClientBroker";
import axios from "axios";
import {  Log } from "./Log";
import { WebhookData, WebhookAction } from "../../../common/Webhook";
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
    static dispatch(action: WebhookAction, data: WebhookData): void {

        if (LiveStreamDVR.shutting_down) return;

        // console.log("Webhook:", action, data);

        if (Config.debug) console.log(chalk.bgGrey.whiteBright(`WebSocket payload ${action} dispatching...`));

        // send websocket broadcast
        const payload = {
            server: true,
            action: action,
            data: data,
        };

        ClientBroker.broadcast(payload);

        // send webhook
        if (Config.getInstance().cfg("webhook_url")) {
            axios.post(Config.getInstance().cfg("webhook_url"), payload).catch(error => {
                Log.logAdvanced(Log.Level.ERROR, "webhook", `Webhook error: ${error}`);
            });
        }

    }

}