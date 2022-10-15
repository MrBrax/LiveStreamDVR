export interface TwitchCommentDump {
    comments: TwitchComment[];
    video: {
        created_at: string;
        description: string;
        duration: string;
        id: string;
        language: string;
        published_at: string;
        thumbnail_url: string;
        title: string;
        type: string;
        url: string;
        user_id: string;
        user_name: string;
        view_count: number;
        viewable: string;

        /** TwitchDownloader */
        start?: number;
        /** TwitchDownloader */
        end?: number;

        /** @deprecated */
        length?: string;
        /** @deprecated */
        channel?: {
            _id: string;
            display_name: string;
        };
        /** @deprecated */
        _id?: string;
    };

    /** @deprecated */
    streamer?: {
        name: string;
        id: string; // ?
    };
}

export interface TwitchComment {
    // internal
    displayed?: boolean;

    _id: string;
    channel_id: string;
    // commenter: Array;
    content_id: string;

    /**
     * The offset of the comment being displayed in seconds
     */
    content_offset_seconds: number;

    content_type: string;
    commenter: {
        _id: string;
        bio: string;
        created_at: string;
        display_name: string;
        logo: string;
        name: string;
        type: string;
        updated_at: string;
    };
    message: {
        body: string;
        emoticons: TwitchCommentEmoticons[]; // TODO:

        user_notice_params?: {
            "msg-id": string | null;
        };

        fragments: TwitchCommentMessageFragment[];
        user_badges: TwitchCommentUserBadge[];
        user_color: string | null;
        bits_spent?: number;
    };
    more_replies?: boolean;
    created_at: string;
    // message: Array;
    source: string;
    state: string;
    updated_at: string;
}

export interface TwitchCommentUserBadge {
    _id: string;
    version: string;
}

export interface TwitchCommentMessageFragment {
    text: string;
    emoticon?: {
        emoticon_id: string;
        emoticon_set_id?: string;
    };
}

export interface TwitchCommentEmoticons {
    _id: string;
    begin: number;
    end: number;
}