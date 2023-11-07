import { BaseConfigDataFolder, BaseConfigPath } from "@/Core/BaseConfig";
import { Config } from "@/Core/Config";
import { KeyValue } from "@/Core/KeyValue";
import { LiveStreamDVR } from "@/Core/LiveStreamDVR";
import { LOGLEVEL, log } from "@/Core/Log";
import { BaseChannel } from "@/Core/Providers/Base/BaseChannel";
import { isYouTubeChannel } from "@/Helpers/Types";
import { YouTubeHelper } from "@/Providers/YouTube";
import type { BaseVODChapterJSON } from "@/Storage/JSON";
import type { ApiYouTubeChannel } from "@common/Api/Client";
import type { YouTubeChannelConfig } from "@common/Config";
import type { Providers } from "@common/Defs";
import type { ProxyVideo } from "@common/Proxies/Video";
import { youtube_v3 } from "@googleapis/youtube";
import axios from "axios";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { YouTubeVOD } from "./YouTubeVOD";

interface YouTubeChannelData extends youtube_v3.Schema$ChannelSnippet {
    _updated: number;
    id: string;
}

export class YouTubeChannel extends BaseChannel {
    static channels_cache: Record<string, YouTubeChannelData> = {};

    public channel_data?: YouTubeChannelData;

    public provider: Providers = "youtube";

    public channel_id = "";

    public vods_list: YouTubeVOD[] = [];

    public subbed_at: Date | undefined;
    public expires_at: Date | undefined;

    get livestreamUrl() {
        return `https://youtube.com/c/${this.channel_data?.customUrl}`;
    }

    public static getChannels(): YouTubeChannel[] {
        return (
            LiveStreamDVR.getInstance()
                .getChannels()
                .filter<YouTubeChannel>((channel): channel is YouTubeChannel =>
                    isYouTubeChannel(channel)
                ) || []
        );
    }

    static async create(config: YouTubeChannelConfig): Promise<YouTubeChannel> {
        const exists_config = LiveStreamDVR.getInstance().channels_config.find(
            (ch) =>
                ch.provider == "youtube" && ch.channel_id === config.channel_id
        );
        if (exists_config)
            throw new Error(
                `Channel ${config.channel_id} already exists in config`
            );

        // const exists_channel = TwitchChannel.channels.find(ch => ch.login === config.login);
        const exists_channel = LiveStreamDVR.getInstance()
            .getChannels()
            .find<YouTubeChannel>(
                (channel): channel is YouTubeChannel =>
                    isYouTubeChannel(channel) &&
                    channel.channel_id === config.channel_id
            );
        if (exists_channel)
            throw new Error(
                `Channel ${config.channel_id} already exists in channels`
            );

        const data = await YouTubeChannel.getUserDataById(config.channel_id);
        if (!data)
            throw new Error(
                `Could not get channel data for channel login: ${config.channel_id}`
            );

        config.uuid = randomUUID();

        LiveStreamDVR.getInstance().channels_config.push(config);
        LiveStreamDVR.getInstance().saveChannelsConfig();

        const channel = await YouTubeChannel.loadFromId(config.channel_id);
        if (!channel || !channel.channel_id)
            throw new Error(`Channel ${config.channel_id} could not be loaded`);

        if (
            Config.getInstance().cfg<string>("app_url", "") !== "" &&
            Config.getInstance().cfg<string>("app_url", "") !== "debug" &&
            !Config.getInstance().cfg<boolean>("isolated_mode")
        ) {
            try {
                await YouTubeChannel.subscribe(channel.channel_id);
            } catch (error) {
                log(
                    LOGLEVEL.ERROR,
                    "yt.channel",
                    `Failed to subscribe to channel ${channel.channel_id}: ${
                        (error as Error).message
                    }`
                );
                LiveStreamDVR.getInstance().channels_config =
                    LiveStreamDVR.getInstance().channels_config.filter(
                        (ch) =>
                            ch.provider == "youtube" &&
                            ch.channel_id !== config.channel_id
                    ); // remove channel from config
                LiveStreamDVR.getInstance().saveChannelsConfig();
                // throw new Error(`Failed to subscribe to channel ${channel.login}: ${(error as Error).message}`, { cause: error });
                throw error; // rethrow error
            }
        } else if (Config.getInstance().cfg("app_url") == "debug") {
            log(
                LOGLEVEL.WARNING,
                "yt.channel",
                `Not subscribing to ${channel.channel_id} due to debug app_url.`
            );
        } else if (Config.getInstance().cfg("isolated_mode")) {
            log(
                LOGLEVEL.WARNING,
                "yt.channel",
                `Not subscribing to ${channel.channel_id} due to isolated mode.`
            );
        } else {
            log(
                LOGLEVEL.ERROR,
                "yt.channel",
                `Can't subscribe to ${channel.channel_id} due to either no app_url or isolated mode disabled.`
            );
            LiveStreamDVR.getInstance().channels_config =
                LiveStreamDVR.getInstance().channels_config.filter(
                    (ch) =>
                        ch.provider == "youtube" &&
                        ch.channel_id !== config.channel_id
                ); // remove channel from config
            LiveStreamDVR.getInstance().saveChannelsConfig();
            throw new Error(
                "Can't subscribe due to either no app_url or isolated mode disabled."
            );
        }

        LiveStreamDVR.getInstance().addChannel(channel);

        /*
        if (yt.channel.axios) { // bad hack?
            const streams = await TwitchChannel.getStreams(channel.userid);
            if (streams && streams.length > 0) {
                KeyValue.getInstance().setBool(`${channel.login}.online`, true);
            }
        }
        */

        return channel;
    }

