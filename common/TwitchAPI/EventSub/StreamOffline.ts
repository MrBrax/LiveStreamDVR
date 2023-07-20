import type { Subscription } from "../Shared";

interface StreamOfflineSubscription extends Subscription {
    type: "stream.offline";
}

interface StreamOfflineEvent {
    broadcaster_user_id: string;
    broadcaster_user_login: string;
    broadcaster_user_name: string;
}

export interface EventSubStreamOffline {
    subscription: StreamOfflineSubscription;
    event: StreamOfflineEvent;
}
