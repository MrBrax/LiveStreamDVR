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

export type AllChannels = Channel | TwitchChannel | YouTubeChannel;

export abstract class Channel {
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

    public async toAPI(): Promise<void> {
        // dummy resolve
        return await Promise.resolve();
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