import chokidar from "chokidar";
import { ChannelConfig, VideoQuality } from "../../../common/Config";

export class VChannel {

    /**
     * Channel config from config file
     */
    public config: ChannelConfig | undefined;

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

    fileWatcher?: chokidar.FSWatcher;
    
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

}