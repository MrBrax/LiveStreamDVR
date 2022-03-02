import axios from "axios";
import fs from "fs";
import { ChannelConfig, TwitchConfig, VideoQuality } from "./TwitchConfig";
import { LOGLEVEL, TwitchHelper } from "./TwitchHelper";
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
 
    // /**
    //  * Display name, used in texts
    //  */
    // public ?string display_name = null;
 //
    // public ?string description = null;
    // public ?string profile_image_url = null;
    // public ?bool is_live = false;
    // public ?bool is_converting = false;
    // public ?TwitchVOD current_vod = null;
    // public ?array current_game = null;
    // public ?int current_duration = null;
 //
    // /**
    //  * Quality selected from download.
    //  * audio_only, 160p (worst), 360p, 480p, 720p, 720p60, 1080p60 (best)
    //  */
    // public ?array quality = [];
 //
    // public ?array match = [];
    // public ?bool download_chat = null;
    // public ?bool no_capture = null;
    // public ?bool burn_chat = null;
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
    // public array channel_data = [];
    // public array config = [];
 //
    // public bool deactivated = false;
 //
    // public ?bool api_getSubscriptionStatus = null;

    static async loadAbstract(channel_id: string, api: boolean): Promise<TwitchChannel> {
        const channel = new this();
        channel.userid = channel_id;
        
        const channel_data = await this.getChannelDataById(channel_id, api);
        if (!channel_data) throw new Error(`Could not get channel data for channel id: ${channel_id}`);

        const channel_login = channel_data.login;

        const channel_config = TwitchConfig.channels_config.find(c => c.login === channel_login);
        if (!channel_config) throw new Error(`Could not find channel config for channel login: ${channel_login}`);

        channel.channel_data = channel_data;
        channel.config = channel_config;


        channel.login                  = channel_data.login;
        channel.display_name           = channel_data.display_name;
        channel.description            = channel_data.description;
        channel.profile_image_url      = channel_data.profile_image_url;
        channel.quality                = channel_config.quality !== undefined ? channel_config.quality : ["best"];
        channel.match                  = channel_config.match !== undefined ? channel_config.match : [];
        channel.download_chat          = channel_config.download_chat !== undefined ? channel_config.download_chat : false;
        channel.no_capture             = channel_config.no_capture !== undefined ? channel_config.no_capture : false;
        channel.burn_chat              = channel_config.burn_chat !== undefined ? channel_config.burn_chat : false;


        return channel;

    }

    static async loadFromLogin(login: string, api: boolean): Promise<TwitchChannel> {
        if (!login) throw new Error("Streamer login is empty");
        if (typeof login !== 'string') throw new TypeError("Streamer login is not a string");
        const channel_id = await this.channelIdFromLogin(login);
        if (!channel_id) throw new Error(`Could not get channel id from login: ${login}`);
        return this.loadAbstract(channel_id, api); // $channel;
	}

    static async channelIdFromLogin(login: string): Promise<string | false>
    {
        const channelData = await this.getChannelDataByLogin(login, false);
        return channelData ? channelData.id : false;
    }

    static async getChannelDataById(channel_id: string, force: boolean): Promise<ChannelData | false>
    {
        return this.getChannelDataProxy("channel_id", channel_id, force);
    }

    static async getChannelDataByLogin(login: string, force: boolean): Promise<ChannelData | false>
    {
        return this.getChannelDataProxy("login", login, force);
    }

    private static async getChannelDataProxy(method: string, identifier: string, force: boolean): Promise<ChannelData | false>
    {
        if (fs.existsSync(TwitchConfig.streamerCachePath) && !force) {
            const data: Record<string, ChannelData> = JSON.parse(fs.readFileSync(TwitchConfig.streamerCachePath, 'utf8'));
            const channelData = method == "channel_id" ? data[identifier] : Object.values(data).find(channel => channel.login == identifier);
            if (channelData) {
                if (Date.now() > channelData._updated + TwitchConfig.streamerCacheTime) {
                    // continue, cache too old
                } else {
                    return channelData;
                }
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

        const response = await axios.get(`/helix/users?${method}=${identifier}`);

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
            fs.writeFileSync(TwitchConfig.streamerCachePath, JSON.stringify(data_old));
        } else {
            fs.writeFileSync(TwitchConfig.streamerCachePath, JSON.stringify({[data.id]: data}));
        }

        return data;

    }
        

}