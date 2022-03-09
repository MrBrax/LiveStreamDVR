import { Condition, EventSubTypes, Transport } from "./Shared";

interface Subscription {
    id: string;
    status: string;
    type: EventSubTypes;
    version: string;
    cost: number;
    condition: Condition;
    transport: Transport;
    created_at: Date;
}

export interface ChallengeRequest {
    challenge: string;
    subscription: Subscription;
}
