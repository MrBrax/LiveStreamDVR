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

export interface TwitchAuthTokenValidationResponse {
    client_id: string;
    login: string;
    scopes: string[];
    user_id: string;
    expires_in: number;
}