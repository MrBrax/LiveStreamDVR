import { ChannelConfig, SettingField } from "../Config";
import { ApiChannel, ApiGame, ApiVod } from "./Client";

interface ApiResponse {
    data: any;
    status: string;
    message?: string;
}

export interface ApiSettingsResponse extends ApiResponse {
    data: {
        config: Record<string, any>;
        // config: ApiConfig;
        channels: ChannelConfig[];
        favourite_games: string[];
        // fields: Record<string, SettingField<any>>;
        fields: SettingField<string | number | boolean>[];
        version: string;
        server: string;
    };
}

export interface ApiGamesResponse extends ApiResponse {
    data: Record<string, ApiGame>;
}

export interface ApiChannelsResponse extends ApiResponse {
    data: {
        streamers_list: ApiChannel[];
        total_size: number;
        free_size: number;
    };
}

export interface ApiVodResponse extends ApiResponse {
    data: ApiVod;
}