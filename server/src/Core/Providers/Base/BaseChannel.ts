import chokidar from "chokidar";
import { format } from "date-fns";
import fs from "node:fs";
import readdirSyncRecursive from "fs-readdir-recursive";
import path from "node:path";
import { ApiChannels } from "@common/Api/Client";
import { ChannelConfig, VideoQuality } from "@common/Config";
import { LocalClip } from "@common/LocalClip";
import { LocalVideo } from "@common/LocalVideo";
import { AudioMetadata, VideoMetadata } from "@common/MediaInfo";
import { ChannelUpdated } from "@common/Webhook";
import { BaseConfigDataFolder } from "../../BaseConfig";
import { Config } from "../../Config";
import { Helper } from "../../Helper";
import { KeyValue } from "../../KeyValue";
import { LiveStreamDVR } from "../../LiveStreamDVR";
import { Log } from "../../Log";
import { BaseVODChapterJSON } from "../../../Storage/JSON";
import { Webhook } from "../../Webhook";
import { BaseVOD } from "./BaseVOD";
import { BaseVODChapter } from "./BaseVODChapter";

export class BaseChannel {

    declare public uuid: string;

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

    /**
     * Send the channel.toAPI call to all connected clients over websockets.
     * A debounce is used to prevent spamming the clients.
     * 
     * @test disable
     * @returns 
     */
    public broadcastUpdate(): void {
        // if (process.env.NODE_ENV === "test") return;
        if (!Config.getInstance().initialised) return; // don't broadcast if the config hasn't been loaded yet
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
        return this.getVods().find(vod => vod.is_capturing);
    }

    /**
     * Get the latest vod of the channel regardless of its status
     */
    get latest_vod(): BaseVOD | undefined {
        if (!this.getVods() || this.getVods().length == 0) return undefined;
        return this.getVodByIndex(this.getVods().length - 1); // is this reliable?
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
        return this.getVods().some(vod => vod.is_converting) ?? false;
    }

    get current_chapter(): BaseVODChapter | undefined {
        if (!this.current_vod || !this.current_vod.chapters || this.current_vod.chapters.length == 0) return undefined;
        // return this.current_vod.chapters.at(-1);
        return this.current_vod.chapters[this.current_vod.chapters.length - 1];
    }

    get vods_size(): number {
        return this.getVods().reduce((acc, vod) => acc + (vod.segments?.reduce((acc, seg) => acc + (seg && seg.filesize ? seg.filesize : 0), 0) ?? 0), 0) ?? 0;
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

        // relative season
        const seasonIdentifier = KeyValue.getInstance().get(`${this.internalName}.season_identifier`);
        if (seasonIdentifier && seasonIdentifier !== format(new Date(), Config.SeasonFormat)) {
            this.current_stream_number = 1;
            KeyValue.getInstance().setInt(`${this.internalName}.stream_number`, 1);
            KeyValue.getInstance().set(`${this.internalName}.season_identifier`, format(new Date(), Config.SeasonFormat));
            this.current_season = format(new Date(), Config.SeasonFormat);
            Log.logAdvanced(Log.Level.INFO, "channel.incrementStreamNumber", `Season changed for ${this.internalName} to ${this.current_season}`);
        } else {
            this.current_stream_number += 1;
            KeyValue.getInstance().setInt(`${this.internalName}.stream_number`, this.current_stream_number);
        }

        // absolute season
        if (parseInt(format(new Date(), "M")) !== KeyValue.getInstance().getInt(`${this.internalName}.absolute_season_month`)) {
            KeyValue.getInstance().setInt(`${this.internalName}.absolute_season_month`, parseInt(format(new Date(), "M")));
            this.current_absolute_season = this.current_absolute_season ? this.current_absolute_season + 1 : 1;
            KeyValue.getInstance().setInt(`${this.internalName}.absolute_season_identifier`, this.current_absolute_season);
        }

        return this.current_stream_number;
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
        const total_vods = this.getVods().length;

        if (total_vods === 0) {
            Log.logAdvanced(Log.Level.INFO, "channel.deleteAllVods", `No vods to delete for ${this.internalName}`);
            throw new Error(`No vods to delete for ${this.internalName}`);
        }

        let deleted_vods = 0;
        for (const vod of this.getVods()) {
            try {
                await vod.delete();
            } catch (error) {
                Log.logAdvanced(Log.Level.ERROR, "channel.deleteAllVods", `Failed to delete vod ${vod.basename}: ${(error as Error).message}`);
                continue;
            }
            deleted_vods++;
        }
        return deleted_vods == total_vods;
    }

