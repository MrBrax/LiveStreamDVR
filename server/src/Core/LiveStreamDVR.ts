import { randomUUID } from "crypto";
import fs from "fs";
import { ChannelConfig } from "../../../common/Config";
import { BaseConfigPath, BaseConfigDataFolder } from "./BaseConfig";
import { Config } from "./Config";
import { Log, LOGLEVEL } from "./Log";
import { BaseVODChapter } from "./Providers/Base/BaseVODChapter";
import { TwitchChannel } from "./Providers/Twitch/TwitchChannel";
import { TwitchVOD } from "./Providers/Twitch/TwitchVOD";
import { TwitchVODChapter } from "./Providers/Twitch/TwitchVODChapter";
import { YouTubeChannel } from "./Providers/YouTube/YouTubeChannel";
import { YouTubeVOD } from "./Providers/YouTube/YouTubeVOD";
import { Webhook } from "./Webhook";

export type ChannelTypes = TwitchChannel | YouTubeChannel;
export type VODTypes = TwitchVOD | YouTubeVOD;
export type ChapterTypes = TwitchVODChapter | BaseVODChapter;

export class LiveStreamDVR {
    public static instance: LiveStreamDVR | undefined;
    public static filenameIllegalChars = /[:*?"<>|]/g;

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
            if (!channel.uuid) {
                channel.uuid = randomUUID();
                console.log(`Channel does not have an UUID, generated: ${channel.uuid}`);
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

                } else if (channel.provider == "youtube") {

                    let ch: YouTubeChannel;

                    try {
                        ch = await YouTubeChannel.loadFromId(channel.channel_id);
                    } catch (th) {
                        Log.logAdvanced(LOGLEVEL.FATAL, "config", `Channel ${channel.channel_id} could not be loaded: ${th}`);
                        continue;
                        // break;
                    }

                    if (ch) {
                        this.channels.push(ch);
                        ch.postLoad();
                        ch.vods_list.forEach(vod => vod.postLoad());
                        Log.logAdvanced(LOGLEVEL.SUCCESS, "config", `Loaded channel ${channel.channel_id} with ${ch.vods_list?.length} vods`);
                        if (ch.no_capture) {
                            Log.logAdvanced(LOGLEVEL.WARNING, "config", `Channel ${channel.channel_id} is configured to not capture streams.`);
                        }
                    } else {
                        Log.logAdvanced(LOGLEVEL.FATAL, "config", `Channel ${channel.channel_id} could not be added, please check logs.`);
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

    public getChannels(): ChannelTypes[] {
        return this.channels;
    }

    public cleanLingeringVODs(): void {
        this.vods.forEach((vod) => {
            const channel = vod.getChannel();
            if (!channel) {
                Log.logAdvanced(LOGLEVEL.WARNING, "vodclass", `Channel ${vod.streamer_name} removed but VOD ${vod.basename} still lingering`);
            }
            if (!fs.existsSync(vod.filename)) {
                Log.logAdvanced(LOGLEVEL.WARNING, "vodclass", `VOD ${vod.basename} in memory but not on disk`);
            }
        });
    }

    public getChannelByUUID(uuid: string): ChannelTypes | false {
        const search = this.channels.find(c => c.uuid == uuid);
        if (!search) return false;
        return search;
    }

    public getVodByUUID(uuid: string): VODTypes | false {
        const search = this.vods.find(c => c.uuid == uuid);
        if (!search) return false;
        return search;
    }


    /**
     * Remove a vod from the vods list
     * 
     * @param uuid 
     * @returns 
     */
    public  removeVod(uuid: string): boolean {
        const vod = this.getVodByUUID(uuid);
        if (vod) {
            this.vods = this.vods.filter(vod => vod.uuid != uuid);
            Log.logAdvanced(LOGLEVEL.INFO, "vodclass", `VOD ${vod.basename} removed from memory!`);
            Webhook.dispatch("vod_removed", { basename: vod.basename });
            return true;
        }
        return false;
    }

}