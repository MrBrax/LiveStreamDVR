import { settingsFields } from "../ServerConfig";
import type { ChannelConfig } from "../Config";
import type { AboutData } from "./About";
import type { ApiChannels, ApiFile, ApiGame, ApiJob, ApiLogLine, ApiVods } from "./Client";

export interface ApiResponse {
    data: any;
    status: "OK";
    message?: string;
}

export interface ApiErrorResponse {
    status: "ERROR";
    message: string;
}

export interface ApiQuotas {
    twitch: {
        max_total_cost: number;
        total_cost: number;
        total: number;
    };
    websockets: {
        id: string;
        max_total_cost: number;
        total_cost: number;
        total: number;
    }[];
}

export interface ApiSettingsResponse extends ApiResponse {
    data: {
        app_name: string;
        config: Record<string, any>;
        // config: ApiConfig;
        channels: ChannelConfig[];
        favourite_games: string[];
        // fields: Record<string, SettingField<any>>;
        fields: typeof settingsFields,
        version: string;
        server: string;
        websocket_url: string;
        errors?: string[];
        guest: boolean;
        server_git_hash?: string;
        server_git_branch?: string;
        quotas: ApiQuotas;
        websocket_quotas: {
            id: string;
            max_total_cost: number;
            total_cost: number;
            total: number;
            subscriptions: number;
        }[];
    };
}

export interface ApiGamesResponse extends ApiResponse {
    data: Record<string, ApiGame>;
}

export interface ApiChannelsResponse extends ApiResponse {
    data: {
        streamer_list: ApiChannels[];
        total_size: number;
        free_size: number;
    };
}

export interface ApiChannelResponse extends ApiResponse {
    data: ApiChannels;
}

export interface ApiVodResponse extends ApiResponse {
    data: ApiVods;
}

export interface ApiLogResponse extends ApiResponse {
    data: {
        lines: ApiLogLine[];
        last_line: number;
        logs: string[];
    };
}

export interface ApiFavouriteGamesResponse extends ApiResponse {
    data: string[];
}

export interface ApiJobsResponse extends ApiResponse {
    data: ApiJob[];
}

export interface ApiFilesResponse extends ApiResponse {
    data: {
        files: ApiFile[];
    }
}

export interface ApiAuthResponse {
    authentication: boolean;
    authenticated: boolean;
    guest_mode: boolean;
    message?: string;
}

export interface ApiLoginResponse {
    authenticated: boolean;
    message?: string;
    status: "OK" | "ERROR";
}

/**
 * Generic API response, use any kind of T data object
 */
export interface IApiResponse<T> {
    data: T;
    status: "OK";
    message?: string;
}

export interface ApiAboutResponse extends ApiResponse {
    data: AboutData;
}