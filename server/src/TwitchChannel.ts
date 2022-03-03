import axios, { AxiosError } from "axios";
import fs from "fs";
import path from "path";
import { ChannelConfig, TwitchConfig, VideoQuality } from "./Core/TwitchConfig";
import { LOGLEVEL, TwitchHelper } from "./Core/TwitchHelper";
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

export class TwitchChannel {

    /**
     * User ID
     */
    public userid: string | undefined;

    /**
     * Login name, used in URLs
     */
    public login: string | undefined;

    public channel_data: ChannelData | undefined;
    public config: ChannelConfig | undefined;
    public display_name: string | undefined;
    public description: string | undefined;
    public profile_image_url: string | undefined;
    public quality: VideoQuality[] | undefined;
    public match: string[] | undefined;
    public download_chat: boolean | undefined;
    public no_capture: boolean | undefined;
    public burn_chat: boolean | undefined;

    public vods_raw: string[] | undefined;
    public vods_list: TwitchVOD[] | undefined;
    public vods_size: number | undefined;

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

        TwitchHelper.logAdvanced(LOGLEVEL.DEBUG, "channel", `Load channel ${channel_id}`);

        const channel = new this();
        channel.userid = channel_id;

        const channel_data = await this.getChannelDataById(channel_id);
        if (!channel_data) throw new Error(`Could not get channel data for channel id: ${channel_id}`);

        const channel_login = channel_data.login;

        const channel_config = TwitchConfig.channels_config.find(c => c.login === channel_login);
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

        if (TwitchConfig.cfg('channel_folders') && !fs.existsSync(channel.getFolder())) {
            // mkdir(TwitchHelper::vodFolder($streamer['username']));
            fs.mkdirSync(channel.getFolder());
        }

        await channel.parseVODs(api);

