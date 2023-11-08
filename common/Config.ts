import type { Providers } from "./Defs";

export type VideoQuality =
    | "best"
    | "1080p60"
    | "1080p"
    | "720p60"
    | "720p"
    | "480p"
    | "360p"
    | "160p"
    | "140p"
    | "worst"
    | "audio_only";

/*
export interface SettingField<T> {
    // key: string;
    group: string;
    text: string;

    /**
     * Value type
     *
    type: "string" | "number" | "boolean" | "array" | "template";
    // type: T;

    /** Default value *
    default?: T;

    /** Array of choices *
    choices?: string[] | Record<string, string>;

    /** Help text to appear next to field in settings *
    help?: string;

    /** Required to save settings? *
    required?: boolean;

    /** Automatically strip slashes? *
    stripslash?: boolean;

    /** Send to client? *
    secret?: boolean;

    deprecated?: boolean | string;

    pattern?: string;

    restart_required?: boolean;

    replacements?: Record<
        string,
        { display: string; description?: string; deprecated?: boolean }
    >;
    context?: string;

    guest?: boolean;

    multiline?: boolean;

    /** highlight the setting on the config page *
    new?: boolean;

    migrate?: string;
}
*/

export interface BaseSettingField {
    group: string;
    text: string;
    help?: string;
    required?: boolean;
    secret?: boolean;
    deprecated?: boolean | string;
    restart_required?: boolean;
    guest?: boolean;
    new?: boolean;
    migrate?: string;
}

export interface StringSettingField extends BaseSettingField {
    type: "string";
    default?: string;
    choices?: string[] | Record<string, string>;
    stripslash?: boolean;
    pattern?: string;
    multiline?: boolean;
}

export interface NumberSettingField extends BaseSettingField {
    type: "number";
    default?: number;
    min?: number;
    max?: number;
}

export interface BooleanSettingField extends BaseSettingField {
    type: "boolean";
    default?: boolean;
}

export interface ArraySettingField extends BaseSettingField {
    type: "array";
    default?: string;
    choices: Array<string>;
}

export interface ObjectSettingField extends BaseSettingField {
    type: "object";
    default?: string;
    choices: Record<string, string>;
}

export interface TemplateSettingField extends BaseSettingField {
    type: "template";
    default?: string;
    replacements?: Record<
        string,
        { display: string; description?: string; deprecated?: boolean }
    >;
    context?: string;
}

export type SettingField =
    | StringSettingField
    | NumberSettingField
    | BooleanSettingField
    | ArraySettingField
    | ObjectSettingField
    | TemplateSettingField;

export interface BaseChannelConfig {
    provider: Providers;
    uuid: string;
    internalId: string;
    internalName: string;
    quality: VideoQuality[];
    match: string[];
    download_chat: boolean;
    burn_chat: boolean;
    no_capture: boolean;
    live_chat: boolean;
    no_cleanup: boolean;
    max_storage: number;
    max_vods: number;
    download_vod_at_end: boolean;
    download_vod_at_end_quality: VideoQuality;
}

export interface TwitchChannelConfig extends BaseChannelConfig {
    provider: "twitch";

    /** @deprecated */
    login?: string;
}

export interface YouTubeChannelConfig extends BaseChannelConfig {
    provider: "youtube";

    /** @deprecated */
    channel_id?: string;
}

export interface KickChannelConfig extends BaseChannelConfig {
    provider: "kick";

    /** @deprecated */
    slug: string;
}

export type ChannelConfig =
    | TwitchChannelConfig
    | YouTubeChannelConfig
    | KickChannelConfig;
