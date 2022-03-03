namespace TwitchAPI {
    export interface BaseResponse {
        data: any;
        pagination: Pagination;
    }

    export interface Pagination {
        cursor: string;
    }

    export interface MutedSegment {
        duration: number;
        offset: number;
    }

    export interface Video {
        id: string;
        stream_id?: any;
        user_id: string;
        user_login: string;
        user_name: string;
        title: string;
        description: string;
        created_at: string;
        published_at: string;
        url: string;
        thumbnail_url: string;
        viewable: string;
        view_count: number;
        language: string;
        type: string;
        duration: string;
        muted_segments: MutedSegment[];
    }

    export interface GetVideosResponse extends BaseResponse {
        data: Video[];
        pagination: Pagination;
    }

    namespace EventSub {
        export interface EventSubResponse {
            subscription: any;
            event: any;
        }
        
        export interface Condition {
            broadcaster_user_id: string;
        }
    
        export interface Transport {
            method: string;
            callback: string;
        }
    
        export interface Subscription {
            id: string;
            status: string;
            type: string;
            version: string;
            cost: number;
            condition: Condition;
            transport: Transport;
            created_at: Date;
        }
    
        export interface FollowEvent {
            user_id: string;
            user_login: string;
            user_name: string;
            broadcaster_user_id: string;
            broadcaster_user_login: string;
            broadcaster_user_name: string;
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

        export namespace Response {
            export interface ChannelFollow extends EventSubResponse {
                subscription: Subscription;
                event: FollowEvent;
            }
        
            export interface ChannelUpdate extends EventSubResponse {
                subscription: Subscription;
                event: ChannelUpdateEvent;
            }
        
            export interface Challenge {
                challenge: string;
                subscription: Subscription;
            }

        }
    
        
    }

}