        return channel;

    }

    static async loadFromLogin(login: string, api: boolean): Promise<TwitchChannel> {
        if (!login) throw new Error("Streamer login is empty");
        if (typeof login !== 'string') throw new TypeError("Streamer login is not a string");
        TwitchHelper.logAdvanced(LOGLEVEL.DEBUG, "channel", `Load from login ${login}`);
        const channel_id = await this.channelIdFromLogin(login);
        if (!channel_id) throw new Error(`Could not get channel id from login: ${login}`);
        return this.loadAbstract(channel_id, api); // $channel;
    }

    static async channelIdFromLogin(login: string): Promise<string | false> {
        TwitchHelper.logAdvanced(LOGLEVEL.DEBUG, "channel", `Convert login to channel id for ${login}`);
        const channelData = await this.getChannelDataByLogin(login, false);
        return channelData ? channelData.id : false;
    }

    static async channelLoginFromId(channel_id: string): Promise<string | false> {
        TwitchHelper.logAdvanced(LOGLEVEL.DEBUG, "channel", `Convert channel id to login for ${channel_id}`);
        const channelData = await this.getChannelDataById(channel_id, false);
        return channelData ? channelData.login : false;
    }

    static async channelDisplayNameFromId(channel_id: string): Promise<string | false> {
        TwitchHelper.logAdvanced(LOGLEVEL.DEBUG, "channel", `Convert channel id to display name for ${channel_id}`);
        const channelData = await this.getChannelDataById(channel_id, false);
        return channelData ? channelData.display_name : false;
    }

    static async getChannelDataById(channel_id: string, force = false): Promise<ChannelData | false> {
        TwitchHelper.logAdvanced(LOGLEVEL.DEBUG, "channel", `Fetching channel data for ID ${channel_id}`);
        return this.getChannelDataProxy("id", channel_id, force);
    }

    static async getChannelDataByLogin(login: string, force = false): Promise<ChannelData | false> {
        TwitchHelper.logAdvanced(LOGLEVEL.DEBUG, "channel", `Fetching channel data for LOGIN ${login}`);
        return this.getChannelDataProxy("login", login, force);
    }

    private static async getChannelDataProxy(method: "id" | "login", identifier: string, force: boolean): Promise<ChannelData | false> {

        TwitchHelper.logAdvanced(LOGLEVEL.DEBUG, "channel", `Fetching channel data for ${method} ${identifier}, force: ${force}`);

        if (fs.existsSync(TwitchConfig.streamerCachePath) && !force) {
            const data: Record<string, ChannelData> = JSON.parse(fs.readFileSync(TwitchConfig.streamerCachePath, 'utf8'));
            const channelData = method == "id" ? data[identifier] : Object.values(data).find(channel => channel.login == identifier);
            if (channelData) {
                TwitchHelper.logAdvanced(LOGLEVEL.DEBUG, "channel", `Channel data found in cache for ${method} ${identifier}`);
                if (Date.now() > channelData._updated + TwitchConfig.streamerCacheTime) {
                    TwitchHelper.logAdvanced(LOGLEVEL.INFO, "helper", `Cache for ${identifier} is outdated, fetching new data`);
                } else {
                    TwitchHelper.logAdvanced(LOGLEVEL.DEBUG, "channel", `Returning cache for ${method} ${identifier}`);
                    return channelData;
                }
            } else {
                TwitchHelper.logAdvanced(LOGLEVEL.DEBUG, "channel", `Channel data not found in cache for ${method} ${identifier}, continue fetching`);
            }
        }

        if (TwitchConfig.getCache(`${identifier}.deleted`) == "1" && !force) {
            TwitchHelper.logAdvanced(LOGLEVEL.WARNING, "helper", `Channel ${identifier} is deleted, ignore. Delete kv file to force update.`);
            return false;
        }

        const access_token = await TwitchHelper.getAccessToken();

        if (!access_token) {
            TwitchHelper.logAdvanced(LOGLEVEL.ERROR, "helper", "Could not get access token, aborting.");
            throw new Error("Could not get access token, aborting.");
        }

        let response;

        try {
            response = await TwitchHelper.axios.get(`/helix/users?${method}=${identifier}`);
        } catch (err) {
            if (axios.isAxiosError(err)){
                TwitchHelper.logAdvanced(LOGLEVEL.ERROR, "helper", `Could not get channel data for ${method} ${identifier}: ${err.message} / ${err.response?.data.message}`);
                return false;
            }

            TwitchHelper.logAdvanced(LOGLEVEL.ERROR, "helper", `Channel data request for ${identifier} exceptioned: ${err}`);
            console.log(err);
            return false;
        }

        // TwitchHelper.logAdvanced(LOGLEVEL.INFO, "helper", `URL: ${response.request.path} (default ${axios.defaults.baseURL})`);

        if (response.status !== 200) {
            TwitchHelper.logAdvanced(LOGLEVEL.ERROR, "helper", `Could not get channel data for ${identifier}, code ${response.status}.`);
            throw new Error(`Could not get channel data for ${identifier}, code ${response.status}.`);
        }

        const json = response.data;

        if (json.data.length === 0) {
            TwitchHelper.logAdvanced(LOGLEVEL.ERROR, "helper", `Could not get channel data for ${identifier}, no data.`);
            throw new Error(`Could not get channel data for ${identifier}, no data.`);
        }

        let data: ChannelData = json.data[0];

        data._updated = Date.now();

        if (fs.existsSync(TwitchConfig.streamerCachePath)) {
            const data_old: Record<string, ChannelData> = JSON.parse(fs.readFileSync(TwitchConfig.streamerCachePath, 'utf8'));
            data_old[data.id] = data;
            TwitchHelper.logAdvanced(LOGLEVEL.DEBUG, "CHANNEL", `Saving channel cache file.`);
            fs.writeFileSync(TwitchConfig.streamerCachePath, JSON.stringify(data_old));
        } else {
            TwitchHelper.logAdvanced(LOGLEVEL.DEBUG, "CHANNEL", `Saving new channel cache file.`);
            fs.writeFileSync(TwitchConfig.streamerCachePath, JSON.stringify({ [data.id]: data }));
        }

        return data;

    }

    /**
     * Folder for the channel that stores VODs and all other data
     * 
     * @returns {string} Folder path
     */
    public getFolder() {
        return TwitchHelper.vodFolder(this.login);
    }

    private async parseVODs(api = false) {

        // $this->vods_raw = glob($this->getFolder() . DIRECTORY_SEPARATOR . $this->login . "_*.json");
        this.vods_raw = fs.readdirSync(this.getFolder()).filter(file => file.startsWith(this.login + "_") && file.endsWith(".json"));
        this.vods_list = [];
        this.vods_size = 0;

        for (let vod of this.vods_raw) {

            TwitchHelper.logAdvanced(LOGLEVEL.DEBUG, "CHANNEL", `Try to parse VOD ${vod}`);

            const vod_full_path = path.join(this.getFolder(), vod);
            
            let vodclass = await TwitchVOD.load(vod_full_path, api);

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

            TwitchHelper.logAdvanced(LOGLEVEL.DEBUG, "CHANNEL", `VOD ${vod} added to ${this.login}`);

            this.vods_list.push(vodclass);
        }
    }


}