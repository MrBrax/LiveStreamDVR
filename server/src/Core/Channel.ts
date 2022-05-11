import { AllChannelData, TwitchChannelData } from "../../../common/Channel";
import { ChannelConfig, ChannelConfigs, TwitchChannelConfig, VideoQuality, YouTubeChannelConfig } from "../../../common/Config";
import { BaseConfigDataFolder, BaseConfigPath } from "./BaseConfig";
import { Log, LOGLEVEL } from "./Log";
import { TwitchChannel } from "./TwitchChannel";
import fs from "fs";
import { TwitchVOD } from "./TwitchVOD";
import { TwitchVODChapter } from "./TwitchVODChapter";
import { ChannelProvider } from "../../../common/Defs";
import { Config } from "./Config";
import { YouTubeChannel } from "./YouTubeChannel";

export type AllChannels = Channel | TwitchChannel;

export abstract class Channel {

    static channels: AllChannels[] = [];
    static channels_config: ChannelConfigs[] = [];
    // static channels_cache: Record<string, TwitchChannelData> = {};

    public provider: ChannelProvider = "base";

    /**
     * Channel config from config file
     */
    public config: ChannelConfig | undefined;
    public channel_data: AllChannelData | undefined;

    public vods_raw: string[] = [];
    public vods_list: TwitchVOD[] = [];
    public clips_list: string[] = [];

    public quality: VideoQuality[] | undefined;
    public match: string[] | undefined;
    public download_chat = false;

    /** Capture chat live */
    public live_chat = false;

    /** Don't capture, just exist */
    public no_capture = false;

    /** 
     * Burn chat after capturing.
     * Currently not used.
     */
    public burn_chat = false;

    public deactivated = false;

    public current_stream_number = 0;
    public current_season = "";

    public last_online: Date | undefined;

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

        Channel.channels_config = data;

        Log.logAdvanced(LOGLEVEL.SUCCESS, "channel", `Loaded ${Channel.channels_config.length} channel configs!`);

        if (needsSave) {
            Channel.saveChannelsConfig();
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
        fs.writeFileSync(BaseConfigPath.channel, JSON.stringify(Channel.channels_config, null, 4));
        return fs.existsSync(BaseConfigPath.channel) && fs.readFileSync(BaseConfigPath.channel, "utf8") === JSON.stringify(Channel.channels_config, null, 4);
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

    public postLoad() {
        // nothing to do
    }

    applyConfig(channel_config: ChannelConfigs): void {
        this.quality = channel_config.quality !== undefined ? channel_config.quality : ["best"];
        this.match = channel_config.match !== undefined ? channel_config.match : [];
        this.download_chat = channel_config.download_chat !== undefined ? channel_config.download_chat : false;
        this.no_capture = channel_config.no_capture !== undefined ? channel_config.no_capture : false;
        this.burn_chat = channel_config.burn_chat !== undefined ? channel_config.burn_chat : false;
        this.live_chat = channel_config.live_chat !== undefined ? channel_config.live_chat : false;
    }

    /**
     * Get the current capturing vod
     */
    get current_vod(): TwitchVOD | undefined {
        return this.vods_list?.find(vod => vod.is_capturing);
    }

    /**
     * Get the latest vod of the channel regardless of its status
     */
    get latest_vod(): TwitchVOD | undefined {
        if (!this.vods_list || this.vods_list.length == 0) return undefined;
        return this.vods_list[this.vods_list.length - 1]; // is this reliable?
    }

    get current_chapter(): TwitchVODChapter | undefined {
        if (!this.current_vod || !this.current_vod.chapters || this.current_vod.chapters.length == 0) return undefined;
        // return this.current_vod.chapters.at(-1);
        return this.current_vod.chapters[this.current_vod.chapters.length - 1];
    }

    get current_duration(): number | undefined {
        return this.current_vod?.duration;
    }

    // a bit excessive since current_vod is already set with the capturing vod
    get is_live(): boolean {
        return this.current_vod != undefined && this.current_vod.is_capturing;
    }

    get is_converting(): boolean {
        return this.vods_list?.some(vod => vod.is_converting) ?? false;
    }

    get vods_size(): number {
        return this.vods_list?.reduce((acc, vod) => acc + (vod.segments?.reduce((acc, seg) => acc + (seg && seg.filesize ? seg.filesize : 0), 0) ?? 0), 0) ?? 0;
    }

}