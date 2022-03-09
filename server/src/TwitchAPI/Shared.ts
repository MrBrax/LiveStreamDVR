export interface Condition {
    broadcaster_user_id: string;
}

export interface Transport {
    method: string;
    callback: string;
}

export interface Subscription {
    id: string;
    type: EventSubTypes;
    version: string;
    status: string;
    cost: number;
    condition: Condition;
    transport: Transport;
    created_at: string;
}

export interface Pagination {
    cursor?: string;
}

export interface ErrorResponse {
    error: "Unauthorized";
    status: number;
    "message": "Invalid OAuth token";
}

export type EventSubTypes = "channel.update" | "stream.offline" | "stream.online";