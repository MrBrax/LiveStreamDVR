import { YouTubeChannelConfig } from "../../../common/Config";
import { Providers } from "../../../common/Defs";
import { LiveStreamDVR } from "./LiveStreamDVR";
import { VChannel } from "./VChannel";
import { youtube_v3 } from "@googleapis/youtube";
import { YouTubeHelper } from "../Providers/YouTube";
import { Config } from "./Config";
import { KeyValue } from "./KeyValue";
import { Log, LOGLEVEL } from "./Log";
import fs from "fs";
import { BaseConfigPath } from "./BaseConfig";
import { Helper } from "./Helper";
import { YouTubeVOD } from "./YouTubeVOD";
import { ApiChannel } from "../../../common/Api/Client";
import { VODChapterJSON } from "Storage/JSON";

interface YouTubeChannelData extends youtube_v3.Schema$ChannelSnippet {
    _updated: number;
    id: string;
}

export class YouTubeChannel extends VChannel {

    static channels_cache: Record<string, YouTubeChannelData> = {};

    public channel_data?: YouTubeChannelData;

    public provider: Providers = "youtube";

    public channel_id = "";

    public vods_list: YouTubeVOD[] = [];

    public subbed_at: Date | undefined;
    public expires_at: Date | undefined;


    public static getChannels(): YouTubeChannel[] {
        return LiveStreamDVR.getInstance().channels.filter<YouTubeChannel>((channel): channel is YouTubeChannel => channel instanceof YouTubeChannel) || [];
    }

    static async create(config: YouTubeChannelConfig): Promise<YouTubeChannel> {
        const exists_config = LiveStreamDVR.getInstance().channels_config.find(ch => ch.provider == "youtube" && ch.channel_id === config.channel_id);
        if (exists_config) throw new Error(`Channel ${config.channel_id} already exists in config`);

        // const exists_channel = TwitchChannel.channels.find(ch => ch.login === config.login);
        const exists_channel = LiveStreamDVR.getInstance().channels.find<YouTubeChannel>((channel): channel is YouTubeChannel => channel instanceof YouTubeChannel && channel.channel_id === config.channel_id);
        if (exists_channel) throw new Error(`Channel ${config.channel_id} already exists in channels`);

        const data = await YouTubeChannel.getUserDataById(config.channel_id);
        if (!data) throw new Error(`Could not get channel data for channel login: ${config.channel_id}`);

        LiveStreamDVR.getInstance().channels_config.push(config);
        LiveStreamDVR.getInstance().saveChannelsConfig();

        const channel = await YouTubeChannel.loadFromId(config.channel_id);
        if (!channel || !channel.channel_id) throw new Error(`Channel ${config.channel_id} could not be loaded`);

        if (
            Config.getInstance().cfg<string>("app_url", "") !== "" &&
            Config.getInstance().cfg<string>("app_url", "") !== "debug" &&
            !Config.getInstance().cfg<boolean>("isolated_mode")
        ) {
            try {
                await YouTubeChannel.subscribe(channel.channel_id);
            } catch (error) {
                Log.logAdvanced(LOGLEVEL.ERROR, "yt.channel", `Failed to subscribe to channel ${channel.channel_id}: ${(error as Error).message}`);
                LiveStreamDVR.getInstance().channels_config = LiveStreamDVR.getInstance().channels_config.filter(ch => ch.provider == "youtube" && ch.channel_id !== config.channel_id); // remove channel from config
                LiveStreamDVR.getInstance().saveChannelsConfig();
                // throw new Error(`Failed to subscribe to channel ${channel.login}: ${(error as Error).message}`, { cause: error });
                throw error; // rethrow error
            }
        } else if (Config.getInstance().cfg("app_url") == "debug") {
            Log.logAdvanced(LOGLEVEL.WARNING, "yt.channel", `Not subscribing to ${channel.channel_id} due to debug app_url.`);
        } else if (Config.getInstance().cfg("isolated_mode")) {
            Log.logAdvanced(LOGLEVEL.WARNING, "yt.channel", `Not subscribing to ${channel.channel_id} due to isolated mode.`);
        } else {
            Log.logAdvanced(LOGLEVEL.ERROR, "yt.channel", `Can't subscribe to ${channel.channel_id} due to either no app_url or isolated mode disabled.`);
            LiveStreamDVR.getInstance().channels_config = LiveStreamDVR.getInstance().channels_config.filter(ch => ch.provider == "youtube" && ch.channel_id !== config.channel_id); // remove channel from config
            LiveStreamDVR.getInstance().saveChannelsConfig();
            throw new Error("Can't subscribe due to either no app_url or isolated mode disabled.");
        }

        LiveStreamDVR.getInstance().channels.push(channel);

        /*
        if (Helper.axios) { // bad hack?
            const streams = await TwitchChannel.getStreams(channel.userid);
            if (streams && streams.length > 0) {
                KeyValue.getInstance().setBool(`${channel.login}.online`, true);
            }
        }
        */

        return channel;

    }

