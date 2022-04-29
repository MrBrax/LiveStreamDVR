import { ClientSettings } from "./twitchautomator";

export const defaultConfig: ClientSettings = {
    useSpeech: false,
    singlePage: false,
    enableNotifications: false,
    animationsEnabled: true,
    tooltipStatic: false,
    useRelativeTime: false,
    showAdvancedInfo: false,
    useWebsockets: true,
    useBackgroundRefresh: true,
    useBackgroundTicker: true,
    websocketAddressOverride: "",
    expandVodList: true,
    vodsToShowInMenu: 4,
    alwaysShowCapturingVodInMenu: false
};
