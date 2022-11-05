export interface Condition {
    broadcaster_user_id: string;
}

export interface TransportWebhook {
    method: "webhook";
    callback: string;
    secret?: string;
}

export interface TransportWebsocket {
    method: "websocket";
    session_id: string;
    connected_at: string;
    disconnected_at: string;
}

export interface TransportWebsocketRequest {
    method: "websocket";
    session_id: string;
}


export interface Subscription {
    id: string;
    type: EventSubTypes;
    version: string;
    status: EventSubStatus;
    cost: number;
    condition: Condition;
    transport: TransportWebhook | TransportWebsocket;
    created_at: string;
}

export interface Pagination {
    cursor?: string;
}

export interface ErrorResponse {
    error: string;
    status: number;
    message: string;
}

export type EventSubStatus = 
    "enabled" |
    "webhook_callback_verification_pending" |
    "webhook_callback_verification_failed" |
    "notification_failures_exceeded" |
    "authorization_revoked" |
    "user_removed" |
    "websocket_disconnected" // new since 2022-11-01
;

export type EventSubTypes = "channel.update" | "stream.offline" | "stream.online";
