import axios, { Axios } from "axios";
import chalk from "chalk";
import { YouTubeChannelData } from "../../../common/Channel";
import { ChannelConfigs } from "../../../common/Config";
import { ChannelProvider } from "../../../common/Defs";
import { Channel } from "./Channel";
import { Config } from "./Config";
import { KeyValue } from "./KeyValue";
import { Log, LOGLEVEL } from "./Log";
import fs from "fs";
import { Helper } from "./Helper";

export class YouTubeChannel extends Channel {
    static axios: Axios | undefined;

    public provider: ChannelProvider = "youtube";

    public userid?: string;
    public display_name?: string;
    public description?: string;
    public profile_image_url?: string;

    public channel_data: YouTubeChannelData | undefined;

    // public channel_data: YouTubeChannelData | undefined;
    public vods_raw: string[] = [];
    // public vods_list: YouTubeVOD[] = [];
    public clips_list: string[] = [];
    public static async getChannelDataById(channel_id: string, force = false): Promise<YouTubeChannelData | false> {

        if (!YouTubeChannel.axios) {
            throw new Error("YouTubeChannel.axios is undefined");
        }

        let response;

        try {
            response = await YouTubeChannel.axios.get("/channels/", {
                params: {
                    id: channel_id,
                    part: "snippet",
                    key: process.env.YOUTUBE_API_KEY,
                },
            });
        } catch (err) {
            if (axios.isAxiosError(err)) {
                Log.logAdvanced(LOGLEVEL.ERROR, "helper", `Could not get channel data for ${channel_id}: ${err.message} / ${err.response?.data.message}`, err);
                return false;
            }

            Log.logAdvanced(LOGLEVEL.ERROR, "helper", `Channel data request for ${channel_id} exceptioned: ${err}`, err);
            console.log(err);
            return false;
        }

        console.log(response.data);

        return response.data.items[0] as YouTubeChannelData;

    }

    static setupAxios() {

        console.log(chalk.blue("Setting up YouTube axios..."));

        /*

        if (!Config.getInstance().cfg("api_client_id")) {
            console.error(chalk.red("API client id not set, can't setup axios"));
            return;
        }

        let token;
        try {
            token = await Helper.getAccessToken();
        } catch (error) {
            console.error(chalk.red(`Failed to get access token: ${error}`));
            return;
        }

        if (!token) {
            Log.logAdvanced(LOGLEVEL.FATAL, "config", "Could not get access token!");
            throw new Error("Could not get access token!");
        }

        */

        YouTubeChannel.axios = axios.create({
            baseURL: "https://www.googleapis.com/youtube/v3/",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            params: {
                key: process.env.YOUTUBE_API_KEY,
            },
        });

        console.log(chalk.green("✔ Axios setup."));

    }

    public static getChannels(): YouTubeChannel[] {
        return YouTubeChannel.channels.filter((ch): ch is YouTubeChannel => ch instanceof YouTubeChannel) ?? [];
        // return Channel.channels.find((ch: AllChannels): ch is TwitchChannel => ch instanceof TwitchChannel);
    }

    public static async channelLoginFromId(channel_id: string): Promise<string | false> {
        const channelData = await this.getChannelDataById(channel_id, false);
        return channelData ? channelData.title : false;
    }

    public static async channelDisplayNameFromId(channel_id: string): Promise<string | false> {
        const channelData = await this.getChannelDataById(channel_id, false);
        return channelData ? channelData.title : false; // same as login, no other?
    }

    public static loadFromId(channel_id: string, api = false): Promise<YouTubeChannel> {
        if (!channel_id) throw new Error("Streamer channel_id is empty");
        if (typeof channel_id !== "string") throw new TypeError("Streamer channel_id is not a string");
        Log.logAdvanced(LOGLEVEL.DEBUG, "channel", `Load yt from id ${channel_id}`);
        // const channel_id = await this.channelIdFromLogin(login);
        // if (!channel_id) throw new Error(`Could not get channel id from login: ${login}`);
        return this.loadAbstract(channel_id, api); // $channel;
    }

    public static async loadAbstract(channel_id: string, api: boolean): Promise<YouTubeChannel> {

        Log.logAdvanced(LOGLEVEL.DEBUG, "channel", `Load YT channel ${channel_id}`);

        const channel_memory = YouTubeChannel.getChannels().find(channel => channel.userid === channel_id);
        if (channel_memory) {
            Log.logAdvanced(LOGLEVEL.WARNING, "channel", `Channel ${channel_id} already loaded`);
            return channel_memory;
        }

        const channel = new this();
        channel.userid = channel_id;

        const channel_data = await this.getChannelDataById(channel_id);
        if (!channel_data) throw new Error(`Could not get channel data for channel id: ${channel_id}`);

        // const channel_login = channel_data.login;

        const channel_config = Channel.channels_config.find((c: ChannelConfigs) => c.provider == "youtube" && c.id === channel_id);
        if (!channel_config) throw new Error(`Could not find channel config in memory for channel id: ${channel_id}`);

        channel.channel_data = channel_data;
        channel.config = channel_config;

        channel.display_name = channel_data.title;
        channel.description = channel_data.description;
        channel.profile_image_url = channel_data.thumbnails.default.url;
        // channel.broadcaster_type = channel_data.broadcaster_type;
        channel.applyConfig(channel_config);

        if (KeyValue.getInstance().getBool(`${channel.userid}.online`)) {
            Log.logAdvanced(LOGLEVEL.WARNING, "channel", `Channel ${channel.userid} is online, stale?`);
        }

        if (KeyValue.getInstance().get(`${channel.userid}.channeldata`)) {
            Log.logAdvanced(LOGLEVEL.WARNING, "channel", `Channel ${channel.userid} has stale chapter data.`);
        }

        if (Config.getInstance().cfg("channel_folders") && !fs.existsSync(channel.getFolder())) {
            fs.mkdirSync(channel.getFolder());
        }

        // await channel.parseVODs(api);

        // channel.findClips();

        // channel.saveKodiNfo();

        return channel;

    }

    public getFolder(): string {
        return Helper.vodFolder(this.display_name);
    }

}