import { Extensions, Game, GqlResponse } from "./Shared";

export interface GqlVideoChapterResponse extends GqlResponse {
    data: {
        video: {
            id: string;
            moments: {
                edges: VideoMomentEdge[];
            };
        };
    }
    extensions: Extensions;
}

interface GameChangeMomentDetails {
    game: Game;
}

interface VideoMomentEdgeVideo {
    id: string;
    lengthSeconds: number;
}

export interface VideoMomentEdge {
    moments: unknown;
    id: string;
    durationMilliseconds: number;
    positionMilliseconds: number;
    type: string;
    description: string;
    subDescription: string;
    thumbnailURL: string;
    details: GameChangeMomentDetails;
    video: VideoMomentEdgeVideo;
}
