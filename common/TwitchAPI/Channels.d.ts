export interface Channel {
    broadcaster_id: string
    broadcaster_login: string
    broadcaster_name: string
    game_name: string
    game_id: string
    broadcaster_language: string
    title: string
    delay: number;
}

export interface ChannelsResponse {
    data: Channel[];
}