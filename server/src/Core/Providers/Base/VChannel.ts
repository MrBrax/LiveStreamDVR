import chokidar from "chokidar";
import { ApiChannel } from "../../../../../common/Api/Client";
import { ChannelConfig, VideoQuality } from "../../../../../common/Config";
import { LocalClip } from "../../../../../common/LocalClip";
import { LocalVideo } from "../../../../../common/LocalVideo";
import { ChannelUpdated } from "../../../../../common/Webhook";
import { VOD } from "./VOD";
import { VODChapter } from "./VODChapter";
import { Webhook } from "../../Webhook";

export class VChannel {

    /**
     * Channel config from config file
     */
    public config: ChannelConfig | undefined;

    /**
     * Display name used in chats and profile pages.
     */
    public display_name?: string;
    public description?: string;

    public quality: VideoQuality[] | undefined;
    public match: string[] | undefined;
    public download_chat = false;

    /** Capture chat live */
    public live_chat = false;

    /** Don't capture, just exist */
    public no_capture = false;

    public no_cleanup = false;

    public burn_chat = false;

    public download_vod_at_end = false;
    public download_vod_at_end_quality: VideoQuality = "best";

    public max_storage = 0;
    public max_vods = 0;

    public last_online: Date | undefined;

    public current_stream_number = 0;
    public current_season = "";
    public current_absolute_season?: number;

    public vods_raw: string[] = [];

    public clips_list: LocalClip[] = [];
    public video_list: LocalVideo[] = [];
    public vods_list: VOD[] = [];

    fileWatcher?: chokidar.FSWatcher;

    public _updateTimer: NodeJS.Timeout | undefined;

    public async startWatching() {
        throw new Error("Method not implemented.");
    }

    public async stopWatching() {
        if (this.fileWatcher) await this.fileWatcher.close();
        this.fileWatcher = undefined;
        // console.log(`Stopped watching ${this.basename}`);
    }


    /**
     * Returns true if the channel is currently live, not necessarily if it is capturing.
     * It is set when the hook is called with the channel.online event.
     * @returns {boolean}
     */
    get is_live(): boolean {
        return false;
    }

    checkStaleVodsInMemory() {
        throw new Error("Method not implemented.");
    }

    public broadcastUpdate(): void {
        if (process.env.NODE_ENV === "test") return;
        if (this._updateTimer) {
            clearTimeout(this._updateTimer);
            this._updateTimer = undefined;
        }
        this._updateTimer = setTimeout(async () => {
            const channel = await this.toAPI();
            Webhook.dispatch("channel_updated", {
                channel: channel,
            } as ChannelUpdated);
            this._updateTimer = undefined;
        }, 3000);
    }

    public applyConfig(channel_config: ChannelConfig): void {
        this.quality = channel_config.quality !== undefined ? channel_config.quality : ["best"];
        this.match = channel_config.match !== undefined ? channel_config.match : [];
        this.download_chat = channel_config.download_chat !== undefined ? channel_config.download_chat : false;
        this.no_capture = channel_config.no_capture !== undefined ? channel_config.no_capture : false;
        this.burn_chat = channel_config.burn_chat !== undefined ? channel_config.burn_chat : false;
        this.live_chat = channel_config.live_chat !== undefined ? channel_config.live_chat : false;
        this.no_cleanup = channel_config.no_cleanup !== undefined ? channel_config.no_cleanup : false;
        this.max_storage = channel_config.max_storage !== undefined ? channel_config.max_storage : 0;
        this.max_vods = channel_config.max_vods !== undefined ? channel_config.max_vods : 0;
        this.download_vod_at_end = channel_config.download_vod_at_end !== undefined ? channel_config.download_vod_at_end : false;
        this.download_vod_at_end_quality = channel_config.download_vod_at_end_quality !== undefined ? channel_config.download_vod_at_end_quality : "best";
    }

    public async toAPI(): Promise<ApiChannel> {
        throw new Error("Method not implemented");
    }

    /**
     * Get the current capturing vod
     */
    get current_vod(): VOD | undefined {
        return this.vods_list?.find(vod => vod.is_capturing);
    }

    /**
     * Get the latest vod of the channel regardless of its status
     */
    get latest_vod(): VOD | undefined {
        if (!this.vods_list || this.vods_list.length == 0) return undefined;
        return this.vods_list[this.vods_list.length - 1]; // is this reliable?
    }

    /**
     * Returns true if the channel is currently capturing, which also means it is live.
     * It is dependent on the current vod being captured and the is_capturing flag that gets set after the initial capture process.
     * @returns {boolean}
     */
    get is_capturing(): boolean {
        return this.current_vod != undefined && this.current_vod.is_capturing;
    }

    /**
     * Returns true if the channel is currently converting a vod (remuxing).
     * @returns {boolean}
     */
    get is_converting(): boolean {
        return this.vods_list?.some(vod => vod.is_converting) ?? false;
    }

    get current_chapter(): VODChapter | undefined {
        if (!this.current_vod || !this.current_vod.chapters || this.current_vod.chapters.length == 0) return undefined;
        // return this.current_vod.chapters.at(-1);
        return this.current_vod.chapters[this.current_vod.chapters.length - 1];
    }

    get vods_size(): number {
        return this.vods_list?.reduce((acc, vod) => acc + (vod.segments?.reduce((acc, seg) => acc + (seg && seg.filesize ? seg.filesize : 0), 0) ?? 0), 0) ?? 0;
    }

}