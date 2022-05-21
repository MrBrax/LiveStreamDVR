export type PHPDateTimeJSON = {
    date: string;
    timezone_type: number;
    timezone: string;
};

export type ClientSettings = {
    useSpeech: boolean;
    singlePage: boolean;
    enableNotifications: boolean;
    animationsEnabled: boolean;
    tooltipStatic: boolean;
    useRelativeTime: boolean;
    // showAdvancedInfo: boolean;
    useWebsockets: boolean;
    useBackgroundRefresh: boolean;
    useBackgroundTicker: boolean;
    websocketAddressOverride: string;
    expandVodList: boolean;
    vodsToShowInMenu: number;
    // alwaysShowCapturingVodInMenu: boolean;
    minimizeVodsByDefault: boolean;
    language: string;
};

export const phpDateFormat = "yyyy-MM-dd HH:mm:ss.SSSSSS"; // 2020-11-03 02:48:01.000000
