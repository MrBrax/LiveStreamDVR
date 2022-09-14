import fs from "fs";
import { ChannelConfig } from "../../../common/Config";
import { BaseConfigPath, BaseConfigDataFolder } from "./BaseConfig";
import { Config } from "./Config";
import { Log, LOGLEVEL } from "./Log";
import { TwitchChannel } from "./TwitchChannel";
import { TwitchVOD } from "./TwitchVOD";
import { YouTubeChannel } from "./YouTubeChannel";

type ChannelTypes = TwitchChannel | YouTubeChannel;
type VODTypes = TwitchVOD;

export class LiveStreamDVR {
    public static instance: LiveStreamDVR | undefined;

    channels_config: ChannelConfig[] = [];
    channels: ChannelTypes[] = [];
    vods: VODTypes[] = [];

    static getInstance(): LiveStreamDVR {
        if (!this.instance) {
            this.instance = new LiveStreamDVR();
        }
        return this.instance;
    }

    static getCleanInstance() {
        return new LiveStreamDVR();
    }

    static destroyInstance() {
        this.instance = undefined;
    }

    public loadChannelsConfig(): boolean {

        if (!fs.existsSync(BaseConfigPath.channel)) {
            return false;
        }

        Log.logAdvanced(LOGLEVEL.INFO, "channel", "Loading channel configs...");

        const data: ChannelConfig[] = JSON.parse(fs.readFileSync(BaseConfigPath.channel, "utf8"));

        let needsSave = false;
        for (const channel of data) {
            if ((!("quality" in channel) || !channel.quality) && channel.provider == "twitch") {
                Log.logAdvanced(LOGLEVEL.WARNING, "channel", `Channel ${channel.login} has no quality set, setting to default`);
                channel.quality = ["best"];
                needsSave = true;
            }
            if (!("provider" in channel)) {
                (channel as any).provider = "twitch";
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
                if (!this.channels_config.find(ch => ch.provider == "twitch" && ch.login === folder)) {
                    Log.logAdvanced(LOGLEVEL.WARNING, "channel", `Channel folder ${folder} is not in channel config, left over?`);
                }
            }
        }

        return true;

    }

    /**
     * Load channels into memory
     * 
     * @returns Amount of loaded channels
     */
    public async loadChannels(): Promise<number> {
        Log.logAdvanced(LOGLEVEL.INFO, "channel", "Loading channels...");
        if (this.channels_config.length > 0) {
            for (const channel of this.channels_config) {

                if (!channel.provider || channel.provider == "twitch") {

                    let ch: TwitchChannel;

                    try {
                        ch = await TwitchChannel.loadFromLogin(channel.login);
                    } catch (th) {
                        Log.logAdvanced(LOGLEVEL.FATAL, "config", `Channel ${channel.login} could not be loaded: ${th}`);
                        continue;
                        // break;
                    }

                    if (ch) {
                        this.channels.push(ch);
                        ch.postLoad();
                        ch.vods_list.forEach(vod => vod.postLoad());
                        Log.logAdvanced(LOGLEVEL.SUCCESS, "config", `Loaded channel ${channel.login} with ${ch.vods_list?.length} vods`);
                        if (ch.no_capture) {
                            Log.logAdvanced(LOGLEVEL.WARNING, "config", `Channel ${channel.login} is configured to not capture streams.`);
                        }
                    } else {
                        Log.logAdvanced(LOGLEVEL.FATAL, "config", `Channel ${channel.login} could not be added, please check logs.`);
                        break;
                    }

                }
            }
        }
        Log.logAdvanced(LOGLEVEL.SUCCESS, "channel", `Loaded ${this.channels.length} channels!`);
        return this.channels.length;
    }

    public saveChannelsConfig(): boolean {
        Log.logAdvanced(LOGLEVEL.INFO, "channel", "Saving channel config");
        fs.writeFileSync(BaseConfigPath.channel, JSON.stringify(this.channels_config, null, 4));
        return fs.existsSync(BaseConfigPath.channel) && fs.readFileSync(BaseConfigPath.channel, "utf8") === JSON.stringify(this.channels_config, null, 4);
    }

}