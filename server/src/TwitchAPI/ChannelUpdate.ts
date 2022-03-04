import { Condition, Subscription, Transport } from "./Shared";

interface ChannelUpdateSubscription extends Subscription {
    type: "channel.update";
}

export interface ChannelUpdateEvent {
    broadcaster_user_id: string;
    broadcaster_user_login: string;
    broadcaster_user_name: string;
    title: string;
    language: string;
    category_id: string;
    category_name: string;
    is_mature: boolean;
}

export interface EventSubChannelUpdate {
    subscription: ChannelUpdateSubscription;
    event: ChannelUpdateEvent;
}
