import { ErrorResponse, EventSubTypes } from "../TwitchAPI/Shared";
import { Stream, StreamsResponse } from "../TwitchAPI/Streams";
import { SubscriptionRequest, SubscriptionResponse } from "../TwitchAPI/Subscriptions";
import { User, Users } from "../TwitchAPI/Users";
import axios from "axios";
import fs from "fs";
import path from "path";
import { BaseConfigPath } from "./BaseConfig";
import { KeyValue } from "./KeyValue";
import { TwitchConfig, VideoQuality } from "./TwitchConfig";
import { TwitchHelper } from "./TwitchHelper";
import { LOGLEVEL, TwitchLog } from "./TwitchLog";
import { TwitchVOD } from "./TwitchVOD";
import { TwitchVODChapter } from "./TwitchVODChapter";
interface ChannelData extends User {
    _updated: number;
    cache_avatar: string;
}

export interface ChannelConfig {
    login: string;
    quality: VideoQuality[];
    match: string[];
    download_chat: boolean;
    burn_chat: boolean;
    no_capture: boolean;
}

export class TwitchChannel {

    static channels: TwitchChannel[] = [];
    static channels_config: ChannelConfig[] = [];
    static channels_cache: Record<string, ChannelData> = {};

    /**
     * User ID
     */
    public userid: string | undefined;

    /**
     * Login name, used in URLs
     */
    public login: string | undefined;

    /**
     * Channel data directly from Twitch
     */
    public channel_data: ChannelData | undefined;

    /**
     * Channel config from config file
     */
    public config: ChannelConfig | undefined;

    /**
     * Display name used in chats and profile pages.
     */
    public display_name: string | undefined;

    public description: string | undefined;
    public profile_image_url: string | undefined;
    public quality: VideoQuality[] | undefined;
    public match: string[] | undefined;
    public download_chat: boolean | undefined;

    /** Don't capture, just exist */
    public no_capture: boolean | undefined;

    /** 
     * Burn chat after capturing.
     * Currently not used.
     */
    public burn_chat: boolean | undefined;

    public vods_raw: string[] | undefined;
    public vods_list: TwitchVOD[] | undefined;
    public vods_size: number | undefined;

    // public current_vod: TwitchVOD | undefined;

    // public ?bool is_live = false;
    // public ?bool is_converting = false;
    // public ?TwitchVOD current_vod = null;
    // public ?array current_game = null;
    // public ?int current_duration = null;
    //
    // public ?\DateTime subbed_at = null;
    // public ?\DateTime expires_at = null;
    // public ?\DateTime last_online = null;
    //
    // /** @var TwitchVOD[] */
    // public array vods_list = [];
    //
    // public array vods_raw = [];
    // public int vods_size = 0;
    //
    // public bool deactivated = false;
    //
    // public ?bool api_getSubscriptionStatus = null;

    public deactivated = false;

    applyConfig(channel_config: ChannelConfig) {
        this.quality = channel_config.quality !== undefined ? channel_config.quality : ["best"];
        this.match = channel_config.match !== undefined ? channel_config.match : [];
        this.download_chat = channel_config.download_chat !== undefined ? channel_config.download_chat : false;
        this.no_capture = channel_config.no_capture !== undefined ? channel_config.no_capture : false;
        this.burn_chat = channel_config.burn_chat !== undefined ? channel_config.burn_chat : false;
    }

    /**
     * Folder for the channel that stores VODs and all other data
     * 
     * @returns {string} Folder path
     */
    public getFolder(): string {
        return TwitchHelper.vodFolder(this.login);
    }

    private async parseVODs(api = false) {

        // $this->vods_raw = glob($this->getFolder() . DIRECTORY_SEPARATOR . $this->login . "_*.json");
        this.vods_raw = fs.readdirSync(this.getFolder()).filter(file => file.startsWith(this.login + "_") && file.endsWith(".json"));
        this.vods_list = [];
        this.vods_size = 0;

        for (const vod of this.vods_raw) {

            TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "channel", `Try to parse VOD ${vod}`);

            const vod_full_path = path.join(this.getFolder(), vod);

            const vodclass = await TwitchVOD.load(vod_full_path, api);

            if (!vodclass) {
                continue;
            }


            // if (vodclass.is_capturing) {
            //     $this->is_live = true;
            //     $this->current_vod = $vodclass;
            //     $this->current_game = $vodclass->getCurrentGame();
            //     $this->current_duration = $vodclass->getDurationLive() ?: null;
            // }
            // 
            // if ($vodclass->is_converting) {
            //     $this->is_converting = true;
            // }

            if (vodclass.segments) {
                this.vods_size += vodclass.segments.reduce((acc, seg) => acc + (seg && seg.filesize ? seg.filesize : 0), 0);
            }

            TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "channel", `VOD ${vod} added to ${this.login}`);

