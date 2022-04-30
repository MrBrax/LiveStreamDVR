import type { WebhookAction } from "@common/Webhook";

export interface WebsocketJSON {
    action: WebhookAction;
    data: any;
}