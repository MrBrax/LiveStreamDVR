import type { Exporter } from "@/Controllers/Exporter";
import { GetExporter } from "@/Controllers/Exporter";
import { Job } from "@/Core/Job";
import { debugLog } from "@/Helpers/Console";
import { directorySize } from "@/Helpers/Filesystem";
import type { ApiBaseChannel } from "@common/Api/Client";
import type { ChannelConfig, VideoQuality } from "@common/Config";
import type { ExporterOptions } from "@common/Exporter";
import type { LocalClip } from "@common/LocalClip";
import type { LocalVideo } from "@common/LocalVideo";
import type { AudioMetadata, VideoMetadata } from "@common/MediaInfo";
import type { ChannelUpdated } from "@common/Webhook";
import type chokidar from "chokidar";
import { format } from "date-fns";
import readdirSyncRecursive from "fs-readdir-recursive";
import fs, { readdirSync } from "node:fs";
import path from "node:path";
import { xClearTimeout, xTimeout } from "../../../Helpers/Timeout";
import { videoThumbnail, videometadata } from "../../../Helpers/Video";
import type { BaseVODChapterJSON } from "../../../Storage/JSON";
import { BaseConfigDataFolder } from "../../BaseConfig";
import { Config } from "../../Config";
import { Helper } from "../../Helper";
import { KeyValue } from "../../KeyValue";
import { LiveStreamDVR } from "../../LiveStreamDVR";
import { LOGLEVEL, log } from "../../Log";
import { Webhook } from "../../Webhook";
import type { BaseVOD } from "./BaseVOD";
import type { BaseVODChapter } from "./BaseVODChapter";

export class BaseChannel {
    public declare uuid: string;

    /**
     * Channel config from config file
     */
    public config: ChannelConfig | undefined;

    /**
     * Display name used in chats and profile pages.
     * @deprecated
     */
    // public display_name?: string;
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

    public fileWatcher?: chokidar.FSWatcher;

    public _updateTimer: NodeJS.Timeout | undefined;

    public get livestreamUrl() {
        return "";
    }

    public get displayName(): string {
        return "";
    }

    public get internalName(): string {
        return "";
    }

    public get internalId(): string {
        return "";
    }

    public get description(): string {
        return "";
    }

    public get url(): string {
        return "";
    }

    public get profilePictureUrl(): string {
        return "";
    }

    public get channelLogoExists(): boolean {
        throw new Error("Method not implemented.");
    }

    /**
     * Get the current capturing vod
     */
    public get current_vod(): BaseVOD | undefined {
        return this.getVods().find((vod) => vod.is_capturing);
    }

    /**
     * Get the latest vod of the channel regardless of its status
     */
    public get latest_vod(): BaseVOD | undefined {
        if (!this.getVods() || this.getVods().length == 0) return undefined;
        return this.getVodByIndex(this.getVods().length - 1); // is this reliable?
    }

    /**
     * Returns true if the channel is currently capturing, which also means it is live.
     * It is dependent on the current vod being captured and the is_capturing flag that gets set after the initial capture process.
     * @returns {boolean}
     */
    public get is_capturing(): boolean {
        return this.current_vod != undefined && this.current_vod.is_capturing;
    }

    /**
     * Returns true if the channel is currently converting a vod (remuxing).
     * @returns {boolean}
     */
    public get is_converting(): boolean {
        return this.getVods().some((vod) => vod.is_converting) ?? false;
    }

    public get current_chapter(): BaseVODChapter | undefined {
        if (
            !this.current_vod ||
            !this.current_vod.chapters ||
            this.current_vod.chapters.length == 0
        )
            return undefined;
        // return this.current_vod.chapters.at(-1);
        return this.current_vod.chapters[this.current_vod.chapters.length - 1];
    }

    public get vods_size(): number {
        return (
            this.getVods().reduce(
                (acc, vod) =>
                    acc +
                    (vod.segments?.reduce(
                        (acc, seg) =>
                            acc + (seg && seg.filesize ? seg.filesize : 0),
                        0
                    ) ?? 0),
                0
            ) ?? 0
        );
    }

    /**
     * Returns true if the channel is currently live, not necessarily if it is capturing.
     * It is set when the hook is called with the channel.online event.
     * @returns {boolean}
     */
    public get is_live(): boolean {
        return false;
    }

    public async startWatching(): Promise<boolean> {
        return await Promise.reject(new Error("Method not implemented."));
    }

