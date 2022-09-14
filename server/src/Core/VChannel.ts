import chokidar from "chokidar";
import { ApiChannel } from "../../../common/Api/Client";
import { ChannelConfig, VideoQuality } from "../../../common/Config";
import { LocalClip } from "../../../common/LocalClip";
import { LocalVideo } from "../../../common/LocalVideo";
import { ChannelUpdated } from "../../../common/Webhook";
import { Webhook } from "./Webhook";

export class VChannel {

    /**
     * Channel config from config file
     */
    public config: ChannelConfig | undefined;

    /**
     * Display name used in chats and profile pages.
     */
    public display_name: string | undefined;

    public quality: VideoQuality[] | undefined;
    public match: string[] | undefined;
    public download_chat = false;

    /** Capture chat live */
    public live_chat = false;

    /** Don't capture, just exist */
    public no_capture = false;

    public no_cleanup = false;

    public max_storage = 0;
    public max_vods = 0;

    public last_online: Date | undefined;

    public current_stream_number = 0;
    public current_season = "";
    public current_absolute_season?: number;

    public vods_raw: string[] = [];

    public clips_list: LocalClip[] = [];
    public video_list: LocalVideo[] = [];

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

    public async toAPI(): Promise<ApiChannel> {
        throw new Error("Method not implemented");
    }

}