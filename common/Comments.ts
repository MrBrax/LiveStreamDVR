/*
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

        /** @deprecated *
        length?: string;
        /** @deprecated *
        channel?: {
            _id: string;
            display_name: string;
        };
        /** @deprecated *
        _id?: string;
    };
}
*/

export interface TwitchCommentDumpTD {
    FileInfo?: {
        Version: {
            Major: number;
            Minor: number;
            Patch: number;
        };
        CreatedAt: string;
        UpdatedAt: string;
    };
    streamer?: {
        name: string;
        id: number; // ?
    };

    comments: TwitchComment[];
    video: {
        title: string;
        description: string | null;
        id: string;
        created_at: string;
        start: number;
        end: number;
        length: number;
        viewCount: number;
        game: string | null;
        chapters: unknown[]; // TODO
    };
    
    embeddedData: unknown;
}

export interface TwitchComment {

    _id: string;
    created_at: string;
    channel_id: string;
    content_type: string;
    content_id: string;
    content_offset_seconds: number;

    commenter: {
        display_name: string;
        _id: string;
        name: string;
        bio: string | null;
        created_at: string;
        updated_at: string;
        logo: string;        
    };
    message: {
        body: string;
        bits_spent?: number;
        fragments: TwitchCommentMessageFragment[];
        user_badges: TwitchCommentUserBadge[];
        user_color: string | null;
        user_notice_params: unknown; // TODO:
        emoticons: TwitchCommentEmoticons[]; // TODO:
    };
}

// export interface TwitchCommentTD extends TwitchComment {
//     more_replies: boolean;
// }

export interface TwitchCommentUserBadge {
    _id: string;
    version: string;
}

export interface TwitchCommentMessageFragment {
    text: string;
    emoticon: {
        emoticon_id: string;
        emoticon_set_id?: string;
    } | null;
}

export interface TwitchCommentEmoticons {
    _id: string;
    begin: number;
    end: number;
}