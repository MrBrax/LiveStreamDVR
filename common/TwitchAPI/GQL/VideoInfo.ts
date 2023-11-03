import { Extensions, Game, GqlResponse } from "./Shared";

export interface GqlVideoInfoResponse extends GqlResponse {
    data: {
        video: VideoInfo;
    };
    extensions: Extensions;
}

export interface VideoInfo {

    title: string;
    thumbnailURLs: string[];
    createdAt: string;
    lengthSeconds: number;
    owner: {
        id: string;
        displayName: string;
    };
    viewCount: number;
    game: Game;
    description: string;
}
