
export interface KickUser {
    id:         number;
    username:   string;
    bio:        string;
    twitter:    string;
    facebook:   string;
    instagram:  string;
    youtube:    string;
    discord:    string;
    tiktok:     string;
    profilepic: string;
}

export interface KickChannel {
    /** Channel ID -> KickChannel */
    id:                   number;
    /** User ID -> KickUser */
    user_id:              number;
    slug:                 string;
    is_banned:            boolean;
    playback_url:         string;
    name_updated_at:      null;
    vod_enabled:          boolean;
    subscription_enabled: boolean;
    followersCount:       number;
    subscriber_badges:    any[];
    banner_image:         null;
    recent_categories:    RecentCategoryElement[];
    livestream:           null;
    role:                 null;
    muted:                boolean;
    follower_badges:      any[];
    offline_banner_image: null;
    can_host:             boolean;
    user:                 User;
    chatroom:             Chatroom;
    ascending_links:      any[];
    plan:                 Plan;
    previous_livestreams: PreviousLivestream[];
    verified:             Verified;
    media:                any[];
}

export interface Chatroom {
    id:                     number;
    chatable_type:          string;
    channel_id:             number;
    created_at:             string;
    updated_at:             string;
    chat_mode_old:          string;
    chat_mode:              string;
    slow_mode:              boolean;
    chatable_id:            number;
    followers_mode:         boolean;
    subscribers_mode:       boolean;
    emotes_mode:            boolean;
    message_interval:       number;
    following_min_duration: number;
}

export interface Plan {
    id:             number;
    channel_id:     number;
    stripe_plan_id: string;
    amount:         string;
    created_at:     string;
    updated_at:     string;
}

export interface PreviousLivestream {
    id:             number;
    slug:           string;
    channel_id:     number;
    created_at:     string;
    session_title:  string;
    is_live:        boolean;
    risk_level_id:  null;
    source:         null;
    twitch_channel: null;
    duration:       number;
    language:       string;
    is_mature:      boolean;
    viewer_count:   number;
    thumbnail:      { src: string; srcset: string; };
    views:          number;
    tags:           any[];
    categories:     RecentCategoryElement[];
    video:          Video;
}

export interface RecentCategoryElement {
    id:          number;
    category_id: number;
    name:        string;
    slug:        string;
    tags:        string[];
    description: null;
    deleted_at:  null;
    viewers:     number;
    banner:      Banner;
    category:    RecentCategoryCategory;
}

export interface Banner {
    responsive: string;
    url:        string;
}

export interface RecentCategoryCategory {
    id:   number;
    name: string;
    slug: string;
    icon: string;
}

export interface Video {
    id:                  number;
    live_stream_id:      number;
    slug:                null;
    thumb:               null;
    s3:                  null;
    trading_platform_id: null;
    created_at:          string;
    updated_at:          string;
    uuid:                string;
    views:               number;
    deleted_at:          null;
}

export interface User {
    id:                number;
    username:          string;
    agreed_to_terms:   boolean;
    email_verified_at: string;
    bio:               string;
    country:           string;
    state:             string;
    city:              string;
    instagram:         string;
    twitter:           string;
    youtube:           string;
    discord:           string;
    tiktok:            string;
    facebook:          string;
    profile_pic:       string;
}

export interface Verified {
    id:         number;
    channel_id: number;
    created_at: string;
    updated_at: string;
}


export interface KickChannelVideo {
    session_title: string;
    thumbnail:     { src: string; srcset: string };
    video: {
        id: number;
        uuid: string;
        live_stream_id: number;
    }
}