    /**
     * Remove a vod from the channel and the main vods list.
     * It is not deleted from the disk.
     *
     * @returns
     * @param uuid
     */
    public removeVod(uuid: string): boolean {

        if (!this.internalId) throw new Error("Channel userid is not set");
        if (!this.internalName) throw new Error("Channel login is not set");
        if (!this.displayName) throw new Error("Channel display_name is not set");

        const vod = this.getVods().find(v => v.uuid === uuid);
        if (!vod) return false;

        Log.logAdvanced(Log.Level.INFO, "channel", `Remove VOD JSON for ${this.internalName}: ${uuid}`);
        
        vod.stopWatching();

        this.vods_list = this.vods_list.filter(v => v.uuid !== uuid);

        // remove vod from database
        this.removeVodFromDatabase(path.relative(BaseConfigDataFolder.vod, vod.filename));
        // fs.writeFileSync(path.join(BaseConfigDataFolder.vods_db, `${this.internalName}.json`), JSON.stringify(this.vods_raw));
        this.saveVodDatabase();

        LiveStreamDVR.getInstance().removeVod(uuid);

        this.checkStaleVodsInMemory();

        this.broadcastUpdate();

        return true;

    }

    public addVodToDatabase(filename: string) {
        this.vods_raw.push(filename);
    }

    public removeVodFromDatabase(filename: string) {
        this.vods_raw = this.vods_raw.filter(p => p !== filename);
    }

    public getVods(): BaseVOD[] {
        return this.vods_list;
    }

    public getVodByIndex(index: number): BaseVOD | undefined {
        if (index < 0 || index >= this.vods_list.length) {
            return undefined;
        }
        return this.vods_list[index];
    }

    /**
     * @test disable
     */
    public saveVodDatabase() {
        fs.writeFileSync(path.join(BaseConfigDataFolder.vods_db, `${this.internalName}.json`), JSON.stringify(this.vods_raw));
    }

    public delete(): boolean {

        const uuid = this.uuid || "";
        // const login = this.login;
        if (!uuid) throw new Error("Channel uuid is not set");

        // const userid = this.userid;

        Log.logAdvanced(Log.Level.INFO, "channel", `Deleting channel ${this.internalName}`);
        const index_config = LiveStreamDVR.getInstance().channels_config.findIndex(ch => ch.provider == "twitch" && ch.uuid === uuid);
        if (index_config !== -1) {
            LiveStreamDVR.getInstance().channels_config.splice(index_config, 1);
        }

        const index_channel = LiveStreamDVR.getInstance().getChannels().findIndex(ch => ch.uuid === uuid);
        if (index_channel !== -1) {
            LiveStreamDVR.getInstance().removeChannelByIndex(index_channel);
        }

        // TODO: unsub
        if (this.internalId) this.unsubscribe();

        LiveStreamDVR.getInstance().saveChannelsConfig();

        return LiveStreamDVR.getInstance().getChannelByUUID(uuid) == undefined;
    }

