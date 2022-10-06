import { ClientSettings, SidemenuShow } from "./twitchautomator";

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
};

export const defaultSidemenuShow: SidemenuShow = {
    vod_date: true,
    vod_sxe: false,
    vod_sxe_absolute: false,
    vod_size: true,
    vod_duration: true,
    vod_basename: false,
};

interface ClientSettingField {
    name: string;
    type: string;
    default: any;
    help?: string;
    choices?: Record<string, string>;
    hidden?: boolean;
}

export const defaultConfigFields: Record<keyof ClientSettings, ClientSettingField> = {
    useSpeech: { type: "boolean", default: false, name: "Use speech to announce new streams" },
    singlePage: { type: "boolean", default: false, name: "Use a single page for all channels" },
    enableNotifications: { type: "boolean", default: false, name: "Enable desktop notifications" },
    animationsEnabled: { type: "boolean", default: true, name: "Enable animations", help: "Flashing and fading animations for example." },
    tooltipStatic: { type: "boolean", default: false, name: "Make tooltips static", help: "Tooltips will stay at the top of the page." },
    useRelativeTime: { type: "boolean", default: false, name: "Use relative time for all times" },
    // showAdvancedInfo: { type: "boolean", default: false, name: "Show advanced information in the stream list" },
    useWebsockets: { type: "boolean", default: true, name: "Use websockets to update the GUI", help: "Get instant updates for channel and vods." },
    useBackgroundRefresh: { type: "boolean", default: true, name: "Use a background refresh to update VODs", help: "Update channels every 15 minutes." },
    useBackgroundTicker: { type: "boolean", default: true, name: "Use a background ticker to update the GUI", help: "Use an interval to update channels and vods." },
    websocketAddressOverride: { type: "string", default: "", name: "Override the websocket address" },
    expandVodList: { type: "boolean", default: true, name: "Always expand the VOD list in the menu" },
    vodsToShowInMenu: { type: "number", default: 4, name: "Number of VODs to show in the menu" },
    // alwaysShowCapturingVodInMenu: { type: "boolean", default: false, name: "Always show the capturing VOD in the menu" },
    minimizeVodsByDefault: { type: "boolean", default: false, name: "Minimize VODs by default" },
    language: { type: "string", default: "en", name: "Language", hidden: true },
    theme: { type: "choice", default: "auto", name: "Theme", choices: { auto: "Auto", default: "Default", dark: "Dark", hotdogstand: "Hot dog stand", windows95: "Windows 95", basalt: "Basalt", } },
    showOfflineCategoryInSidebar: { type: "boolean", default: true, name: "Show the offline category of channels in the sidebar" },
    sidemenuWidth: { type: "number", default: 330, name: "Width of the sidebar menu" },
    expandDashboardVodList: { type: "boolean", default: true, name: "Always expand the VOD list in the dashboard"},
    vodsToShowInDashboard: {  type: "number", default: 4, name: "Number of VODs to show in the dashboard" },
    jobStatusExpandedByDefault: { type: "boolean", default: false, name: "Expand the job status by default" },
};

export const YouTubeCategories = {
    "1": "Film & Animation",
    "2": "Cars & Vehicles",
    "10": "Music",
    "15": "Pets & Animals",
    "17": "Sport",
    "19": "Travel & Events",
    "20": "Gaming",
    "22": "People & Blogs",
    "23": "Comedy",
    "24": "Entertainment",
    "25": "News & Politics",
    "26": "How-to & Style",
    "27": "Education",
    "28": "Science & Technology",
    "29": "Non-profits & Activism",
}