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
    "websocket_disconnected" | // new since 2022-11-01
    "websocket_disconnected" | // new since 2022-12-09 - The client closed the connection.
    "websocket_failed_ping_pong" | // new since 2022-12-09 - The client failed to respond to a ping message.
    "websocket_received_inbound_traffic" | // new since 2022-12-09 - The client sent a non-pong message. Clients may only send pong messages (and only in response to a ping message).
    "websocket_connection_unused" | // new since 2022-12-09 - The client failed to subscribe to events within the required time.
    "websocket_internal_error" | // new since 2022-12-09 - The Twitch WebSocket server experienced an unexpected error.
    "websocket_network_timeout" | // new since 2022-12-09 - The Twitch WebSocket server timed out writing the message to the client.
    "websocket_network_error" | // new since 2022-12-09 - The Twitch WebSocket server experienced a network error writing the message to the client.
    "moderator_removed" // new since 2022-12-09 - The moderator that authorized the subscription is no longer one of the broadcaster’s moderators.
;

export type EventSubTypes = "channel.update" | "stream.offline" | "stream.online";