    public static async loadFromId(
        channel_id: string
    ): Promise<YouTubeChannel> {
        if (!channel_id) throw new Error("Streamer login is empty");
        if (typeof channel_id !== "string")
            throw new TypeError("Streamer id is not a string");
        log(LOGLEVEL.DEBUG, "yt.channel", `Load from login ${channel_id}`);
        // const channel_id = await this.channelIdFromLogin(channel_id);
        // if (!channel_id) throw new Error(`Could not get channel id from login: ${channel_id}`);
        return await this.loadAbstract(channel_id); // $channel;
    }

    public static async loadAbstract(
        channel_id: string
    ): Promise<YouTubeChannel> {
        log(LOGLEVEL.DEBUG, "yt.channel", `Load channel ${channel_id}`);

        const channel_memory = LiveStreamDVR.getInstance()
            .getChannels()
            .find<YouTubeChannel>(
                (channel): channel is YouTubeChannel =>
                    isYouTubeChannel(channel) &&
                    channel.channel_id === channel_id
            );
        if (channel_memory) {
            log(
                LOGLEVEL.WARNING,
                "yt.channel",
                `Channel ${channel_id} already loaded`
            );
            return channel_memory;
        }

        const channel = new this();
        channel.channel_id = channel_id;

        const channel_data = await this.getUserDataById(channel_id);
        if (!channel_data)
            throw new Error(
                `Could not get channel data for channel id: ${channel_id}`
            );

        // const channel_login = channel_data.login;

        const channel_config = LiveStreamDVR.getInstance().channels_config.find(
            (c) => c.provider == "youtube" && c.channel_id === channel_id
        );
        if (!channel_config)
            throw new Error(
                `Could not find channel config in memory for channel id: ${channel_id}`
            );

        channel.uuid = channel_config.uuid;
        channel.channel_data = channel_data;
        channel.config = channel_config;

        // channel.login = channel_data.login;
        channel.display_name = channel_data.title || "";
        // channel.description = channel_data.description || "";
        // channel.profile_image_url = channel_data.profile_image_url;
        // channel.broadcaster_type = channel_data.broadcaster_type;
        channel.applyConfig(channel_config);

        if (
            await KeyValue.getInstance().getBoolAsync(
                `yt.${channel.channel_id}.online`
            )
        ) {
            log(
                LOGLEVEL.WARNING,
                "yt.channel",
                `Channel ${channel.channel_id} is online, stale?`
            );
        }

        if (
            await KeyValue.getInstance().hasAsync(
                `yt.${channel.channel_id}.channeldata`
            )
        ) {
            log(
                LOGLEVEL.WARNING,
                "yt.channel",
                `Channel ${channel.channel_id} has stale chapter data.`
            );
        }

        /*
            $subfile = TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . "subs.json";
            if (file_exists($subfile)) {
                $sub_data = json_decode(file_get_contents($subfile), true);
                if (isset($sub_data[$channel->display_name])) {
                    if (isset($sub_data[$channel->display_name]['subbed_at']))
                        $channel->subbed_at = \DateTime::createFromFormat(TwitchHelper::DATE_FORMAT, $sub_data[$channel->display_name]['subbed_at']);

                    if (isset($sub_data[$channel->display_name]['expires_at']))
                        $channel->expires_at = \DateTime::createFromFormat(TwitchHelper::DATE_FORMAT, $sub_data[$channel->display_name]['expires_at']);
                }
            }
        */

        // $channel->api_getSubscriptionStatus = $channel->getSubscriptionStatus();

        channel.makeFolder();

        // only needed if i implement watching
        // if (!fs.existsSync(path.join(BaseConfigDataFolder.saved_clips, "scheduler", channel.login)))
        //     fs.mkdirSync(path.join(BaseConfigDataFolder.saved_clips, "scheduler", channel.login), { recursive: true });
        //
        // if (!fs.existsSync(path.join(BaseConfigDataFolder.saved_clips, "downloader", channel.login)))
        //     fs.mkdirSync(path.join(BaseConfigDataFolder.saved_clips, "downloader", channel.login), { recursive: true });
        //
        // if (!fs.existsSync(path.join(BaseConfigDataFolder.saved_clips, "editor", channel.login)))
        //     fs.mkdirSync(path.join(BaseConfigDataFolder.saved_clips, "editor", channel.login), { recursive: true });

        // await channel.parseVODs();

        // await channel.findClips();

        // channel.saveKodiNfo();

        /*
        try {
            await channel.updateChapterData();
        } catch (error) {
            logAdvanced(LOGLEVEL.ERROR, "yt.channel", `Failed to update chapter data for channel ${channel.login}: ${(error as Error).message}`);
        }
        */

        return channel;
    }

