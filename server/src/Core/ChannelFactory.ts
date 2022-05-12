import { ChannelConfigs, TwitchChannelConfig, YouTubeChannelConfig } from "../../../common/Config";
import { BaseConfigPath, BaseConfigDataFolder } from "./BaseConfig";
import { AllChannels } from "./Channel";
import { Config } from "./Config";
import { Log, LOGLEVEL } from "./Log";
import { TwitchChannel } from "./TwitchChannel";
import { YouTubeChannel } from "./YouTubeChannel";
import fs from "fs";

export class ChannelFactory {

    static channels: AllChannels[] = [];
    static channels_config: ChannelConfigs[] = [];
    // static channels_cache: Record<string, TwitchChannelData> = {};

    /**
     * Load channel config into memory, not the channels themselves.
     */
    public static loadChannelsConfig(): boolean {

        if (!fs.existsSync(BaseConfigPath.channel)) {
            return false;
        }

        Log.logAdvanced(LOGLEVEL.INFO, "channel", "Loading channel configs...");

        const data: TwitchChannelConfig[] | YouTubeChannelConfig[] = JSON.parse(fs.readFileSync(BaseConfigPath.channel, "utf8"));

        let needsSave = false;
        for (const channel of data) {
            if (!("quality" in channel) || !channel.quality) {
                Log.logAdvanced(LOGLEVEL.WARNING, "channel", `Channel ${channel} has no quality set, setting to default`);
                channel.quality = ["best"];
                needsSave = true;
            }
            if (!("provider" in channel) || !channel.provider) {
                (channel as any).provider = "twitch";
                needsSave = true;
            }
        }

        this.channels_config = data;

        Log.logAdvanced(LOGLEVEL.SUCCESS, "channel", `Loaded ${this.channels_config.length} channel configs!`);

        if (needsSave) {
            this.saveChannelsConfig();
        }

        if (Config.getInstance().cfg("channel_folders")) {
            const folders = fs.readdirSync(BaseConfigDataFolder.vod);
            for (const folder of folders) {
                if (folder == ".gitkeep") continue;
                // FIXME: ts complains about union type
                // if (!Channel.channels_config.find(ch => ch.login === folder)) {
                //     Log.logAdvanced(LOGLEVEL.WARNING, "channel", `Channel folder ${folder} is not in channel config, left over?`);
                // }
            }
        }

        return true;

    }

    public static saveChannelsConfig(): boolean {
        Log.logAdvanced(LOGLEVEL.INFO, "channel", "Saving channel config");
        fs.writeFileSync(BaseConfigPath.channel, JSON.stringify(this.channels_config, null, 4));
        return fs.existsSync(BaseConfigPath.channel) && fs.readFileSync(BaseConfigPath.channel, "utf8") === JSON.stringify(this.channels_config, null, 4);
    }

    /**
     * Load channels into memory
     * 
     * @returns Amount of loaded channels
     */
    public static async loadChannels(): Promise<number> {
        Log.logAdvanced(LOGLEVEL.INFO, "channel", "Loading channels...");
        if (this.channels_config.length > 0) {
            for (const channel of this.channels_config) {

                const def = channel.provider === "twitch" ? channel.login : channel.id;

                let ch: AllChannels | undefined;

                try {
                    if (channel.provider === "twitch") { 
                        ch = await TwitchChannel.loadFromLogin(channel.login, true);
                    } else if (channel.provider === "youtube") {
                        ch = await YouTubeChannel.loadFromId(channel.id, true);
                    } else {
                        Log.logAdvanced(LOGLEVEL.ERROR, "channel", `Unknown channel provider ${JSON.stringify(channel)}`);
                    }
                } catch (th) {
                    Log.logAdvanced(LOGLEVEL.FATAL, "config", `Channel ${def} could not be loaded: ${th}`);
                    continue;
                    // break;
                }

                if (ch) {
                    this.channels.push(ch);
                    ch.postLoad();
                    ch.vods_list.forEach(vod => vod.postLoad());
                    Log.logAdvanced(LOGLEVEL.SUCCESS, "config", `Loaded channel ${def} with ${ch.vods_list?.length} vods`);
                } else {
                    Log.logAdvanced(LOGLEVEL.FATAL, "config", `Channel ${def} could not be added, please check logs.`);
                    break;
                }
            }
        }
        Log.logAdvanced(LOGLEVEL.SUCCESS, "channel", `Loaded ${this.channels.length} channels!`);
        return this.channels.length;
    }

    public static getChannels(): AllChannels[] {
        return this.channels;
    }

}