    public static async loadFromId(channel_id: string): Promise<YouTubeChannel> {
        if (!channel_id) throw new Error("Streamer login is empty");
        if (typeof channel_id !== "string") throw new TypeError("Streamer id is not a string");
        Log.logAdvanced(LOGLEVEL.DEBUG, "yt.channel", `Load from login ${channel_id}`);
        // const channel_id = await this.channelIdFromLogin(channel_id);
        // if (!channel_id) throw new Error(`Could not get channel id from login: ${channel_id}`);
        return this.loadAbstract(channel_id); // $channel;
    }

    public static async loadAbstract(channel_id: string): Promise<YouTubeChannel> {

        Log.logAdvanced(LOGLEVEL.DEBUG, "yt.channel", `Load channel ${channel_id}`);

        const channel_memory = LiveStreamDVR.getInstance().channels.find<YouTubeChannel>((channel): channel is YouTubeChannel => channel instanceof YouTubeChannel && channel.channel_id === channel_id);
        if (channel_memory) {
            Log.logAdvanced(LOGLEVEL.WARNING, "yt.channel", `Channel ${channel_id} already loaded`);
            return channel_memory;
        }

        const channel = new this();
        channel.channel_id = channel_id;

        const channel_data = await this.getUserDataById(channel_id);
        if (!channel_data) throw new Error(`Could not get channel data for channel id: ${channel_id}`);

        // const channel_login = channel_data.login;

        const channel_config = LiveStreamDVR.getInstance().channels_config.find(c => c.provider == "youtube" && c.channel_id === channel_id);
        if (!channel_config) throw new Error(`Could not find channel config in memory for channel id: ${channel_id}`);

        channel.channel_data = channel_data;
        channel.config = channel_config;

        // channel.login = channel_data.login;
        channel.display_name = channel_data.title || "";
        channel.description = channel_data.description || "";
        // channel.profile_image_url = channel_data.profile_image_url;
        // channel.broadcaster_type = channel_data.broadcaster_type;
        channel.applyConfig(channel_config);

        if (KeyValue.getInstance().getBool(`yt.${channel.channel_id}.online`)) {
            Log.logAdvanced(LOGLEVEL.WARNING, "yt.channel", `Channel ${channel.channel_id} is online, stale?`);
        }

        if (KeyValue.getInstance().get(`yt.${channel.channel_id}.channeldata`)) {
            Log.logAdvanced(LOGLEVEL.WARNING, "yt.channel", `Channel ${channel.channel_id} has stale chapter data.`);
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

        if (Config.getInstance().cfg("channel_folders") && !fs.existsSync(channel.getFolder())) {
            fs.mkdirSync(channel.getFolder());
        }

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
            Log.logAdvanced(LOGLEVEL.ERROR, "yt.channel", `Failed to update chapter data for channel ${channel.login}: ${(error as Error).message}`);
        }
        */

        return channel;

    }

    public static async getUserDataById(channel_id: string, force = false): Promise<YouTubeChannelData | false> {
        return await this.getUserDataProxy("id", channel_id, force);
    }

    public static async getUserDataByUsername(username: string, force = false): Promise<YouTubeChannelData | false> {
        return await this.getUserDataProxy("username", username, force);
    }

