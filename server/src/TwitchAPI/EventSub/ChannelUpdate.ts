declare module TwitchAPI.EventSub.ChannelUpdate {

    export interface Condition {
        broadcaster_user_id: string;
    }

    export interface Transport {
        method: string;
        callback: string;
    }

    export interface Subscription {
        id: string;
        type: string;
        version: string;
        status: string;
        cost: number;
        condition: Condition;
        transport: Transport;
        created_at: Date;
    }

    export interface Event {
        broadcaster_user_id: string;
        broadcaster_user_login: string;
        broadcaster_user_name: string;
        title: string;
        language: string;
        category_id: string;
        category_name: string;
        is_mature: boolean;
    }

    export interface ChannelUpdate {
        subscription: Subscription;
        event: Event;
    }

}
