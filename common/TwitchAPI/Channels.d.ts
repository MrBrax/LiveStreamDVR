export interface Channel {
    broadcaster_id: string
    broadcaster_login: string
    broadcaster_name: string
    game_name: string
    game_id: string
    broadcaster_language: string
    title: string
    /** 2022-11-29 - requires user access token */
    delay: number;
    tags: string[];
    content_classification_labels: string[]; // Added 2023‑07‑10
    is_branded_content: boolean; // Added 2023‑07‑10
}

export interface ChannelsResponse {
    data: Channel[];
}