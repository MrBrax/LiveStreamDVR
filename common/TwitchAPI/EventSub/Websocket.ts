import type { EventSubTypes, Subscription, ErrorResponse } from "../Shared";
import type { EventSubResponse } from "../EventSub";
type EventSubWebsocketMessageTypes = "session_welcome" | "session_keepalive" | "notification" | "session_reconnect" | "revocation";

interface EventSubWebsocketBaseMessage {
    _type: EventSubWebsocketMessageTypes; // this does not exist in the actual message, just a hack to get typescript to discriminate the union
    metadata: {
        message_id: string;
        message_type: EventSubWebsocketMessageTypes;
        message_timestamp: string;
    };
    payload: any;
}

export interface EventSubWebsocketSessionMessage extends EventSubWebsocketBaseMessage {
    _type: "session_welcome";
    metadata: {
        message_id: string;
        message_type: "session_welcome";
        message_timestamp: string;
    };
    payload: {
        session: {
            id: string;
            status: string;
            connected_at: string;
            keepalive_timeout_seconds: number;
            reconnect_url: string | null;
        }
    };
}

export interface EventSubWebsocketKeepaliveMessage extends EventSubWebsocketBaseMessage {
    _type: "session_keepalive";
    metadata: {
        message_id: string;
        message_type: "session_keepalive";
        message_timestamp: string;
    };
    payload: Record<string, never>;
}

export interface EventSubWebsocketNotificationMessage extends EventSubWebsocketBaseMessage {
    _type: "notification";
    metadata: {
        message_id: string;
        message_type: "notification";
        message_timestamp: string;
        subscription_type: EventSubTypes;
        subscription_version: string;
    };
    payload: EventSubResponse;
}

export interface EventSubWebsocketReconnectMessage extends EventSubWebsocketBaseMessage {
    _type: "session_reconnect";
    metadata: {
        message_id: string;
        message_type: "session_reconnect";
        message_timestamp: string;
    };
    payload: {
        session: {
            id: string;
            status: string;
            keepalive_timeout_seconds: number;
            reconnect_url: string;
            connected_at: string;
        }
    };
}

export interface EventSubWebsocketRevocationMessage extends EventSubWebsocketBaseMessage {
    _type: "revocation";
    metadata: {
        message_id: string;
        message_type: "revocation";
        message_timestamp: string;
    };
    payload: {
        subscription: Subscription;
    };
}

export type EventSubWebsocketMessage =
    EventSubWebsocketSessionMessage |
    EventSubWebsocketKeepaliveMessage |
    EventSubWebsocketNotificationMessage |
    EventSubWebsocketReconnectMessage |
    EventSubWebsocketRevocationMessage;