    public async findClips(): Promise<void> {
        if (!this.internalName) return;
        this.clips_list = [];

        const clips_downloader_folder = path.join(BaseConfigDataFolder.saved_clips, "downloader", this.internalName);
        const clips_downloader = fs.existsSync(clips_downloader_folder) ? fs.readdirSync(clips_downloader_folder).filter(f => f.endsWith(".mp4")).map(f => path.join(clips_downloader_folder, f)) : [];

        const clips_scheduler_folder = path.join(BaseConfigDataFolder.saved_clips, "scheduler", this.internalName);
        const clips_scheduler = fs.existsSync(clips_scheduler_folder) ? fs.readdirSync(clips_scheduler_folder).filter(f => f.endsWith(".mp4")).map(f => path.join(clips_scheduler_folder, f)) : [];

        const clips_editor_folder = path.join(BaseConfigDataFolder.saved_clips, "editor", this.internalName);
        const clips_editor = fs.existsSync(clips_editor_folder) ? fs.readdirSync(clips_editor_folder).filter(f => f.endsWith(".mp4")).map(f => path.join(clips_editor_folder, f)) : [];

        const all_clips = clips_downloader.concat(clips_scheduler).concat(clips_editor);

        for (const clip_path of all_clips) {

            let video_metadata: VideoMetadata | AudioMetadata;

            try {
                video_metadata = await Helper.videometadata(clip_path);
            } catch (error) {
                Log.logAdvanced(Log.Level.ERROR, "channel", `Failed to get video metadata for clip ${clip_path}: ${(error as Error).message}`);
                continue;
            }

            if (!video_metadata || video_metadata.type !== "video") continue;

            let thumbnail;
            try {
                thumbnail = await Helper.videoThumbnail(clip_path, 240);
            } catch (error) {
                Log.logAdvanced(Log.Level.ERROR, "channel", `Failed to generate thumbnail for ${clip_path}: ${error}`);
            }

            let clip_metadata = undefined;
            if (fs.existsSync(clip_path.replace(".mp4", ".info.json"))) {
                try {
                    clip_metadata = JSON.parse(fs.readFileSync(clip_path.replace(".mp4", ".info.json"), "utf8"));
                } catch (error) {
                    Log.logAdvanced(Log.Level.ERROR, "channel", `Failed to read clip metadata for ${clip_path}: ${(error as Error).message}`);
                }
            }

            const clip: LocalClip = {
                folder: path.relative(BaseConfigDataFolder.saved_clips, path.dirname(clip_path)),
                basename: path.basename(clip_path),
                extension: path.extname(clip_path).substring(1),
                channel: this.internalName,
                duration: video_metadata.duration,
                size: video_metadata.size,
                video_metadata: video_metadata,
                thumbnail: thumbnail || "dummy",
                clip_metadata: clip_metadata,
            };

            this.clips_list.push(clip);

        }

        // this.clips_list = all_clips.map(f => path.relative(BaseConfigDataFolder.saved_clips, f));
        Log.logAdvanced(Log.Level.DEBUG, "channel.findClips", `Found ${this.clips_list.length} clips for ${this.internalName}`);
        this.broadcastUpdate();
    }

    public async subscribe(): Promise<boolean> {
        return await Promise.resolve(false);
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

    /**
     * Remove all vods from memory, keep the files and database intact.
     * Also stops watching the filesystem for changes.
     */
    public clearVODs(): void {
        LiveStreamDVR.getInstance().getVodsByChannelUUID(this.uuid).forEach(v => {
            // if (!(v instanceof TwitchVOD)) return;
            // if (v.channel_uuid !== this.uuid) return;
            v.stopWatching();
        });
        // LiveStreamDVR.getInstance().vods = LiveStreamDVR.getInstance().vods.filter(v => v.channel_uuid !== this.uuid);
        LiveStreamDVR.getInstance().removeAllVodsByChannelUUID(this.uuid);
        this.vods_raw = [];
        this.vods_list = [];
    }

    /**
     * Folder for the channel that stores VODs and all other data
     * 
     * @returns {string} Folder path
     */
    public getFolder(): string {
        return Helper.vodFolder(this.internalName);
    }

    public rescanVods(): string[] {
        const list = readdirSyncRecursive(this.getFolder())
            .filter(file =>
                file.endsWith(".json") &&
                !file.endsWith(".info.json") &&
                !file.endsWith(".metadata.json") &&
                !file.endsWith(".chat.json") &&
                fs.statSync(path.join(this.getFolder(), file)).size < 1024 * 1024
            );
        return list.map(
            p => path.relative(
                BaseConfigDataFolder.vod,
                path.join(this.getFolder(), p)
            ));
    }

    public addVod(vod: BaseVOD): void {
        this.vods_list.push(vod);
    }

    public makeFolder() {
        if (Config.getInstance().cfg("channel_folders") && !fs.existsSync(this.getFolder())) {
            fs.mkdirSync(this.getFolder());
        }
    }

    get channelLogoExists(): boolean {
        throw new Error("Method not implemented.");
    }

}