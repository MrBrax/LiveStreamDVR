import { Condition, EventSubTypes, Pagination, Subscription, TransportWebhook, TransportWebsocket, TransportWebsocketRequest } from "./Shared";

export interface Subscriptions {
    data: Subscription[];
    total: number;
    total_cost: number;
    max_total_cost: number;
    pagination: Pagination;
}

// export interface SubscriptionRequest extends ChallengeRequest { }

export interface SubscriptionRequest {
    type: EventSubTypes,
    version: string,
    condition: Condition;
    transport: TransportWebhook | TransportWebsocketRequest;
}

export interface SubscriptionResponse {
    data: Subscription[];
    total: number;
    total_cost: number;
    max_total_cost: number;
}