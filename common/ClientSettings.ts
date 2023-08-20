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
    theme: string;
    showOfflineCategoryInSidebar: boolean;
    sidemenuWidth: number;
    expandDashboardVodList: boolean;
    vodsToShowInDashboard: number;
    jobStatusExpandedByDefault: boolean;
    hideChapterTitlesAndGames: boolean;
};

export const defaultConfig: ClientSettings = {
    useSpeech: false,
    singlePage: false,
    enableNotifications: false,
    animationsEnabled: true,
    tooltipStatic: false,
    useRelativeTime: false,
    // showAdvancedInfo: false,
    useWebsockets: true,
    useBackgroundRefresh: true,
    useBackgroundTicker: true,
    websocketAddressOverride: "",
    expandVodList: true,
    vodsToShowInMenu: 4,
    // alwaysShowCapturingVodInMenu: false
    minimizeVodsByDefault: false,
    language: "en",
    theme: "auto",
    showOfflineCategoryInSidebar: true,
    sidemenuWidth: 330,
    expandDashboardVodList: true,
    vodsToShowInDashboard: 4,
    jobStatusExpandedByDefault: false,
    hideChapterTitlesAndGames: false,
};


export interface ClientSettingField<T> {
    name: string;
    type: T;
    default: any;
    help?: string;
    choices?: Record<string, string>;
    hidden?: boolean;
    category?: string;
}

export const defaultConfigFields: Record<keyof ClientSettings, ClientSettingField<string | boolean | number>> = {
    useSpeech: { type: "boolean", default: false, name: "Use speech to announce new streams", category: "Notifications" },
    singlePage: { type: "boolean", default: false, name: "Use a single page for all channels", category: "Interface" },
    enableNotifications: { type: "boolean", default: false, name: "Enable desktop notifications", category: "Notifications" },
    animationsEnabled: { type: "boolean", default: true, name: "Enable animations", help: "Flashing and fading animations for example.", category: "Interface" },
    tooltipStatic: { type: "boolean", default: false, name: "Make tooltips static", help: "Tooltips will stay at the top of the page.", category: "Interface" },
    useRelativeTime: { type: "boolean", default: false, name: "Use relative time for all times", help: "For example, '2 hours ago' instead of '2020-11-03 02:48:01'", category: "Interface" },
    // showAdvancedInfo: { type: "boolean", default: false, name: "Show advanced information in the stream list" },
    useWebsockets: { type: "boolean", default: true, name: "Use websockets to update the GUI", help: "Get instant updates for channel and vods.", category: "LiveUpdate" },
    useBackgroundRefresh: { type: "boolean", default: true, name: "Use a background refresh to update VODs", help: "Update channels every 15 minutes.", category: "LiveUpdate" },
    useBackgroundTicker: { type: "boolean", default: true, name: "Use a background ticker to update the GUI", help: "Use an interval to update channels and vods.", category: "LiveUpdate" },
    websocketAddressOverride: { type: "string", default: "", name: "Override the websocket address", category: "LiveUpdate" },
    expandVodList: { type: "boolean", default: true, name: "Always expand the VOD list in the menu", category: "Menu" },
    vodsToShowInMenu: { type: "number", default: 4, name: "Number of VODs to show in the menu", category: "Menu" },
    // alwaysShowCapturingVodInMenu: { type: "boolean", default: false, name: "Always show the capturing VOD in the menu" },
    minimizeVodsByDefault: { type: "boolean", default: false, name: "Minimize VODs by default", category: "Dashboard" },
    language: { type: "string", default: "en", name: "Language", hidden: true, category: "Interface" },
    theme: {
        type: "choice", default: "auto", name: "Theme", choices: {
            auto: "Auto",
            default: "Default",
            dark: "Dark",
            hotdogstand: "Hot dog stand",
            windows95: "Windows 95",
            basalt: "Basalt",
        }, category: "Interface"
    },
    showOfflineCategoryInSidebar: { type: "boolean", default: true, name: "Show the offline category of channels in the sidebar", category: "Menu" },
    sidemenuWidth: { type: "number", default: 330, name: "Width of the sidebar menu", category: "Menu" },
    expandDashboardVodList: { type: "boolean", default: true, name: "Always expand the VOD list in the dashboard", category: "Dashboard" },
    vodsToShowInDashboard: { type: "number", default: 4, name: "Number of VODs to show in the dashboard", category: "Dashboard" },
    jobStatusExpandedByDefault: { type: "boolean", default: false, name: "Expand the job status by default", category: "Interface" },
    hideChapterTitlesAndGames: { type: "boolean", default: false, name: "Hide chapter titles and games (spoiler mode)", category: "Interface" },
};