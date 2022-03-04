import { Condition, Subscription, Transport } from "./Shared";

interface StreamOnlineSubscription extends Subscription {
    type: "stream.online";
}

interface StreamOnlineEvent {
    id: string;
    broadcaster_user_id: string;
    broadcaster_user_login: string;
    broadcaster_user_name: string;
    type: string;

    /** Date, 2022-02-23T00:47:32Z */
    started_at: string;
}

export interface EventSubStreamOnline {
    subscription: StreamOnlineSubscription;
    event: StreamOnlineEvent;
}
