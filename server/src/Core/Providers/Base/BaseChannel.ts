import chokidar from "chokidar";
import { ApiChannels } from "../../../../../common/Api/Client";
import { ChannelConfig, VideoQuality } from "../../../../../common/Config";
import { LocalClip } from "../../../../../common/LocalClip";
import { LocalVideo } from "../../../../../common/LocalVideo";
import { ChannelUpdated } from "../../../../../common/Webhook";
import { BaseVOD } from "./BaseVOD";
import { BaseVODChapter } from "./BaseVODChapter";
import { Webhook } from "../../Webhook";
import { BaseVODChapterJSON } from "../../../Storage/JSON";
import { Log, LOGLEVEL } from "../../../Core/Log";
import path from "path";
import fs from "fs";
import { BaseConfigDataFolder } from "../../../Core/BaseConfig";
import { LiveStreamDVR } from "../../../Core/LiveStreamDVR";

export class BaseChannel {
    
    public uuid?: string;

    /**
     * Channel config from config file
     */
    public config: ChannelConfig | undefined;

    /**
     * Display name used in chats and profile pages.
     * @deprecated
     */
    public display_name?: string;
    // public description?: string;

    /** @deprecated */
    public profile_image_url: string | undefined;

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
    public vods_list: BaseVOD[] = [];

    fileWatcher?: chokidar.FSWatcher;

    public _updateTimer: NodeJS.Timeout | undefined;

    get livestreamUrl() {
        return "";
    }

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

    public async toAPI(): Promise<ApiChannels> {
        throw new Error("Method not implemented");
    }

    /**
     * Get the current capturing vod
     */
    get current_vod(): BaseVOD | undefined {
        return this.vods_list?.find(vod => vod.is_capturing);
    }

    /**
     * Get the latest vod of the channel regardless of its status
     */
    get latest_vod(): BaseVOD | undefined {
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

    get current_chapter(): BaseVODChapter | undefined {
        if (!this.current_vod || !this.current_vod.chapters || this.current_vod.chapters.length == 0) return undefined;
        // return this.current_vod.chapters.at(-1);
        return this.current_vod.chapters[this.current_vod.chapters.length - 1];
    }

    get vods_size(): number {
        return this.vods_list?.reduce((acc, vod) => acc + (vod.segments?.reduce((acc, seg) => acc + (seg && seg.filesize ? seg.filesize : 0), 0) ?? 0), 0) ?? 0;
    }

    public getChapterData(): BaseVODChapterJSON | undefined {
        throw new Error("Method not implemented.");
    }

    public async createVOD(filename: string): Promise<BaseVOD> {
        throw new Error("Method not implemented.");
    }

    public async cleanupVods(ignore_uuid = ""): Promise<number | false> {
        throw new Error("Method not implemented.");
    }

    public incrementStreamNumber(): number {
        throw new Error("Method not implemented.");
    }

    public async downloadLatestVod(quality: VideoQuality): Promise<string> {
        throw new Error("Method not implemented.");
    }

    public sortVods() {
        return this.vods_list.sort((a, b) => {
            if (!a.started_at || !b.started_at) return 0;
            return a.started_at.getTime() - b.started_at.getTime();
        });
    }

    get displayName(): string {
        return "";
    }

    get internalName(): string {
        return "";
    }

    get internalId(): string {
        return "";
    }

    get description(): string {
        return "";
    }

    get profilePictureUrl(): string {
        return "";
    }

    /**
     * Delete all VODs for channel without deleting the channel
     * @throws
     * @returns 
     */
    public async deleteAllVods(): Promise<boolean> {
        const total_vods = this.vods_list.length;

        if (total_vods === 0) {
            Log.logAdvanced(LOGLEVEL.INFO, "vodclass", `No vods to delete for ${this.internalName}`);
            throw new Error(`No vods to delete for ${this.internalName}`);
        }

        let deleted_vods = 0;
        for (const vod of this.vods_list) {
            try {
                await vod.delete();
            } catch (error) {
                Log.logAdvanced(LOGLEVEL.ERROR, "vodclass", `Failed to delete vod ${vod.basename}: ${(error as Error).message}`);
                continue;
            }
            deleted_vods++;
        }
        return deleted_vods == total_vods;
    }

    /**
     * Remove a vod from the channel and the main vods list
     * 
     * @param basename 
     * @returns 
     */
    public removeVod(uuid: string): boolean {

        if (!this.internalId) throw new Error("Channel userid is not set");
        if (!this.internalName) throw new Error("Channel login is not set");
        if (!this.displayName) throw new Error("Channel display_name is not set");

        const vod = this.vods_list.find(v => v.uuid === uuid);
        if (!vod) return false;

        Log.logAdvanced(LOGLEVEL.INFO, "channel", `Remove VOD JSON for ${this.internalName}: ${uuid}`);

        this.vods_list = this.vods_list.filter(v => v.uuid !== uuid);

        // remove vod from database
        this.vods_raw = this.vods_raw.filter(p => p !== path.relative(BaseConfigDataFolder.vod, vod.filename));
        fs.writeFileSync(path.join(BaseConfigDataFolder.vods_db, `${this.internalName}.json`), JSON.stringify(this.vods_raw));

        LiveStreamDVR.getInstance().removeVod(uuid);

        this.checkStaleVodsInMemory();

        return true;

    }

    public delete(): boolean {

        const uuid = this.uuid || "";
        // const login = this.login;
        if (!uuid) throw new Error("Channel uuid is not set");

        // const userid = this.userid;

        Log.logAdvanced(LOGLEVEL.INFO, "channel", `Deleting channel ${this.internalName}`);
        const index_config = LiveStreamDVR.getInstance().channels_config.findIndex(ch => ch.provider == "twitch" && ch.uuid === uuid);
        if (index_config !== -1) {
            LiveStreamDVR.getInstance().channels_config.splice(index_config, 1);
        }

        const index_channel = LiveStreamDVR.getInstance().channels.findIndex(ch => ch.uuid === uuid);
        if (index_channel !== -1) {
            LiveStreamDVR.getInstance().channels.splice(index_channel, 1);
        }

        // @todo unsub
        if (this.internalId) this.unsubscribe();

        LiveStreamDVR.getInstance().saveChannelsConfig();

        return LiveStreamDVR.getInstance().getChannelByUUID(uuid) == undefined;
    }

    public async unsubscribe(): Promise<boolean> {
        return await Promise.resolve(false);
    }

    public async refreshData(): Promise<boolean> { return false; }

    public async isLiveApi(): Promise<boolean> {
        return false;
    }

    public async rename(new_login: string): Promise<boolean> { return false; }

    public parseVODs(rescan = false): Promise<void> { return Promise.resolve(); }

    public clearVODs(): void {
        LiveStreamDVR.getInstance().vods.forEach(v => {
            // if (!(v instanceof TwitchVOD)) return;
            if (v.channel_uuid !== this.uuid) return;
            v.stopWatching();
        });
        LiveStreamDVR.getInstance().vods = LiveStreamDVR.getInstance().vods.filter(v => v.channel_uuid !== this.uuid);
        this.vods_raw = [];
        this.vods_list = [];
    }

}