    public async stopWatching() {
        if (this.fileWatcher) await this.fileWatcher.close();
        this.fileWatcher = undefined;
        // console.log(`Stopped watching ${this.basename}`);
    }

    public checkStaleVodsInMemory() {
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
            xClearTimeout(this._updateTimer);
            this._updateTimer = undefined;
        }
        this._updateTimer = xTimeout(async () => {
            const channel = await this.toAPI();
            Webhook.dispatchAll("channel_updated", {
                channel: channel,
            } as ChannelUpdated);
            this._updateTimer = undefined;
        }, 3000);
    }

    public applyConfig(channel_config: ChannelConfig): void {
        this.quality =
            channel_config.quality !== undefined
                ? channel_config.quality
                : ["best"];
        this.match =
            channel_config.match !== undefined ? channel_config.match : [];
        this.download_chat =
            channel_config.download_chat !== undefined
                ? channel_config.download_chat
                : false;
        this.no_capture =
            channel_config.no_capture !== undefined
                ? channel_config.no_capture
                : false;
        this.burn_chat =
            channel_config.burn_chat !== undefined
                ? channel_config.burn_chat
                : false;
        this.live_chat =
            channel_config.live_chat !== undefined
                ? channel_config.live_chat
                : false;
        this.no_cleanup =
            channel_config.no_cleanup !== undefined
                ? channel_config.no_cleanup
                : false;
        this.max_storage =
            channel_config.max_storage !== undefined
                ? channel_config.max_storage
                : 0;
        this.max_vods =
            channel_config.max_vods !== undefined ? channel_config.max_vods : 0;
        this.download_vod_at_end =
            channel_config.download_vod_at_end !== undefined
                ? channel_config.download_vod_at_end
                : false;
        this.download_vod_at_end_quality =
            channel_config.download_vod_at_end_quality !== undefined
                ? channel_config.download_vod_at_end_quality
                : "best";
    }

    public async toAPI(): Promise<ApiBaseChannel> {
        const vodsList = await Promise.all(
            this.getVods().map(async (vod) => await vod.toAPI())
        );
        return await Promise.resolve({
            provider: "base",
            uuid: this.uuid || "-1",
            description: this.description || "",
            is_live: this.is_live,
            is_capturing: this.is_capturing,
            is_converting: this.is_converting,
            quality: this.quality,
            match: this.match,
            download_chat: this.download_chat,
            no_capture: this.no_capture,
            burn_chat: this.burn_chat,
            live_chat: this.live_chat,
            no_cleanup: this.no_cleanup,
            max_storage: this.max_storage,
            max_vods: this.max_vods,
            download_vod_at_end: this.download_vod_at_end,
            download_vod_at_end_quality: this.download_vod_at_end_quality,
            vods_list: vodsList || [],
            vods_raw: this.vods_raw,
            vods_size: this.vods_size || 0,
            last_online: this.last_online
                ? this.last_online.toISOString()
                : undefined,
            clips_list: this.clips_list,
            video_list: this.video_list,
            current_stream_number: this.current_stream_number,
            current_season: this.current_season,
            current_absolute_season: this.current_absolute_season,
            displayName: this.displayName,
            internalName: this.internalName,
            internalId: this.internalId,
            url: this.url,
            profilePictureUrl: this.profilePictureUrl,
        });
    }

    public getChapterData(): BaseVODChapterJSON | undefined {
        throw new Error("Method not implemented.");
    }

    public async createVOD(filename: string): Promise<BaseVOD> {
        return await Promise.reject(new Error("Method not implemented."));
    }

    public async cleanupVods(ignore_uuid = ""): Promise<number | false> {
        return await Promise.reject(new Error("Method not implemented."));
    }

    public incrementStreamNumber(): {
        season: string;
        absolute_season: number;
        stream_number: number;
        absolute_stream_number: number;
    } {
        // relative season
        const seasonIdentifier = KeyValue.getInstance().get(
            `${this.internalName}.season_identifier`
        );
        if (
            seasonIdentifier &&
            seasonIdentifier !== format(new Date(), Config.SeasonFormat)
        ) {
            this.current_stream_number = 1;
            KeyValue.getInstance().setInt(
                `${this.internalName}.stream_number`,
                1
            );
            KeyValue.getInstance().set(
                `${this.internalName}.season_identifier`,
                format(new Date(), Config.SeasonFormat)
            );
            this.current_season = format(new Date(), Config.SeasonFormat);
            log(
                LOGLEVEL.INFO,
                "channel.incrementStreamNumber",
                `Season changed for ${this.internalName} to ${this.current_season}`
            );
        } else {
            this.current_stream_number += 1;
            KeyValue.getInstance().setInt(
                `${this.internalName}.stream_number`,
                this.current_stream_number
            );
        }

        // absolute season
        if (
            parseInt(format(new Date(), "M")) !==
            KeyValue.getInstance().getInt(
                `${this.internalName}.absolute_season_month`
            )
        ) {
            KeyValue.getInstance().setInt(
                `${this.internalName}.absolute_season_month`,
                parseInt(format(new Date(), "M"))
            );
            this.current_absolute_season = this.current_absolute_season
                ? this.current_absolute_season + 1
                : 1;
            KeyValue.getInstance().setInt(
                `${this.internalName}.absolute_season_identifier`,
                this.current_absolute_season
            );
        }

        // absolute stream number
        const absoluteStreamNumber = KeyValue.getInstance().getInt(
            `${this.internalName}.absolute_stream_number`,
            0
        );
        KeyValue.getInstance().setInt(
            `${this.internalName}.absolute_stream_number`,
            absoluteStreamNumber + 1
        );

        // return this.current_stream_number;
        return {
            season: this.current_season,
            absolute_season: this.current_absolute_season ?? 0,
            stream_number: this.current_stream_number,
            absolute_stream_number: absoluteStreamNumber + 1,
        };
    }

    public async downloadLatestVod(quality: VideoQuality): Promise<string> {
        return await Promise.reject(new Error("Method not implemented."));
    }

    public sortVods() {
        return this.vods_list.sort((a, b) => {
            if (!a.started_at || !b.started_at) return 0;
            return a.started_at.getTime() - b.started_at.getTime();
        });
    }

    /**
     * Delete all VODs for channel without deleting the channel
     * @throws
     * @returns
     */
    public async deleteAllVods(): Promise<boolean> {
        const totalVods = this.getVods().length;

        if (totalVods === 0) {
            log(
                LOGLEVEL.INFO,
                "channel.deleteAllVods",
                `No vods to delete for ${this.internalName}`
            );
            throw new Error(`No vods to delete for ${this.internalName}`);
        }

        let deletedVods = 0;
        for (const vod of this.getVods()) {
            try {
                await vod.delete();
            } catch (error) {
                log(
                    LOGLEVEL.ERROR,
                    "channel.deleteAllVods",
                    `Failed to delete vod ${vod.basename}: ${
                        (error as Error).message
                    }`
                );
                continue;
            }
            deletedVods++;
        }
        return deletedVods == totalVods;
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
        if (!this.displayName)
            throw new Error("Channel display_name is not set");

        const vod = this.getVods().find((v) => v.uuid === uuid);
        if (!vod) return false;

        log(
            LOGLEVEL.INFO,
            "channel.removeVod",
            `Remove VOD JSON for ${this.internalName}: ${uuid}`
        );

        void vod.stopWatching();

        this.vods_list = this.vods_list.filter((v) => v.uuid !== uuid);

        // remove vod from database
        this.removeVodFromDatabase(
            path.relative(BaseConfigDataFolder.vod, vod.filename)
        );
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
        this.vods_raw = this.vods_raw.filter((p) => p !== filename);
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
        fs.writeFileSync(
            path.join(
                BaseConfigDataFolder.vods_db,
                `${this.internalName}.json`
            ),
            JSON.stringify(this.vods_raw)
        );
    }

    public delete(): boolean {
        const uuid = this.uuid || "";
        // const login = this.login;
        if (!uuid) throw new Error("Channel uuid is not set");

        // const userid = this.userid;

        log(
            LOGLEVEL.INFO,
            "channel.delete",
            `Deleting channel ${this.internalName}`
        );
        const configIndex =
            LiveStreamDVR.getInstance().channels_config.findIndex(
                (ch) => ch.provider == "twitch" && ch.uuid === uuid
            );
        if (configIndex !== -1) {
            LiveStreamDVR.getInstance().channels_config.splice(configIndex, 1);
        }

        const channelIndex = LiveStreamDVR.getInstance()
            .getChannels()
            .findIndex((ch) => ch.uuid === uuid);
        if (channelIndex !== -1) {
            LiveStreamDVR.getInstance().removeChannelByIndex(channelIndex);
        }

        // TODO: unsub
        if (this.internalId) void this.unsubscribe();

        LiveStreamDVR.getInstance().saveChannelsConfig();

        return LiveStreamDVR.getInstance().getChannelByUUID(uuid) == undefined;
    }

    public async findClips(): Promise<void> {
        if (!this.internalName) return;
        this.clips_list = [];

        const clipsDownloaderFolder = path.join(
            BaseConfigDataFolder.saved_clips,
            "downloader",
            this.internalName
        );
        const clipsDownloaderFiles = fs.existsSync(clipsDownloaderFolder)
            ? fs
                  .readdirSync(clipsDownloaderFolder)
                  .filter((f) => f.endsWith(".mp4"))
                  .map((f) => path.join(clipsDownloaderFolder, f))
            : [];

        const clipsSchedulerFolder = path.join(
            BaseConfigDataFolder.saved_clips,
            "scheduler",
            this.internalName
        );
        const clipsSchedulerFiles = fs.existsSync(clipsSchedulerFolder)
            ? fs
                  .readdirSync(clipsSchedulerFolder)
                  .filter((f) => f.endsWith(".mp4"))
                  .map((f) => path.join(clipsSchedulerFolder, f))
            : [];

        const clipsEditorFolder = path.join(
            BaseConfigDataFolder.saved_clips,
            "editor",
            this.internalName
        );
        const clipsEditorFiles = fs.existsSync(clipsEditorFolder)
            ? fs
                  .readdirSync(clipsEditorFolder)
                  .filter((f) => f.endsWith(".mp4"))
                  .map((f) => path.join(clipsEditorFolder, f))
            : [];

        const allClips = clipsDownloaderFiles
            .concat(clipsSchedulerFiles)
            .concat(clipsEditorFiles);

        for (const clipPath of allClips) {
            let videoMetadata: VideoMetadata | AudioMetadata;

            try {
                videoMetadata = await videometadata(clipPath);
            } catch (error) {
                log(
                    LOGLEVEL.ERROR,
                    "channel.findClips",
                    `Failed to get video metadata for clip ${clipPath}: ${
                        (error as Error).message
                    }`
                );
                continue;
            }

            if (!videoMetadata || videoMetadata.type !== "video") continue;

            let thumbnail;
            try {
                thumbnail = await videoThumbnail(clipPath, 240);
            } catch (error) {
                log(
                    LOGLEVEL.ERROR,
                    "channel.findClips",
                    `Failed to generate thumbnail for ${clipPath}: ${
                        (error as Error).message
                    }`,
                    error
                );
            }

            let clipMetadata = undefined;
            if (fs.existsSync(clipPath.replace(".mp4", ".info.json"))) {
                try {
                    clipMetadata = JSON.parse(
                        fs.readFileSync(
                            clipPath.replace(".mp4", ".info.json"),
                            "utf8"
                        )
                    );
                } catch (error) {
                    log(
                        LOGLEVEL.ERROR,
                        "channel.findClips",
                        `Failed to read clip metadata for ${clipPath}: ${
                            (error as Error).message
                        }`
                    );
                }
            }

            const clip: LocalClip = {
                folder: path.relative(
                    BaseConfigDataFolder.saved_clips,
                    path.dirname(clipPath)
                ),
                basename: path.basename(clipPath),
                extension: path.extname(clipPath).substring(1),
                channel: this.internalName,
                duration: videoMetadata.duration,
                size: videoMetadata.size,
                video_metadata: videoMetadata,
                thumbnail: thumbnail || "dummy",
                clip_metadata: clipMetadata,
            };

            this.clips_list.push(clip);
        }

        // this.clips_list = all_clips.map(f => path.relative(BaseConfigDataFolder.saved_clips, f));
        log(
            LOGLEVEL.DEBUG,
            "channel.findClips",
            `Found ${this.clips_list.length} clips for ${this.internalName}`
        );
        this.broadcastUpdate();
    }

    public async subscribe(): Promise<boolean> {
        return await Promise.resolve(false);
    }

    public async unsubscribe(): Promise<boolean> {
        return await Promise.resolve(false);
    }

    public async refreshData(): Promise<boolean> {
        return await Promise.resolve(false);
    }

    public async isLiveApi(): Promise<boolean> {
        return await Promise.resolve(false);
    }

    public async rename(new_login: string): Promise<boolean> {
        return await Promise.resolve(false);
    }

    public parseVODs(rescan = false): Promise<void> {
        return Promise.resolve();
    }

    /**
     * Remove all vods from memory, keep the files and database intact.
     * Also stops watching the filesystem for changes.
     */
    public clearVODs(): void {
        LiveStreamDVR.getInstance()
            .getVodsByChannelUUID(this.uuid)
            .forEach((v) => {
                // if (!(v instanceof TwitchVOD)) return;
                // if (v.channel_uuid !== this.uuid) return;
                void v.stopWatching();
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

    /**
     * Scans the channel folder for VOD files and returns a list of relative paths to the files.
     * Only files with the extension ".json" and a size less than 1MB are included.
     * @returns An array of relative paths to the VOD files.
     */
    public rescanVods(): string[] {
        const list = readdirSyncRecursive(this.getFolder()).filter(
            (file) =>
                file.endsWith(".json") &&
                !file.endsWith(".info.json") &&
                !file.endsWith(".metadata.json") &&
                !file.endsWith(".chat.json") &&
                fs.statSync(path.join(this.getFolder(), file)).size <
                    1024 * 1024
        );
        return list.map((p) =>
            path.relative(
                BaseConfigDataFolder.vod,
                path.join(this.getFolder(), p)
            )
        );
    }

    public addVod(vod: BaseVOD): void {
        this.vods_list.push(vod);
    }

    public makeFolder() {
        if (
            Config.getInstance().cfg("channel_folders") &&
            !fs.existsSync(this.getFolder())
        ) {
            fs.mkdirSync(this.getFolder());
        }
    }

    /**
     * Deletes any empty VOD folders for the channel.
     * Only deletes folders if channel folders are enabled and clean empty VOD folders is enabled.
     * Will not delete the root VOD folder.
     */
    public deleteEmptyVodFolders(): void {
        if (!Config.getInstance().cfg("channel_folders")) return; // only if channel folders are enabled
        if (!Config.getInstance().cfg("storage.clean_empty_vod_folders"))
            return; // only if clean empty vod folders is enabled
        const vodFolder = this.getFolder();
        // only if channel folder is not the root folder
        if (vodFolder === BaseConfigDataFolder.vod) {
            debugLog(
                `Not deleting empty folder ${vodFolder} because it is the root folder`
            );
            return;
        }
        const vodFolders = readdirSync(vodFolder).filter((f) =>
            fs.statSync(path.join(vodFolder, f)).isDirectory()
        );
        for (const vf of vodFolders) {
            debugLog(`Checking if folder ${vf} is empty`);
            if (readdirSync(path.join(vodFolder, vf)).length === 0) {
                fs.rmdirSync(path.join(vodFolder, vf)); // hopefully empty, on linux this will throw an error if not empty but i don't know about windows
                debugLog(`Deleting empty folder ${vodFolder}`);
            } else {
                debugLog(`Folder ${vf} is not empty`);
            }
        }
    }

    public getTotalVodsSizeComparedToDisk(): number {
        if (this.getFolder() === BaseConfigDataFolder.vod) return 0; // don't count root folder

        const vods = this.getVods();
        let totalChannelSize = 0;
        for (const vod of vods) {
            for (const associatedFile of vod.associatedFiles) {
                const associatedFilePath = path.join(
                    vod.directory,
                    associatedFile
                );
                if (!fs.existsSync(associatedFilePath)) continue;
                totalChannelSize += fs.statSync(associatedFilePath).size;
            }
        }

        const totalDiskSize = directorySize(this.getFolder());

        return totalChannelSize - totalDiskSize;
    }

    /**
     * Export all vods with the default exporter and default options.
     * @param force
     */
    public async exportAllVods(force = false): Promise<[number, number]> {
        const job = Job.create(`MassExporter_${this.internalName}`);
        job.dummy = true;
        job.save();
        job.broadcastUpdate(); // manual send

        const totalVods = this.vods_list.length;
        let completedVods = 0;
        let failedVods = 0;

        for (const vod of this.vods_list) {
            if (vod.exportData.exported_at && !force) {
                completedVods++;
                log(
                    LOGLEVEL.INFO,
                    "route.channels.exportallvods",
                    `Skipping VOD ${vod.basename} because it was already exported`
                );
                continue;
            }

            if (!vod.is_finalized) {
                completedVods++;
                log(
                    LOGLEVEL.INFO,
                    "route.channels.exportallvods",
                    `Skipping VOD ${vod.basename} because it is not finalized`
                );
                continue;
            }

            const exporterName = Config.getInstance().cfg<string>(
                "exporter.default.exporter",
                ""
            );

            const options: ExporterOptions = {
                vod: vod.uuid,
                directory: Config.getInstance().cfg(
                    "exporter.default.directory"
                ),
                host: Config.getInstance().cfg("exporter.default.host"),
                username: Config.getInstance().cfg("exporter.default.username"),
                password: Config.getInstance().cfg("exporter.default.password"),
                description: Config.getInstance().cfg(
                    "exporter.default.description"
                ),
                tags: Config.getInstance().cfg("exporter.default.tags"),
                category: Config.getInstance().cfg("exporter.default.category"),
                remote: Config.getInstance().cfg("exporter.default.remote"),
                title_template: Config.getInstance().cfg(
                    "exporter.default.title_template"
                ),
                privacy: Config.getInstance().cfg("exporter.default.privacy"),
            };

            let exporter: Exporter | undefined;
            try {
                exporter = GetExporter(exporterName, "vod", options);
            } catch (error) {
                log(
                    LOGLEVEL.ERROR,
                    "route.channel.ExportAllVods",
                    `Auto exporter error for '${vod.basename}': ${
                        (error as Error).message
                    }`
                );
                failedVods++;
                job.setProgress((completedVods + failedVods) / totalVods);
                continue;
            }

            if (exporter) {
                let formattedTitle;

                try {
                    formattedTitle = exporter.getFormattedTitle();
                } catch (error) {
                    log(
                        LOGLEVEL.ERROR,
                        "route.channel.ExportAllVods",
                        `Auto exporter error for '${vod.basename}': ${
                            (error as Error).message
                        }`
                    );
                    failedVods++;
                    job.setProgress((completedVods + failedVods) / totalVods);
                    continue;
                }

                log(
                    LOGLEVEL.INFO,
                    "route.channel.ExportAllVods",
                    `Exporting VOD '${vod.basename}' as '${formattedTitle}' with exporter '${exporterName}'`
                );

                let outPath;
                try {
                    outPath = await exporter.export();
                } catch (error) {
                    log(
                        LOGLEVEL.ERROR,
                        "route.channel.ExportAllVods",
                        (error as Error).message
                            ? `Export error for '${vod.basename}': ${
                                  (error as Error).message
                              }`
                            : "Unknown error occurred while exporting export"
                    );
                    failedVods++;
                    job.setProgress((completedVods + failedVods) / totalVods);
                    if (
                        (error as Error).message &&
                        (error as Error).message.includes("exceeded your")
                    ) {
                        log(
                            LOGLEVEL.FATAL,
                            "route.channel.ExportAllVods",
                            "Stopping mass export because of quota exceeded"
                        );
                        break; // stop exporting if we hit the quota
                    }
                    continue;
                }

                if (outPath) {
                    let status;
                    try {
                        status = await exporter.verify();
                    } catch (error) {
                        log(
                            LOGLEVEL.ERROR,
                            "route.channel.ExportAllVods",
                            (error as Error).message
                                ? `Verify error for '${vod.basename}': ${
                                      (error as Error).message
                                  }`
                                : "Unknown error occurred while verifying export"
                        );
                        failedVods++;
                        job.setProgress(
                            (completedVods + failedVods) / totalVods
                        );
                        continue;
                    }

                    log(
                        LOGLEVEL.SUCCESS,
                        "route.channel.ExportAllVods",
                        `Exporter finished for '${vod.basename}', status: ${status}`
                    );

                    if (status) {
                        if (exporter.vod && status) {
                            exporter.vod.exportData.exported_at =
                                new Date().toISOString();
                            exporter.vod.exportData.exporter = exporterName;
                            await exporter.vod.saveJSON("export successful");
                        }
                        completedVods++;
                        job.setProgress(
                            (completedVods + failedVods) / totalVods
                        );
                    } else {
                        failedVods++;
                        job.setProgress(
                            (completedVods + failedVods) / totalVods
                        );
                        log(
                            LOGLEVEL.ERROR,
                            "route.channel.ExportAllVods",
                            `Exporter failed for '${vod.basename}'`
                        );
                    }
                } else {
                    log(
                        LOGLEVEL.ERROR,
                        "route.channel.ExportAllVods",
                        `Exporter finished but no path output for '${vod.basename}'`
                    );
                }
            }

            if (!Job.hasJob(job.name)) {
                break; // job was deleted
            }
        }

        log(
            LOGLEVEL.INFO,
            "route.channel.ExportAllVods",
            `Exported ${completedVods} VODs, ${failedVods} failed`
        );

        job.clear();

        return [completedVods, failedVods];
    }
}
