export interface TwitchAuthAppTokenResponse {
    access_token: string;
    expires_in: number;
    token_type: string;
}

export interface TwitchAuthUserTokenResponse {
    access_token: string;
    expires_in: number;
    refresh_token: string;
    scope: string[];
    token_type: string;
}