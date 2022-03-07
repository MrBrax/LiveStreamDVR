import { ErrorResponse } from "@/TwitchAPI/Shared";
import { Stream, StreamsResponse } from "@/TwitchAPI/Streams";
import { Users } from "@/TwitchAPI/Users";
import axios from "axios";
import fs from "fs";
import path from "path";
import { BaseConfigPath } from "./BaseConfig";
import { TwitchConfig, VideoQuality } from "./TwitchConfig";
import { TwitchHelper } from "./TwitchHelper";
import { LOGLEVEL, TwitchLog } from "./TwitchLog";
import { TwitchVOD } from "./TwitchVOD";
interface ChannelData {
    id: string;
    login: string;
    display_name: string;
    type: string;
    broadcaster_type: string;
    description: string;
    profile_image_url: string;
    offline_image_url: string;
    view_count: number;
    created_at: string; // Date
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

    static async loadAbstract(channel_id: string, api: boolean): Promise<TwitchChannel> {

        TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "channel", `Load channel ${channel_id}`);

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
        channel.quality = channel_config.quality !== undefined ? channel_config.quality : ["best"];
        channel.match = channel_config.match !== undefined ? channel_config.match : [];
        channel.download_chat = channel_config.download_chat !== undefined ? channel_config.download_chat : false;
        channel.no_capture = channel_config.no_capture !== undefined ? channel_config.no_capture : false;
        channel.burn_chat = channel_config.burn_chat !== undefined ? channel_config.burn_chat : false;

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

    static async loadFromLogin(login: string, api: boolean): Promise<TwitchChannel> {
        if (!login) throw new Error("Streamer login is empty");
        if (typeof login !== "string") throw new TypeError("Streamer login is not a string");
        TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "channel", `Load from login ${login}`);
        const channel_id = await this.channelIdFromLogin(login);
        if (!channel_id) throw new Error(`Could not get channel id from login: ${login}`);
        return this.loadAbstract(channel_id, api); // $channel;
    }

    static async channelIdFromLogin(login: string): Promise<string | false> {
        // TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "channel", `Convert login to channel id for ${login}`);
        const channelData = await this.getChannelDataByLogin(login, false);
        return channelData ? channelData.id : false;
    }

    static async channelLoginFromId(channel_id: string): Promise<string | false> {
        // TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "channel", `Convert channel id to login for ${channel_id}`);
        const channelData = await this.getChannelDataById(channel_id, false);
        return channelData ? channelData.login : false;
    }

    static async channelDisplayNameFromId(channel_id: string): Promise<string | false> {
        // TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "channel", `Convert channel id to display name for ${channel_id}`);
        const channelData = await this.getChannelDataById(channel_id, false);
        return channelData ? channelData.display_name : false;
    }

    static async getChannelDataById(channel_id: string, force = false): Promise<ChannelData | false> {
        // TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "channel", `Fetching channel data for ID ${channel_id}`);
        return await this.getChannelDataProxy("id", channel_id, force);
    }

    static async getChannelDataByLogin(login: string, force = false): Promise<ChannelData | false> {
        // TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "channel", `Fetching channel data for LOGIN ${login}`);
        return await this.getChannelDataProxy("login", login, force);
    }

    private static async getChannelDataProxy(method: "id" | "login", identifier: string, force: boolean): Promise<ChannelData | false> {

        TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "channel", `Fetching channel data for ${method} ${identifier}, force: ${force}`);

        /*
        if (fs.existsSync(BaseConfigPath.streamerCache) && !force) {
            const data: Record<string, ChannelData> = JSON.parse(fs.readFileSync(BaseConfigPath.streamerCache, 'utf8'));
            const channelData = method == "id" ? data[identifier] : Object.values(data).find(channel => channel.login == identifier);
            if (channelData) {
                TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "channel", `Channel data found in cache for ${method} ${identifier}`);
                if (Date.now() > channelData._updated + TwitchConfig.streamerCacheTime) {
                    TwitchLog.logAdvanced(LOGLEVEL.INFO, "helper", `Cache for ${identifier} is outdated, fetching new data`);
                } else {
                    TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "channel", `Returning cache for ${method} ${identifier}`);
                    return channelData;
                }
            } else {
                TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "channel", `Channel data not found in cache for ${method} ${identifier}, continue fetching`);
            }
        }
        */

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

        if (TwitchConfig.getCache(`${identifier}.deleted`) == "1" && !force) {
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

        /*
        if (fs.existsSync(BaseConfigPath.streamerCache)) {
            const data_old: Record<string, ChannelData> = JSON.parse(fs.readFileSync(BaseConfigPath.streamerCache, 'utf8'));
            data_old[data.id] = data;
            TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "CHANNEL", `Saving channel cache file.`);
            fs.writeFileSync(BaseConfigPath.streamerCache, JSON.stringify(data_old));
        } else {
            TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "CHANNEL", `Saving new channel cache file.`);
            fs.writeFileSync(BaseConfigPath.streamerCache, JSON.stringify({ [data.id]: data }));
        }
        */

        // insert into memory and save to file
        TwitchChannel.channels_cache[userData.id] = userData;
        fs.writeFileSync(BaseConfigPath.streamerCache, JSON.stringify(TwitchChannel.channels_cache));

        return userData;

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

    static loadChannelsConfig() {
        if (!fs.existsSync(BaseConfigPath.channel)) {
            return false;
        }

        const data = fs.readFileSync(BaseConfigPath.channel, "utf8");
        this.channels_config = JSON.parse(data);
    }

    static loadChannelsCache() {
        if (!fs.existsSync(BaseConfigPath.streamerCache))  return false;

        const data = fs.readFileSync(BaseConfigPath.streamerCache, "utf8");
        this.channels_cache = JSON.parse(data);
        TwitchLog.logAdvanced(LOGLEVEL.SUCCESS, "channel", `Loaded ${Object.keys(this.channels_cache).length} channels from cache.`);
    }

    /**
     * Load channels into memory
     * 
     * @returns Amount of loaded channels
     */
    static async loadChannels(): Promise<number> {
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
                } else {
                    TwitchLog.logAdvanced(LOGLEVEL.FATAL, "config", `Channel ${channel.login} could not be added, please check logs.`);
                    break;
                }
            }
        }
        return this.channels.length;
    }

    static getChannels(): TwitchChannel[] {
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

    get current_vod(): TwitchVOD | undefined {
        return this.vods_list?.find(vod => vod.is_capturing);
    }

    // a bit excessive since current_vod is already set with the capturing vod
    get is_live(): boolean {
        return this.current_vod != undefined && this.current_vod.is_capturing;
    }

}