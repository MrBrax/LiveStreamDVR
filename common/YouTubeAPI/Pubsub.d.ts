export interface PubsubVideo {
    id: string;
    "yt:videoId": string;
    "yt:channelId": string;
    title: string;
    link: string;
    author: {
        name: string;
        uri: string;
    };
    published: string;
    updated: string;
}