    public static async getUserDataById(
        channel_id: string,
        force = false
    ): Promise<YouTubeChannelData | false> {
        return await this.getUserDataProxy("id", channel_id, force);
    }

    public static async getUserDataByUsername(
        username: string,
        force = false
    ): Promise<YouTubeChannelData | false> {
        return await this.getUserDataProxy("username", username, force);
    }

    static async getUserDataProxy(
        method: "id" | "username",
        identifier: string,
        force = false
    ): Promise<false | YouTubeChannelData> {
        if (!identifier) {
            throw new Error("No identifier supplied");
        }

        log(
            LOGLEVEL.DEBUG,
            "yt.channel",
            `Fetching user data for ${method} ${identifier}, force: ${force}`
        );

        // check cache first
        if (!force) {
            const channelData =
                method == "id"
                    ? this.channels_cache[identifier]
                    : Object.values(this.channels_cache).find(
                          (channel) => channel.customUrl == identifier
                      );
            if (channelData) {
                log(
                    LOGLEVEL.DEBUG,
                    "yt.channel",
                    `User data found in memory cache for ${method} ${identifier}`
                );
                if (
                    Date.now() >
                    channelData._updated + Config.streamerCacheTime
                ) {
                    log(
                        LOGLEVEL.INFO,
                        "yt.channel.getUserDataProxy",
                        `Memory cache for ${identifier} is outdated, fetching new data`
                    );
                } else {
                    log(
                        LOGLEVEL.DEBUG,
                        "yt.channel",
                        `Returning memory cache for ${method} ${identifier}`
                    );
                    return channelData;
                }
            } else {
                log(
                    LOGLEVEL.DEBUG,
                    "yt.channel",
                    `User data not found in memory cache for ${method} ${identifier}, continue fetching`
                );
            }

            if (
                await KeyValue.getInstance().hasAsync(`${identifier}.deleted`)
            ) {
                log(
                    LOGLEVEL.WARNING,
                    "yt.channel.getUserDataProxy",
                    `Channel ${identifier} is deleted, ignore. Delete kv file to force update.`
                );
                return false;
            }
        }

        if (!YouTubeHelper.oAuth2Client) {
            log(
                LOGLEVEL.WARNING,
                "yt.channel.getUserDataProxy",
                `No oAuth2Client, can't fetch channel data for ${identifier}`
            );
            return false;
        }

        const service = new youtube_v3.Youtube({
            auth: YouTubeHelper.oAuth2Client,
        });

        let res;

        if (method == "id") {
            try {
                res = await service.channels.list({
                    id: [identifier],
                    part: ["snippet"],
                });
            } catch (error) {
                log(
                    LOGLEVEL.WARNING,
                    "yt.channel.getUserDataProxy",
                    `Channel data for ${identifier} error: ${
                        (error as Error).message
                    }`
                );
                return false;
            }
        } else {
            try {
                res = await service.channels.list({
                    forUsername: identifier,
                    part: ["snippet"],
                });
            } catch (error) {
                log(
                    LOGLEVEL.WARNING,
                    "yt.channel.getUserDataProxy",
                    `Channel data for ${identifier} error: ${
                        (error as Error).message
                    }`
                );
                return false;
            }
        }

        if (!res.data) return false;
        if (!res.data.items || res.data.items.length == 0) return false;
        if (!res.data.items[0].snippet) return false;

        // use as ChannelData
        const userData = res.data.items[0].snippet as YouTubeChannelData;
        userData._updated = Date.now();
        userData.id = res.data.items[0].id || "";

        // insert into memory and save to file
        // console.debug(`Inserting user data for ${method} ${identifier} into cache and file`);
        YouTubeChannel.channels_cache[userData.id] = userData;
        fs.writeFileSync(
            BaseConfigPath.streamerYouTubeCache,
            JSON.stringify(YouTubeChannel.channels_cache)
        );

        return userData;
    }

