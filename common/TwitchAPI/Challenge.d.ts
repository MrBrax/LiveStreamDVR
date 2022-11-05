import { Condition, EventSubTypes, TransportWebhook, TransportWebsocket } from "./Shared";

interface Subscription {
    id: string;
    status: string;
    type: EventSubTypes;
    version: string;
    cost: number;
    condition: Condition;
    transport: TransportWebhook | TransportWebsocket;
    created_at: Date;
}

/**
 * Returned from subscribe requests
 */
export interface ChallengeResponse {
    challenge: string;
    subscription: Subscription;
}

/**
 * Used for subscribing to events.
 */
export interface ChallengeRequest {
    type: EventSubTypes,
    version: string,
    condition: Condition;
    transport: TransportWebhook | TransportWebsocket;
}
