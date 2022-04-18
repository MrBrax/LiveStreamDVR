export declare namespace TwitchAPI {
    export type Video = {
        id: number;
        stream_id: string;
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
        muted_segments?: [
            {
                duration: number;
                offset: number;
            }
        ];
    };
}