    static async getUserDataProxy(method: "id" | "username", identifier: string, force = false): Promise<false | YouTubeChannelData> {

        if (!identifier) {
            throw new Error("No identifier supplied");
        }

        Log.logAdvanced(LOGLEVEL.DEBUG, "yt.channel", `Fetching user data for ${method} ${identifier}, force: ${force}`);

        // check cache first
        if (!force) {
            const channelData = method == "id" ? this.channels_cache[identifier] : Object.values(this.channels_cache).find(channel => channel.customUrl == identifier);
            if (channelData) {
                Log.logAdvanced(LOGLEVEL.DEBUG, "yt.channel", `User data found in memory cache for ${method} ${identifier}`);
                if (Date.now() > channelData._updated + Config.streamerCacheTime) {
                    Log.logAdvanced(LOGLEVEL.INFO, "helper", `Memory cache for ${identifier} is outdated, fetching new data`);
                } else {
                    Log.logAdvanced(LOGLEVEL.DEBUG, "yt.channel", `Returning memory cache for ${method} ${identifier}`);
                    return channelData;
                }
            } else {
                Log.logAdvanced(LOGLEVEL.DEBUG, "yt.channel", `User data not found in memory cache for ${method} ${identifier}, continue fetching`);
            }

            if (KeyValue.getInstance().get(`${identifier}.deleted`)) {
                Log.logAdvanced(LOGLEVEL.WARNING, "helper", `Channel ${identifier} is deleted, ignore. Delete kv file to force update.`);
                return false;
            }
        }

        const service = new youtube_v3.Youtube({ auth: YouTubeHelper.oAuth2Client });

        let res;

        if (method == "id") {
            try {
                res = await service.channels.list({
                    id: [identifier],
                    part: ["snippet"],
                });
            } catch (error) {
                Log.logAdvanced(LOGLEVEL.WARNING, "helper", `Channel data for ${identifier} error: ${(error as Error).message}`);
                return false;
            }
        } else {
            try {
                res = await service.channels.list({
                    forUsername: identifier,
                    part: ["snippet"],
                });
            } catch (error) {
                Log.logAdvanced(LOGLEVEL.WARNING, "helper", `Channel data for ${identifier} error: ${(error as Error).message}`);
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
        console.debug(`Inserting user data for ${method} ${identifier} into cache and file`);
        YouTubeChannel.channels_cache[userData.id] = userData;
        fs.writeFileSync(BaseConfigPath.streamerYouTubeCache, JSON.stringify(YouTubeChannel.channels_cache));

        return userData;

    }

    static getChannelById(channel_id: string): YouTubeChannel | undefined {
        return LiveStreamDVR.getInstance().channels.find<YouTubeChannel>((ch): ch is YouTubeChannel => ch instanceof YouTubeChannel && ch.channel_id === channel_id);
    }

    public static loadChannelsCache(): boolean {
        if (!fs.existsSync(BaseConfigPath.streamerYouTubeCache)) return false;

        const data = fs.readFileSync(BaseConfigPath.streamerYouTubeCache, "utf8");
        this.channels_cache = JSON.parse(data);
        Log.logAdvanced(LOGLEVEL.SUCCESS, "yt.channel", `Loaded ${Object.keys(this.channels_cache).length} YouTube channels from cache.`);
        return true;
    }

    static async subscribe(channel_id: string) {
        return true;
    }

    public getFolder(): string {
        return Helper.vodFolder(this.display_name);
    }

    public postLoad(): void {
        // this.setupStreamNumber();
        // if (!KeyValue.getInstance().has(`${this.login}.saves_vods`)) {
        //     this.checkIfChannelSavesVods();
        // }
        // this.addAllLocalVideos();
        this.startWatching();
    }

    public async toAPI(): Promise<ApiChannel> {

        // if (!this.userid || !this.login || !this.display_name)
        //     console.error(chalk.red(`Channel ${this.login} is missing userid, login or display_name`));

        const vods_list = await Promise.all(this.vods_list?.map(async (vod) => await vod.toAPI()));

        return {
            userid: this.channel_id || "",
            login: "",
            display_name: this.display_name || "",
            description: this.description || "",
            profile_image_url: this.channel_data?.thumbnails?.default?.url || "",
            offline_image_url: "",
            banner_image_url: "",
            broadcaster_type: "",
            is_live: this.is_live,
            is_capturing: this.is_capturing,
            is_converting: this.is_converting,
            current_vod: await this.current_vod?.toAPI(),
            current_game: undefined,
            current_chapter: this.current_chapter?.toAPI(),
            // current_duration: this.current_duration,
            quality: this.quality,
            match: this.match,
            download_chat: this.download_chat,
            no_capture: this.no_capture,
            burn_chat: this.burn_chat,
            live_chat: this.live_chat,
            no_cleanup: this.no_cleanup,
            max_storage: this.max_storage,
            max_vods: this.max_vods,
            download_vod_at_end: this.download_vod_at_end,
            download_vod_at_end_quality: this.download_vod_at_end_quality,
            // subbed_at: this.subbed_at,
            // expires_at: this.expires_at,
            // last_online: this.last_online,
            vods_list: vods_list || [],
            vods_raw: this.vods_raw,
            vods_size: this.vods_size || 0,
            // channel_data: this.channel_data,
            channel_data: undefined,
            // config: this.config,
            // deactivated: this.deactivated,
            // api_getSubscriptionStatus: this.getSubscriptionStatus(),
            api_getSubscriptionStatus: false,

            subbed_at: this.subbed_at ? this.subbed_at.toISOString() : undefined,
            expires_at: this.expires_at ? this.expires_at.toISOString() : undefined,
            last_online: this.last_online ? this.last_online.toISOString() : undefined,
            clips_list: this.clips_list,
            video_list: this.video_list,

            current_stream_number: this.current_stream_number,
            current_season: this.current_season,

            chapter_data: this.getChapterData(),

            saves_vods: this.saves_vods,
        };
    }

    get saves_vods(): boolean {
        return KeyValue.getInstance().getBool(`yt.${this.channel_id}.saves_vods`);
    }

    public getChapterData(): VODChapterJSON | undefined {
        const cd = KeyValue.getInstance().get(`yt.${this.channel_id}.chapterdata`);
        return cd ? JSON.parse(cd) as VODChapterJSON : undefined;
    }

    public async startWatching(): Promise<void> {
        return;
    }

}