
export type BroadcasterType = "partner" | "affiliate" | "";
export interface User {
    id: string;
    login: string;
    display_name: string;
    type: string;
    broadcaster_type: BroadcasterType;
    description: string;
    profile_image_url: string;
    offline_image_url: string;
    /** @deprecated */
    view_count: number;
    email?: string;
    created_at: string;
}

export interface UsersResponse {
    data: User[];
}
