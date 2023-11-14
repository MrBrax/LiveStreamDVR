export interface Game {
    id: string;
    displayName: string;
    boxArtURL: string;
}

export interface Extensions {
    durationMilliseconds: number;
    requestID: string;
}

export interface GqlResponse {
    data: any;
    extensions: Extensions;
}