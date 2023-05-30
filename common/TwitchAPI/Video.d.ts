import { Pagination } from "./Shared";

interface VideoRequestParamsBase {
    language?: string;
    period?: "all" | "day" | "week" | "month";
    sort?: "time" | "trending" | "views";
    type?: "all" | "upload" | "archive" | "highlight";
    first?: number;
    before?: string;
    after?: string;
}

interface VideoRequestParamsWithID extends VideoRequestParamsBase {
    id: string | string[];
}

interface VideoRequestParamsWithUserID extends VideoRequestParamsBase {
    user_id: string;
}

interface VideoRequestParamsWithGameID extends VideoRequestParamsBase {
    game_id: string;
}

export type VideoRequestParams = VideoRequestParamsWithID | VideoRequestParamsWithUserID | VideoRequestParamsWithGameID;


export interface MutedSegment {
    duration: number;
    offset: number;
}

export interface Video {
    /** ID of the video. */
    id: string;

    /** ID of the stream that the video originated from if the type is "archive". Otherwise set to null. */
    stream_id?: string;

    /** ID of the user who owns the video. */
    user_id: string;

    /** Login of the user who owns the video. */
    user_login: string;

    /** Display name corresponding to user_id. */
    user_name: string;

    /** Title of the video. */
    title: string;

    /** Description of the video. */
    description: string;

    /** Date when the video was created. */
    created_at: string;

    /** Date when the video was published. */
    published_at: string;

    /** URL of the video. */
    url: string;

    /** Template URL for the thumbnail of the video. */
    thumbnail_url: string;

    /** Indicates whether the video is publicly viewable. */
    viewable: "public" | "private";

    /** Number of times the video has been viewed. */
    view_count: number;

    /** Language of the video. A language value is either the ISO 639-1 two-letter code for a supported stream language or “other”. */
    language: string;

    /** Type of video. */
    type: "upload" | "archive" | "highlight";

    /** Length of the video. */
    duration: string;

    /**
     * Array of muted segments in the video. If there are no muted segments, the value will be null.
     * 
     * **This will always return null if using an App Access Token**
     * */
    muted_segments: MutedSegment[] | null;
}

export interface VideosResponse {
    data: Video[];
    pagination: Pagination;
}


