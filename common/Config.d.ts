export type VideoQuality = "best" | "1080p60" | "1080p" | "720p60" | "720p" | "480p" | "360p" | "160p" | "140p" | "worst";

export interface SettingField<T> {
    key: string;
    group: string;
    text: string;

    /**
     * Value type
     */
    type: "string" | "number" | "boolean" | "array";
    // type: T;

    /** Default value */
    default?: T;

    /** Array of choices */
    choices?: T[];

    /** Help text to appear next to field in settings */
    help?: string;

    /** Required to save settings? */
    required?: boolean;

    /** Automatically strip slashes? */
    stripslash?: boolean;

    /** Send to client? */
    secret?: boolean;
}

export interface ChannelConfig {
    login: string;
    quality: VideoQuality[];
    match: string[];
    download_chat: boolean;
    burn_chat: boolean;
    no_capture: boolean;
}

export enum SubStatus {
    NONE = "0",
    WAITING = "1",
    SUBSCRIBED = "2",
    FAILED = "3",
}