    static getChannelById(channel_id: string): YouTubeChannel | undefined {
        return LiveStreamDVR.getInstance()
            .getChannels()
            .find<YouTubeChannel>(
                (ch): ch is YouTubeChannel =>
                    isYouTubeChannel(ch) && ch.channel_id === channel_id
            );
    }

    public static loadChannelsCache(): boolean {
        if (!fs.existsSync(BaseConfigPath.streamerYouTubeCache)) return false;

        const data = fs.readFileSync(
            BaseConfigPath.streamerYouTubeCache,
            "utf8"
        );
        this.channels_cache = JSON.parse(data);
        log(
            LOGLEVEL.SUCCESS,
            "yt.channel",
            `Loaded ${
                Object.keys(this.channels_cache).length
            } YouTube channels from cache.`
        );
        return true;
    }

    static async subscribe(channel_id: string): Promise<boolean> {
        if (!Config.getInstance().hasValue("app_url")) {
            throw new Error("app_url is not set");
        }

        if (Config.getInstance().cfg("app_url") === "debug") {
            throw new Error(
                "app_url is set to debug, no subscriptions possible"
            );
        }

        let hook_callback = `${Config.getInstance().cfg(
            "app_url"
        )}/api/v0/hook/youtube`;

        if (Config.getInstance().hasValue("instance_id")) {
            hook_callback +=
                "?instance=" + Config.getInstance().cfg("instance_id");
        }

        // if (!Config.getInstance().cfg("eventsub_secret")) {
        //     throw new Error("eventsub_secret is not set");
        // }

        const form = new FormData();
        form.append("hub.callback", hook_callback);
        form.append(
            "hub.topic",
            `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${channel_id}`
        );
        form.append("hub.verify", "sync");
        form.append("hub.mode", "subscribe");
        form.append("hub.verify_token", "");
        form.append("hub.secret", "");
        form.append("hub.lease_seconds", "");

        let request;
        try {
            request = await axios.post(
                "https://pubsubhubbub.appspot.com/subscribe",
                form,
                {
                    // "credentials": "omit",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                        // "Upgrade-Insecure-Requests": "1",
                        // "Sec-Fetch-Dest": "document",
                        // "Sec-Fetch-Mode": "navigate",
                        // "Sec-Fetch-Site": "same-origin",
                        // "Sec-Fetch-User": "?1"
                    },
                    // "referrer": "https://pubsubhubbub.appspot.com/subscribe",
                    method: "POST",
                    // "mode": "cors",
                }
            );
        } catch (error) {
            if (axios.isAxiosError(error)) {
                log(
                    LOGLEVEL.ERROR,
                    "yt.channel.subscribe",
                    `Could not subscribe to ${channel_id}: ${error.message} / ${error.response?.data.message}`
                );
            }
            return false;
        }

