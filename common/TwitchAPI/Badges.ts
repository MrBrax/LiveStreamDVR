export interface GlobalChatBadgesResponse  {
    data: ChatBadge[];
}

export interface ChatBadgesResponse {
    data: ChatBadge[];
}

export interface ChatBadge {
    set_id: string;
    versions: ChatBadgeVersion[];
}

export interface ChatBadgeVersion {
    id: string;
    image_url_1x: string;
    image_url_2x: string;
    image_url_4x: string;
    title: string;
    description: string;
    click_action: string | null;
    click_url: string | null;
}