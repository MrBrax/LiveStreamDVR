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

interface YouTubeChannelData extends youtube_v3.Schema$ChannelSnippet {
    _updated: number;
    id: string;
}

export class YouTubeChannel extends VChannel {

    static channels_cache: Record<string, YouTubeChannelData> = {};

    public provider: Providers = "youtube";

    public channel_id = "";

    public vods_list: string[] = [];
    

    public static getChannels(): YouTubeChannel[] {
        return LiveStreamDVR.getInstance().channels.filter<YouTubeChannel>((channel): channel is YouTubeChannel => channel instanceof YouTubeChannel) || [];
    }

    static create(config: YouTubeChannelConfig): Promise<YouTubeChannel> {
        throw new Error("Method not implemented.");
    }

    public static async getUserDataById(channel_id: string, force = false): Promise<youtube_v3.Schema$ChannelSnippet | false> {
        return await this.getUserDataProxy("id", channel_id, force);
    }

    public static async getUserDataByUsername(username: string, force = false): Promise<youtube_v3.Schema$ChannelSnippet | false> {
        return await this.getUserDataProxy("username", username, force);
    }

    static async getUserDataProxy(method: "id" | "username", identifier: string, force = false): Promise<false | youtube_v3.Schema$ChannelSnippet> {

        if (!identifier) {
            throw new Error("No identifier supplied");
        }

        Log.logAdvanced(LOGLEVEL.DEBUG, "channel", `Fetching user data for ${method} ${identifier}, force: ${force}`);

        // check cache first
        if (!force) {
            const channelData = method == "id" ? this.channels_cache[identifier] : Object.values(this.channels_cache).find(channel => channel.customUrl == identifier);
            if (channelData) {
                Log.logAdvanced(LOGLEVEL.DEBUG, "channel", `User data found in memory cache for ${method} ${identifier}`);
                if (Date.now() > channelData._updated + Config.streamerCacheTime) {
                    Log.logAdvanced(LOGLEVEL.INFO, "helper", `Memory cache for ${identifier} is outdated, fetching new data`);
                } else {
                    Log.logAdvanced(LOGLEVEL.DEBUG, "channel", `Returning memory cache for ${method} ${identifier}`);
                    return channelData;
                }
            } else {
                Log.logAdvanced(LOGLEVEL.DEBUG, "channel", `User data not found in memory cache for ${method} ${identifier}, continue fetching`);
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

        return res.data.items[0].snippet;
        
    }

    static getChannelById(channel_id: string): YouTubeChannel | undefined {
        return LiveStreamDVR.getInstance().channels.find<YouTubeChannel>((ch): ch is YouTubeChannel => ch instanceof YouTubeChannel && ch.channel_id === channel_id);
    }

    public static loadChannelsCache(): boolean {
        if (!fs.existsSync(BaseConfigPath.streamerYouTubeCache)) return false;

        const data = fs.readFileSync(BaseConfigPath.streamerYouTubeCache, "utf8");
        this.channels_cache = JSON.parse(data);
        Log.logAdvanced(LOGLEVEL.SUCCESS, "channel", `Loaded ${Object.keys(this.channels_cache).length} YouTube channels from cache.`);
        return true;
    }

}