            this.vods_list.push(vodclass);
        }
    }

    public getSubscriptionStatus() {
        for (const sub_type of TwitchHelper.CHANNEL_SUB_TYPES) {
            if (KeyValue.get(`${this.userid}.substatus.${sub_type}`) != TwitchHelper.SUBSTATUS.SUBSCRIBED) {
                return false;
            }
        }
        return true;
    }

    public toAPI() {
        return {
            userid: this.userid,
            login: this.login,
            display_name: this.display_name,
            description: this.description,
            profile_image_url: this.profile_image_url,
            is_live: this.is_live,
            is_converting: this.is_converting,
            current_vod: this.current_vod?.toAPI(),
            current_game: this.current_game,
            current_duration: this.current_duration,
            quality: this.quality,
            match: this.match,
            download_chat: this.download_chat,
            no_capture: this.no_capture,
            burn_chat: this.burn_chat,
            // subbed_at: this.subbed_at,
            // expires_at: this.expires_at,
            // last_online: this.last_online,
            vods_list: this.vods_list?.map(vod => vod.toAPI()),
            vods_raw: this.vods_raw,
            vods_size: this.vods_size,
            channel_data: this.channel_data,
            config: this.config,
            deactivated: this.deactivated,
            api_getSubscriptionStatus: this.getSubscriptionStatus(),
        };
    }

    /**
     * Update and save channel config
     * 
     * @param config 
     */
    public update(config: ChannelConfig): boolean {
        const i = TwitchChannel.channels_config.findIndex(ch => ch.login === this.login);
        if (i !== -1) {
            this.config = config;
            this.applyConfig(config);
            TwitchLog.logAdvanced(LOGLEVEL.INFO, "channel", `Replacing channel config for ${this.login}`);
            TwitchChannel.channels_config[i] = config;
            TwitchChannel.saveChannelsConfig();
            return true;
        } else {
            TwitchLog.logAdvanced(LOGLEVEL.ERROR, "channel", `Could not update channel ${this.login}`);
        }
        return false;
    }

    public delete() {
        const login = this.login;
        if (!login) throw new Error("Channel login is not set");
        TwitchLog.logAdvanced(LOGLEVEL.INFO, "channel", `Deleting channel ${login}`);
        const index_config = TwitchChannel.channels_config.findIndex(ch => ch.login === login);
        if (index_config !== -1) {
            TwitchChannel.channels_config.splice(index_config, 1);
        }

        const index_channel = TwitchChannel.channels.findIndex(ch => ch.login === login);
        if (index_channel !== -1) {
            TwitchChannel.channels.splice(index_channel, 1);
        }

        // @todo: unsubscribe

        return TwitchChannel.getChannelByLogin(login) == undefined;
    }

    get current_vod(): TwitchVOD | undefined {
        return this.vods_list?.find(vod => vod.is_capturing);
    }

    get current_game(): TwitchVODChapter | undefined {
        return this.current_vod?.chapters.at(-1);
    }

    get current_duration(): number | undefined {
        return this.current_vod?.duration_seconds;
    }

    // a bit excessive since current_vod is already set with the capturing vod
    get is_live(): boolean {
        return this.current_vod != undefined && this.current_vod.is_capturing;
    }

    get is_converting(): boolean {
        return this.vods_list?.some(vod => vod.is_converting) ?? false;
    }

    /**
     * 
     * STATIC
     * 
     */

    public static async loadAbstract(channel_id: string, api: boolean): Promise<TwitchChannel> {

        TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "channel", `Load channel ${channel_id}`);

        const channel_memory = this.channels.find(channel => channel.userid === channel_id);
        if (channel_memory) {
            TwitchLog.logAdvanced(LOGLEVEL.WARNING, "channel", `Channel ${channel_id} already loaded`);
            return channel_memory;
        }

        const channel = new this();
        channel.userid = channel_id;

        const channel_data = await this.getChannelDataById(channel_id);
        if (!channel_data) throw new Error(`Could not get channel data for channel id: ${channel_id}`);

        const channel_login = channel_data.login;

        const channel_config = TwitchChannel.channels_config.find(c => c.login === channel_login);
        if (!channel_config) throw new Error(`Could not find channel config for channel login: ${channel_login}`);

        channel.channel_data = channel_data;
        channel.config = channel_config;

        channel.login = channel_data.login;
        channel.display_name = channel_data.display_name;
        channel.description = channel_data.description;
        channel.profile_image_url = channel_data.profile_image_url;
        channel.applyConfig(channel_config);

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

        if (TwitchConfig.cfg("channel_folders") && !fs.existsSync(channel.getFolder())) {
            // mkdir(TwitchHelper::vodFolder($streamer['username']));
            fs.mkdirSync(channel.getFolder());
        }

        await channel.parseVODs(api);

        return channel;

    }

    /**
     * Create and insert channel in memory. Subscribe too.
     * 
     * @param config
     * @returns 
     */
    public static async create(config: ChannelConfig): Promise<TwitchChannel> {

        const exists_config = TwitchChannel.channels_config.find(ch => ch.login === config.login);
        if (exists_config) throw new Error(`Channel ${config.login} already exists in config`);

        const exists_channel = TwitchChannel.channels.find(ch => ch.login === config.login);
        if (exists_channel) throw new Error(`Channel ${config.login} already exists in channels`);

        TwitchChannel.channels_config.push(config);
        TwitchChannel.saveChannelsConfig();

        const channel = await TwitchChannel.loadFromLogin(config.login, true);
        if (!channel) throw new Error(`Channel ${config.login} could not be loaded`);

        TwitchChannel.channels.push(channel);

        // @todo: subscribe

        return channel;
    }

    public static loadChannelsConfig() {
        if (!fs.existsSync(BaseConfigPath.channel)) {
            return false;
        }

        const data = fs.readFileSync(BaseConfigPath.channel, "utf8");
        this.channels_config = JSON.parse(data);
    }

    public static saveChannelsConfig() {
        TwitchLog.logAdvanced(LOGLEVEL.INFO, "channel", "Saving channel config");
        fs.writeFileSync(BaseConfigPath.channel, JSON.stringify(this.channels_config));
    }

    public static loadChannelsCache() {
        if (!fs.existsSync(BaseConfigPath.streamerCache)) return false;

        const data = fs.readFileSync(BaseConfigPath.streamerCache, "utf8");
        this.channels_cache = JSON.parse(data);
        TwitchLog.logAdvanced(LOGLEVEL.SUCCESS, "channel", `Loaded ${Object.keys(this.channels_cache).length} channels from cache.`);
    }

    /**
     * Load channels into memory
     * 
     * @returns Amount of loaded channels
     */
    public static async loadChannels(): Promise<number> {
        if (this.channels_config.length > 0) {
            for (const channel of this.channels_config) {

                let ch: TwitchChannel;

                try {
                    ch = await TwitchChannel.loadFromLogin(channel.login, true);
                } catch (th) {
                    TwitchLog.logAdvanced(LOGLEVEL.FATAL, "config", `Channel ${channel.login} could not be loaded: ${th}`);
                    // continue;
                    break;
                }

                if (ch) {
                    this.channels.push(ch);
                    TwitchLog.logAdvanced(LOGLEVEL.SUCCESS, "config", `Loaded channel ${channel.login}`);
                } else {
                    TwitchLog.logAdvanced(LOGLEVEL.FATAL, "config", `Channel ${channel.login} could not be added, please check logs.`);
                    break;
                }
            }
        }
        return this.channels.length;
    }

    public static getChannels(): TwitchChannel[] {
        return this.channels;
    }

    public static getChannelByLogin(login: string): TwitchChannel | undefined {
        return this.channels.find(ch => ch.login === login);
    }

    public static async getStreams(streamer_id: string): Promise<Stream[] | false> {
        let response;

        try {
            response = await TwitchHelper.axios.get(`/helix/streams?user_id=${streamer_id}`);
        } catch (error) {
            TwitchLog.logAdvanced(LOGLEVEL.ERROR, "helper", `Could not get streams for ${streamer_id}: ${error}`);
            return false;
        }

        const json: StreamsResponse = response.data;

        if (!json.data) {
            TwitchLog.logAdvanced(LOGLEVEL.ERROR, "helper", `No streams found for user id ${streamer_id}`);
            return false;
        }

        TwitchLog.logAdvanced(LOGLEVEL.INFO, "helper", `Querying streams for streamer id ${streamer_id}`);

        return json.data ?? false;
    }

    public static async loadFromLogin(login: string, api: boolean): Promise<TwitchChannel> {
        if (!login) throw new Error("Streamer login is empty");
        if (typeof login !== "string") throw new TypeError("Streamer login is not a string");
        TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "channel", `Load from login ${login}`);
        const channel_id = await this.channelIdFromLogin(login);
        if (!channel_id) throw new Error(`Could not get channel id from login: ${login}`);
        return this.loadAbstract(channel_id, api); // $channel;
    }

    public static async channelIdFromLogin(login: string): Promise<string | false> {
        const channelData = await this.getChannelDataByLogin(login, false);
        return channelData ? channelData.id : false;
    }

    public static async channelLoginFromId(channel_id: string): Promise<string | false> {
        const channelData = await this.getChannelDataById(channel_id, false);
        return channelData ? channelData.login : false;
    }

    public static async channelDisplayNameFromId(channel_id: string): Promise<string | false> {
        const channelData = await this.getChannelDataById(channel_id, false);
        return channelData ? channelData.display_name : false;
    }

    public static async getChannelDataById(channel_id: string, force = false): Promise<ChannelData | false> {
        return await this.getChannelDataProxy("id", channel_id, force);
    }

    public static async getChannelDataByLogin(login: string, force = false): Promise<ChannelData | false> {
        return await this.getChannelDataProxy("login", login, force);
    }

    private static async getChannelDataProxy(method: "id" | "login", identifier: string, force: boolean): Promise<ChannelData | false> {

        TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "channel", `Fetching channel data for ${method} ${identifier}, force: ${force}`);

        const channelData = method == "id" ? this.channels_cache[identifier] : Object.values(this.channels_cache).find(channel => channel.login == identifier);
        if (channelData) {
            TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "channel", `Channel data found in memory cache for ${method} ${identifier}`);
            if (Date.now() > channelData._updated + TwitchConfig.streamerCacheTime) {
                TwitchLog.logAdvanced(LOGLEVEL.INFO, "helper", `Memory cache for ${identifier} is outdated, fetching new data`);
            } else {
                TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "channel", `Returning memory cache for ${method} ${identifier}`);
                return channelData;
            }
        } else {
            TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "channel", `Channel data not found in memory cache for ${method} ${identifier}, continue fetching`);
        }

        if (KeyValue.get(`${identifier}.deleted`) == "1" && !force) {
            TwitchLog.logAdvanced(LOGLEVEL.WARNING, "helper", `Channel ${identifier} is deleted, ignore. Delete kv file to force update.`);
            return false;
        }

        const access_token = await TwitchHelper.getAccessToken();

        if (!access_token) {
            TwitchLog.logAdvanced(LOGLEVEL.ERROR, "helper", "Could not get access token, aborting.");
            throw new Error("Could not get access token, aborting.");
        }

        let response;

        try {
            response = await TwitchHelper.axios.get(`/helix/users?${method}=${identifier}`);
        } catch (err) {
            if (axios.isAxiosError(err)) {
                TwitchLog.logAdvanced(LOGLEVEL.ERROR, "helper", `Could not get channel data for ${method} ${identifier}: ${err.message} / ${err.response?.data.message}`);
                return false;
            }

            TwitchLog.logAdvanced(LOGLEVEL.ERROR, "helper", `Channel data request for ${identifier} exceptioned: ${err}`);
            console.log(err);
            return false;
        }

        // TwitchLog.logAdvanced(LOGLEVEL.INFO, "helper", `URL: ${response.request.path} (default ${axios.defaults.baseURL})`);

        if (response.status !== 200) {
            TwitchLog.logAdvanced(LOGLEVEL.ERROR, "helper", `Could not get channel data for ${identifier}, code ${response.status}.`);
            throw new Error(`Could not get channel data for ${identifier}, code ${response.status}.`);
        }

        const json: Users | ErrorResponse = response.data;

        if ("error" in json) {
            TwitchLog.logAdvanced(LOGLEVEL.ERROR, "helper", `Could not get channel data for ${identifier}: ${json.message}`);
            return false;
        }

        if (json.data.length === 0) {
            TwitchLog.logAdvanced(LOGLEVEL.ERROR, "helper", `Could not get channel data for ${identifier}, no data.`);
            throw new Error(`Could not get channel data for ${identifier}, no data.`);
        }

        const data = json.data[0];

        // use as ChannelData
        const userData = data as unknown as ChannelData;

        userData._updated = Date.now();

        // insert into memory and save to file
        TwitchChannel.channels_cache[userData.id] = userData;
        fs.writeFileSync(BaseConfigPath.streamerCache, JSON.stringify(TwitchChannel.channels_cache));

        return userData;

    }

    public static async subscribe(channel_id: string): Promise<boolean> {
        /*
        TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "channel", `Subscribing to channel ${channel_id}`);
        TwitchHelper.axios.post(`/helix/webhooks/hub`, {
            "hub.callback": `${BaseConfigPath.baseURL}/api/twitch/subscribe`,
            "hub.mode": "subscribe",
            "hub.topic": `https://api.twitch.tv/helix/streams?user_id=${channel_id}`,
            "hub.lease_seconds": TwitchConfig.streamerCacheTime / 1000
        });
        */

        if (!TwitchConfig.cfg("app_url")) {
            throw new Error("app_url is not set");
        }

        let hook_callback = TwitchConfig.cfg("app_url") + "/api/v0/hook";

        if (TwitchConfig.cfg("instance_id")) {
            hook_callback += "?instance=" + TwitchConfig.cfg("instance_id");
        }

        const streamer_login = TwitchChannel.channelLoginFromId(channel_id);

        for (const sub_type of TwitchHelper.CHANNEL_SUB_TYPES) {

            if (KeyValue.get(`${channel_id}.sub.${sub_type}`)) {
                TwitchLog.logAdvanced(LOGLEVEL.INFO, "helper", `Skip subscription to ${channel_id}:${sub_type} (${streamer_login}), in cache.`);
                continue; // todo: alert
            }

            TwitchLog.logAdvanced(LOGLEVEL.INFO, "helper", `Subscribe to ${channel_id}:${sub_type} (${streamer_login})`);

            const payload: SubscriptionRequest = {
                type: sub_type,
                version: "1",
                condition: {
                    broadcaster_user_id: channel_id,
                },
                transport: {
                    method: "webhook",
                    callback: hook_callback,
                    secret: TwitchConfig.cfg("eventsub_secret"),
                },
            };

            let response;

            try {
                response = await TwitchHelper.axios.post("/helix/eventsub/subscriptions", payload);
            } catch (err) {
                if (axios.isAxiosError(err)) {
                    TwitchLog.logAdvanced(LOGLEVEL.ERROR, "helper", `Could not subscribe to ${channel_id}:${sub_type}: ${err.message} / ${err.response?.data.message}`);
                    
                    if (err.response?.data.status == 409) { // duplicate
                        const sub_id = await TwitchChannel.getSubscriptionId(channel_id, sub_type);
                        if (sub_id) KeyValue.set(`${channel_id}.sub.${sub_type}`, sub_id);
                        continue;
                    }
                    
                    continue;
                }

                TwitchLog.logAdvanced(LOGLEVEL.ERROR, "helper", `Subscription request for ${channel_id} exceptioned: ${err}`);
                console.log(err);
                continue;
            }

            const json: SubscriptionResponse = response.data;
            const http_code = response.status;

            if (http_code == 202) {

                if (json.data[0].status !== "webhook_callback_verification_pending") {
                    TwitchLog.logAdvanced(LOGLEVEL.ERROR, "helper", `Got 202 return for subscription request for ${channel_id}:${sub_type} but did not get callback verification.`);
                    return false;
                    // continue;
                }

                KeyValue.set(`${channel_id}.sub.${sub_type}`, json.data[0].id);
                KeyValue.set(`${channel_id}.substatus.${sub_type}`, TwitchHelper.SUBSTATUS.WAITING);

                TwitchLog.logAdvanced(LOGLEVEL.SUCCESS, "helper", `Subscribe for ${channel_id}:${sub_type} (${streamer_login}) sent. Check logs for a 'subscription active' message.`);
            } else if (http_code == 409) {
                TwitchLog.logAdvanced(LOGLEVEL.ERROR, "helper", `Duplicate sub for ${channel_id}:${sub_type} detected.`);
            } else {
                TwitchLog.logAdvanced(LOGLEVEL.ERROR, "helper", `Failed to send subscription request for ${channel_id}:${sub_type}: ${json}, HTTP ${http_code})`);
                return false;
                // continue;
            }

        }

        return true;

    }

    public static async getSubscriptionId(channel_id: string, sub_type: EventSubTypes): Promise<string | false> {
        const all_subs = await TwitchHelper.getSubs();
        if (all_subs) {
            const sub_id = all_subs.data.find(sub => sub.condition.broadcaster_user_id == channel_id && sub.type == sub_type);
            return sub_id ? sub_id.id : false;
        } else {
            return false;
        }
    }
}