        if (request.status == 204) {
            log(
                LOGLEVEL.SUCCESS,
                "yt.channel.subscribe",
                `Subscribe for ${channel_id} sent.`
            );
            return true;
        }

        log(
            LOGLEVEL.ERROR,
            "yt.channel.subscribe",
            `Could not subscribe to ${channel_id}: ${request.data}`
        );

        return false;
    }

    // public getFolder(): string {
    //     return yt.channel.vodFolder(this.internalName);
    // }

    public async postLoad(): Promise<void> {
        // this.setupStreamNumber();
        // if (!KeyValue.getInstance().has(`${this.login}.saves_vods`)) {
        //     this.checkIfChannelSavesVods();
        // }
        // this.addAllLocalVideos();
        await this.parseVODs();
        this.startWatching();
    }

    public getVods(): YouTubeVOD[] {
        return this.vods_list;
    }

    public getVodByIndex(index: number): YouTubeVOD | undefined {
        if (index < 0 || index >= this.vods_list.length) {
            return undefined;
        }
        return this.vods_list[index];
    }

    get current_vod(): YouTubeVOD | undefined {
        return this.getVods().find((vod) => vod.is_capturing);
    }

    public override async toAPI(): Promise<ApiYouTubeChannel> {
        const vods_list = await Promise.all(
            this.getVods().map(async (vod) => await vod.toAPI())
        );

        return {
            ...(await super.toAPI()),
            provider: "youtube",
            channel_id: this.channel_id || "",
            display_name: this.displayName || "",
            description: this.description || "",
            profile_image_url:
                this.channel_data?.thumbnails?.default?.url || "",
            vods_list: vods_list || [],

            subbed_at: this.subbed_at
                ? this.subbed_at.toISOString()
                : undefined,
            expires_at: this.expires_at
                ? this.expires_at.toISOString()
                : undefined,

            chapter_data: this.getChapterData(),

            api_getSubscriptionStatus: false, // TODO: implement? or legacy

            // saves_vods: this.saves_vods,
        };
    }

    get saves_vods(): boolean {
        return KeyValue.getInstance().getBool(
            `yt.${this.channel_id}.saves_vods`
        );
    }

    public getChapterData(): BaseVODChapterJSON | undefined {
        const cd = KeyValue.getInstance().get(
            `yt.${this.channel_id}.chapterdata`
        );
        return cd ? (JSON.parse(cd) as BaseVODChapterJSON) : undefined;
    }

    public async startWatching(): Promise<void> {
        return await Promise.resolve();
    }

    get latest_vod(): YouTubeVOD | undefined {
        if (!this.getVods() || this.getVods().length == 0) return undefined;
        return this.getVodByIndex(this.getVods().length - 1); // is this reliable?
    }

    /**
     * Create an empty VOD object. This is the only method to use to create a new VOD. Do NOT use the constructor of the VOD class.
     *
     * @param filename The filename of the vod including json extension.
     * @returns Empty VOD
     */
    public async createVOD(filename: string): Promise<YouTubeVOD> {
        if (!this.channel_id) throw new Error("Channel id is not set");
        // if (!this.login) throw new Error("Channel login is not set");
        if (!this.internalName)
            throw new Error("Channel display_name is not set");

        log(
            LOGLEVEL.INFO,
            "yt.channel.createVOD",
            `Create VOD JSON for ${this.channel_id}: ${path.basename(
                filename
            )} @ ${path.dirname(filename)}`
        );

        const vod = new YouTubeVOD();

        vod.created = true;
        vod.not_started = true;

        vod.filename = filename;
        vod.basename = path.basename(filename, ".json");
        vod.directory = path.dirname(filename);

        vod.streamer_name = this.displayName;
        // vod.streamer_login = this.login;
        vod.streamer_id = this.internalId;

        if (this.uuid) {
            vod.channel_uuid = this.uuid;
            log(
                LOGLEVEL.INFO,
                "yt.channel.createVOD",
                `Set channel uuid to ${this.uuid} for ${vod.basename}`
            );
        } else {
            throw new Error("Channel uuid is not set");
        }

        vod.created_at = new Date();

        vod.uuid = randomUUID();

        await vod.saveJSON("create json");

        // reload
        const load_vod = await YouTubeVOD.load(vod.filename, true);

        // TwitchVOD.addVod(vod);
        this.addVod(load_vod);
        this.sortVods();

        // add to database
        // this.vods_raw.push(path.relative(BaseConfigDataFolder.vod, filename));
        // fs.writeFileSync(path.join(BaseConfigDataFolder.vods_db, `${this.channel_id}.json`), JSON.stringify(this.vods_raw));
        this.addVodToDatabase(
            path.relative(BaseConfigDataFolder.vod, filename)
        );
        this.saveVodDatabase();

        try {
            this.checkStaleVodsInMemory();
        } catch (error) {
            log(
                LOGLEVEL.ERROR,
                "yt.channel.createVOD",
                `Error while checking stale vods in memory: ${error}`
            );
        }

        return load_vod;
    }

    /**
     * Update and save channel config
     *
     * @param config
     */
    public update(config: YouTubeChannelConfig): boolean {
        const i = LiveStreamDVR.getInstance().channels_config.findIndex(
            (ch) => ch.uuid === this.uuid
        );
        if (i !== -1) {
            this.config = config;
            this.applyConfig(config);
            log(
                LOGLEVEL.INFO,
                "yt.channel.update",
                `Replacing channel config for ${this.internalName}`
            );
            LiveStreamDVR.getInstance().channels_config[i] = config;
            LiveStreamDVR.getInstance().saveChannelsConfig();
            return true;
        } else {
            log(
                LOGLEVEL.ERROR,
                "yt.channel.update",
                `Could not update channel ${this.internalName}`
            );
        }
        return false;
    }

    get displayName(): string {
        return this.channel_data?.title || "";
    }

    get internalName(): string {
        return this.channel_data?.customUrl || "";
    }

    get internalId(): string {
        return this.channel_data?.id || "";
    }

    get url(): string {
        return `https://www.youtube.com/c/${this.internalName}`;
    }

    get description(): string {
        return this.channel_data?.description || "";
    }

    get profilePictureUrl(): string {
        return this.channel_data?.thumbnails?.default?.url || "";
    }

    public async refreshData(): Promise<boolean> {
        if (!this.channel_id) throw new Error("Channel id not set");
        log(
            LOGLEVEL.INFO,
            "channel.refreshData",
            `Refreshing data for ${this.internalName}`
        );

        const channel_data = await YouTubeChannel.getUserDataById(
            this.channel_id,
            true
        );

        if (channel_data) {
            this.channel_data = channel_data;
            this.channel_id = channel_data.id;
            // this.login = channel_data.login;
            // this.display_name = channel_data.display_name;
            // this.profile_image_url = channel_data.profile_image_url;
            // this.broadcaster_type = channel_data.broadcaster_type;
            // this.description = channel_data.description;
            return true;
        }

        return false;
    }

    public async getVideos(): Promise<false | ProxyVideo[]> {
        return await YouTubeVOD.getVideosProxy(this.channel_id);
    }

    public async getStreams(): Promise<false | youtube_v3.Schema$SearchResult> {
        if (!YouTubeHelper.oAuth2Client) {
            log(
                LOGLEVEL.WARNING,
                "yt.channel.getStreams",
                `No oAuth2Client, can't fetch channel data for ${this.internalName}`
            );
            return false;
        }

        const service = new youtube_v3.Youtube({
            auth: YouTubeHelper.oAuth2Client,
        });

        // service.liveBroadcasts.list({
        //     id:
        // })

        let searchResponse;
        try {
            searchResponse = await service.search.list({
                channelId: this.channel_id,
                eventType: "live",
                type: ["video"],
                part: ["id", "snippet"],
            });
        } catch (error) {
            console.log(error);
            return false;
        }

        if (!searchResponse.data) return false;
        if (!searchResponse.data.items || searchResponse.data.items.length == 0)
            return false;

        console.log(searchResponse.data.items[0]);

        return searchResponse.data.items[0];
    }

    public async isLiveApi(): Promise<boolean> {
        return (await this.getStreams()) !== false;
    }

    public async parseVODs(rescan = false): Promise<void> {
        if (
            fs.existsSync(
                path.join(
                    BaseConfigDataFolder.vods_db,
                    `${this.internalName}.json`
                )
            ) &&
            !rescan
        ) {
            let list: string[] = JSON.parse(
                fs.readFileSync(
                    path.join(
                        BaseConfigDataFolder.vods_db,
                        `${this.internalName}.json`
                    ),
                    { encoding: "utf-8" }
                )
            );
            log(
                LOGLEVEL.DEBUG,
                "channel.yt",
                `Found ${list.length} stored VODs in database for ${this.internalName}`
            );
            // console.log(list);
            list = list.filter((p) =>
                fs.existsSync(path.join(BaseConfigDataFolder.vod, p))
            );
            // console.log(list);
            this.vods_raw = list;
            log(
                LOGLEVEL.DEBUG,
                "channel.yt",
                `Found ${this.vods_raw.length} existing VODs in database for ${this.internalName}`
            );
        } else {
            this.vods_raw = this.rescanVods();
            log(
                LOGLEVEL.INFO,
                "channel.yt",
                `No VODs in database found for ${this.internalName}, migrate ${this.vods_raw.length} from recursive file search`
            );
            // fs.writeFileSync(path.join(BaseConfigDataFolder.vods_db, `${this.internalName}.json`), JSON.stringify(this.vods_raw));
            this.saveVodDatabase();
        }

        this.vods_list = [];

        for (const vod of this.vods_raw) {
            log(LOGLEVEL.DEBUG, "channel.yt", `Try to parse VOD ${vod}`);

            const vod_full_path = path.join(BaseConfigDataFolder.vod, vod);

            let vodclass;

            try {
                vodclass = await YouTubeVOD.load(vod_full_path, true);
            } catch (e) {
                log(
                    LOGLEVEL.ERROR,
                    "channel.yt",
                    `Could not load VOD ${vod}: ${(e as Error).message}`,
                    e
                );
                console.error(e);
                continue;
            }

            if (!vodclass) {
                continue;
            }

            if (!vodclass.channel_uuid) {
                log(
                    LOGLEVEL.INFO,
                    "channel.yt",
                    `VOD '${vod}' does not have a channel UUID, setting it to '${this.uuid}'`
                );
                vodclass.channel_uuid = this.uuid;
            }

            let noIssues = false;
            do {
                noIssues = await vodclass.fixIssues("Channel parseVODs");
            } while (!noIssues);

            log(
                LOGLEVEL.DEBUG,
                "channel.yt",
                `VOD ${vod} added to ${this.internalName}`
            );

            this.addVod(vodclass);
        }
        this.sortVods();
    }

    public static async getChannelIdFromUrl(
        url: string
    ): Promise<string | false> {
        // const match = url.match(/youtube\.com\/c\/([^/]+)/);
        // if (match) {
        //     return match[1];
        // }

        // to get the channel id, the page needs to be parsed. very bad but there's no api for that
        let response;
        try {
            response = await axios.get(url);
        } catch (error) {
            log(
                LOGLEVEL.ERROR,
                "channel.yt",
                "Could not get channel id from url",
                error
            );
            return false;
        }

        const html = response.data;

        const match2 = html.match(/"channelId":"([^"]+)"/);
        if (match2) {
            return match2[1];
        }

        const match3 = html.match(/itemprop="channelId" content="([^"]+)"/);
        if (match3) {
            return match3[1];
        }

        return false;
    }
}
