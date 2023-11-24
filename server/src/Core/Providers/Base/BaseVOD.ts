import { debugLog } from "@/Helpers/Console";
import { exec, isExecError, startJob } from "@/Helpers/Execute";
import { formatBytes } from "@/Helpers/Format";
import { xClearTimeout, xTimeout } from "@/Helpers/Timeout";
import { isTwitchVOD, isTwitchVODChapter } from "@/Helpers/Types";
import {
    ffmpeg_time,
    remuxFile,
    videoContactSheet,
    videometadata,
} from "@/Helpers/Video";
import type { BaseVODChapterJSON, VODJSON } from "@/Storage/JSON";
import type { ApiBaseVod } from "@common/Api/Client";
import type { VODBookmark } from "@common/Bookmark";
import type { VideoQuality } from "@common/Config";
import type { Providers } from "@common/Defs";
import { JobStatus, MuteStatus } from "@common/Defs";
import type { ExportData } from "@common/Exporter";
import type { AudioMetadata, VideoMetadata } from "@common/MediaInfo";
import type { StreamPause, VodViewerEntry } from "@common/Vod";
import type { VodUpdated } from "@common/Webhook";
import chalk from "chalk";
import chokidar from "chokidar";
import { format, parseJSON } from "date-fns";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { BaseConfigCacheFolder, BaseConfigDataFolder } from "../../BaseConfig";
import { ClientBroker } from "../../ClientBroker";
import { Config } from "../../Config";
import { FFmpegMetadata } from "../../FFmpegMetadata";
import { Helper } from "../../Helper";
import { Job } from "../../Job";
import type { VODTypes } from "../../LiveStreamDVR";
import { LiveStreamDVR } from "../../LiveStreamDVR";
import { LOGLEVEL, log } from "../../Log";
import { Webhook } from "../../Webhook";
import type { BaseChannel } from "./BaseChannel";
import type { BaseVODChapter } from "./BaseVODChapter";
import { BaseVODSegment } from "./BaseVODSegment";

export class BaseVOD {
    public provider: Providers = "base";

    public loaded = false;

    public uuid = "";
    public capture_id = "";
    public filename = "";
    public basename = "";
    public directory = "";

    public json?: VODJSON;

    /**
     * Date for when the VOD was created
     */
    public created_at?: Date;

    /**
     * Date for when the stream was started on the provider's end.
     */
    public started_at?: Date;
    public ended_at?: Date;
    public saved_at?: Date;

    /**
     * Date for when the capture process was launched
     */
    public capture_started?: Date;

    /**
     * Date for when the capture file was output
     */
    public capture_started2?: Date;
    public conversion_started?: Date;

    /** @deprecated */
    public video_metadata: VideoMetadata | AudioMetadata | undefined;

    public force_record = false;

    // public duration = 0;
    public total_size = 0;

    /**
     * Indicates whether the VOD has just been created and not yet captured.
     * It will not save to JSON.
     */
    public created = false;
    public not_started = false;

    public is_capturing = false;
    public is_converting = false;

    /**
     * This is set when the VOD is done capturing and converting, no more automatic changes will be made to it.
     */
    public is_finalized = false;

    public stream_number?: number;
    public stream_absolute_season?: number;
    public stream_absolute_number?: number;

    public external_vod_id?: string;
    public external_vod_title?: string;
    public external_vod_duration?: number;
    public external_vod_exists?: boolean;
    public external_vod_date?: Date;

    public comment?: string;

    public prevent_deletion = false;

    public failed = false;

    public chapters_raw: BaseVODChapterJSON[] = [];

    public chapters: Array<BaseVODChapter> = [];

    public path_chat = "";
    public path_downloaded_vod = "";
    public path_losslesscut = "";
    public path_chatrender = "";
    public path_chatmask = "";
    public path_chatburn = "";
    public path_chatdump = "";
    // path_adbreak = "";
    public path_playlist = "";
    public path_ffmpegchapters = "";
    public path_vttchapters = "";
    public path_kodinfo = "";

    public stream_resolution: VideoQuality | undefined;
    public stream_title = "";

    public cloud_storage = false;

    /**
     * An array of strings containing the file paths of the segments.
     */
    public segments_raw: string[] = [];
    public segments: BaseVODSegment[] = [];

    public channel_uuid?: string;

    public webpath = "";

    public fileWatcher?: chokidar.FSWatcher;
    public _writeJSON = false;
    public _updateTimer: NodeJS.Timeout | undefined;

    public capturingFilename?: string;

    public exportData: ExportData = {};

    public viewers: VodViewerEntry[] = [];

    public stream_pauses: StreamPause[] = [];

    public bookmarks: Array<VODBookmark> = [];

    public is_capture_paused = false; // no longer a file, just a flag

    public issueFixCount = 0;
    public issueFixes: Record<string, boolean> = {};

    public get associatedFiles(): string[] {
        if (!this.directory) return [];

        const base = [
            /** Base JSON file */
            `${this.basename}.json`,

            /** unknown **/
            `${this.basename}.chat`,

            /** Downloaded chat */
            `${this.basename}_chat.json`,

            /** Downloaded VOD */
            `${this.basename}_vod.mp4`,

            /** LosslessCut file */
            `${this.basename}-llc-edl.csv`,

            /** Chat render */
            `${this.basename}_chat.mp4`,

            /** Chat render mask */
            `${this.basename}_chat_mask.mp4`,

            /** Burned chat */
            `${this.basename}_burned.mp4`,

            /** Live chat dump */
            `${this.basename}.chatdump`,

            /** in-progress chat dump */
            `${this.basename}.chatdump.txt`,

            /** in-progress chat dump */
            `${this.basename}.chatdump.line`,

            /** in-progress playlist file */
            `${this.basename}.m3u8`,

            /** Ad break file */
            `${this.basename}.adbreak`,

            /** FFmpeg chapters */
            `${this.basename}-ffmpeg-chapters.txt`,

            /** VTT chapters */
            `${this.basename}.chapters.vtt`,

            /** Kodi info */
            `${this.basename}.nfo`,

            /** Contact sheet */
            `${this.basename}-contact_sheet.png`,
        ];

        if (this.segments_raw) {
            // for (const seg of this.segments_raw) {
            //     base.push(path.basename(seg));
            // }
            base.push(...this.segments_raw.map((seg) => path.basename(seg)));
        }

        return base.filter((f) =>
            fs.existsSync(this.realpath(path.join(this.directory || "", f)))
        );
    }

    public get is_chat_downloaded(): boolean {
        return this.path_chat !== "" && fs.existsSync(this.path_chat);
    }

    public get is_vod_downloaded(): boolean {
        return (
            this.path_downloaded_vod !== "" &&
            fs.existsSync(this.path_downloaded_vod)
        );
    }

    public get is_lossless_cut_generated(): boolean {
        return (
            this.path_losslesscut !== "" && fs.existsSync(this.path_losslesscut)
        );
    }

    public get is_chatdump_captured(): boolean {
        return this.path_chatdump !== "" && fs.existsSync(this.path_chatdump);
    }

    public get is_chat_rendered(): boolean {
        return (
            this.path_chatrender !== "" && fs.existsSync(this.path_chatrender)
        );
    }

    public get is_chat_burned(): boolean {
        return this.path_chatburn !== "" && fs.existsSync(this.path_chatburn);
    }

    /**
     * Is ts filed converted?
     * GETTER
     */
    public get is_converted(): boolean {
        if (!this.directory) return false;
        if (!this.segments || this.segments.length == 0) return false;
        if (this.is_converting) return false;
        return this.segments.some(
            (segment) =>
                segment.filename &&
                fs.existsSync(segment.filename) &&
                fs.statSync(segment.filename).size > 0
        );
    }

    /**
     * Stream season
     * GETTER
     */
    public get stream_season(): string | undefined {
        if (!this.started_at) return undefined;
        return format(this.started_at, Config.SeasonFormat);
    }

    // getter for game_name
    public get game_name(): string {
        return ""; // base vod does not have game_name
    }

    public get game_id(): string {
        return ""; // base vod does not have game_id
    }

    public get duration(): number | undefined {
        // default to first segment
        if (this.firstSegment && this.firstSegment.metadata) {
            return this.firstSegment.metadata.duration;
        }

        // legacy
        if (!this.video_metadata) return undefined;
        return this.video_metadata.duration;
    }

    public get firstSegment(): BaseVODSegment | undefined {
        return this.segments[0];
    }

    /**
     *
     * @param basename
     * @deprecated
     * @returns
     */
    public static hasVod(basename: string): boolean {
        return (
            LiveStreamDVR.getInstance()
                .getVods()
                .findIndex((vod) => vod.basename == basename) != -1
        );
    }

    public static addVod(vod: VODTypes): boolean {
        if (!vod.basename) throw new Error("VOD basename is not set!");

        if (this.hasVod(vod.basename))
            throw new Error(`VOD ${vod.basename} is already in cache!`);

        LiveStreamDVR.getInstance().addVod(vod);

        return this.hasVod(vod.basename);
    }

    /**
     * Set up date related data
     * Requires JSON to be loaded
     */
    public setupDates(): void {
        if (!this.json) {
            throw new Error("No JSON loaded for date setup!");
        }

        if (this.json.created_at)
            this.created_at = parseJSON(this.json.created_at);
        if (this.json.started_at)
            this.started_at = parseJSON(this.json.started_at);

        if (this.json.ended_at) this.ended_at = parseJSON(this.json.ended_at);
        if (this.json.saved_at) this.saved_at = parseJSON(this.json.saved_at);

        if (this.json.capture_started)
            this.capture_started = parseJSON(this.json.capture_started);
        if (this.json.capture_started2)
            this.capture_started2 = parseJSON(this.json.capture_started2);
        if (this.json.conversion_started)
            this.conversion_started = parseJSON(this.json.conversion_started);
    }

    /**
     * @test disable
     * @returns
     */
    public async startWatching(): Promise<boolean> {
        if (this.fileWatcher) await this.stopWatching();

        // no blocks in testing
        // if (process.env.NODE_ENV === "test") return false;

        if (Config.getInstance().cfg("storage.no_watch_files", false)) {
            log(
                LOGLEVEL.DEBUG,
                "vod.watch",
                `Not watching files for ${this.basename} due to config setting`
            );
            return false;
        }

        const files = this.associatedFiles.map((f) =>
            path.join(this.directory, f)
        );

        this.fileWatcher = chokidar
            .watch(files, {
                ignoreInitial: true,
            })
            .on("all", (eventType, filename) => {
                if (LiveStreamDVR.shutting_down) {
                    void this.stopWatching();
                    return;
                }

                if (!this.channel_uuid) {
                    log(
                        LOGLEVEL.ERROR,
                        "vod.watch",
                        `VOD ${this.basename} has no channel UUID!`
                    );
                    return;
                }

                const channel = this.getChannel();
                if (channel) {
                    if (
                        channel.live_chat &&
                        (filename.endsWith(".chatdump.line") ||
                            filename.endsWith(".chatdump.txt"))
                    ) {
                        return;
                    }
                }

                const mem = process.memoryUsage();

                // if (Config.debug) console.log(`VOD file ${filename} changed (${this._writeJSON ? "internal" : "external"}/${eventType})!`);
                log(
                    LOGLEVEL.DEBUG,
                    "vod.watch",
                    `VOD file ${filename} on ${this.basename} changed (${
                        this._writeJSON ? "internal" : "external"
                    }/${eventType})! RSS ${formatBytes(
                        mem.rss
                    )} Heap ${formatBytes(mem.heapUsed)}`
                );

                if (filename === this.filename) {
                    if (!fs.existsSync(this.filename)) {
                        log(
                            LOGLEVEL.WARNING,
                            "vod.watch",
                            `VOD JSON ${this.basename} deleted!`
                        );
                        if (
                            LiveStreamDVR.getInstance()
                                .getVods()
                                .find((v) => v.basename == this.basename)
                        ) {
                            log(
                                LOGLEVEL.WARNING,
                                "vod.watch",
                                `VOD ${this.basename} still in memory!`
                            );

                            // const channel = TwitchChannel.getChannelByLogin(this.streamer_login);
                            // if (channel) channel.removeVod(this.basename);
                        }

                        xTimeout(() => {
                            LiveStreamDVR.getInstance().cleanLingeringVODs();
                        }, 4000);

                        const channel = this.getChannel();
                        if (channel) {
                            xTimeout(() => {
                                if (!channel) return;
                                channel.checkStaleVodsInMemory();
                            }, 5000);
                        }
                    } else {
                        log(
                            LOGLEVEL.DEBUG,
                            "vod.watch",
                            `VOD JSON ${this.basename} exists (again?) ${eventType}`
                        );
                    }
                } else if (this.segments.some((s) => s.filename === filename)) {
                    debugLog(`VOD segment ${filename} changed (${eventType})!`);
                    log(
                        LOGLEVEL.INFO,
                        "vod.watch",
                        `VOD segment ${filename} changed (${eventType})!`
                    );
                    ClientBroker.notify(
                        "Segment changed externally",
                        path.basename(filename),
                        undefined,
                        "system"
                    );
                } else {
                    debugLog(`VOD file ${filename} changed (${eventType})!`);
                    log(
                        LOGLEVEL.INFO,
                        "vod.watch",
                        `VOD file ${filename} changed (${eventType})!`
                    );
                    ClientBroker.notify(
                        "VOD file changed externally",
                        path.basename(filename),
                        undefined,
                        "system"
                    );
                }
            });

        return true;
    }

    public async stopWatching(): Promise<void> {
        if (this.fileWatcher) await this.fileWatcher.close();
        this.fileWatcher = undefined;
        // console.log(`Stopped watching ${this.basename}`);
    }

    public getChannel(): BaseChannel {
        throw new Error("getChannel not implemented");
    }

    public realpath(expanded_path: string): string {
        return path.normalize(expanded_path);
    }

    public postLoad(): void {
        return;
    }

    public async toAPI(): Promise<ApiBaseVod> {
        return await Promise.resolve({
            provider: this.provider,
            uuid: this.uuid,
            channel_uuid: this.channel_uuid || "",
            basename: this.basename || "",

            stream_title: this.stream_title || "",

            capture_id: this.capture_id,

            segments: this.segments.map((s) => s.toAPI()),
            segments_raw: this.segments_raw,

            created_at: this.created_at ? this.created_at.toISOString() : "",
            saved_at: this.saved_at ? this.saved_at.toISOString() : "",
            started_at: this.started_at ? this.started_at.toISOString() : "",
            ended_at: this.ended_at ? this.ended_at.toISOString() : undefined,
            capture_started: this.capture_started
                ? this.capture_started.toISOString()
                : undefined,
            capture_started2: this.capture_started2
                ? this.capture_started2.toISOString()
                : undefined,
            conversion_started: this.conversion_started
                ? this.conversion_started.toISOString()
                : undefined,

            external_vod_id: this.external_vod_id,
            external_vod_duration: this.external_vod_duration,
            external_vod_title: this.external_vod_title,
            external_vod_date: this.external_vod_date
                ? this.external_vod_date.toISOString()
                : undefined,
            external_vod_exists: this.external_vod_exists,

            is_converted: this.is_converted,
            is_capturing: this.is_capturing,
            is_converting: this.is_converting,
            is_finalized: this.is_finalized,

            is_chat_downloaded: this.is_chat_downloaded,
            is_vod_downloaded: this.is_vod_downloaded,
            is_chat_rendered: this.is_chat_rendered,
            is_chat_burned: this.is_chat_burned,
            is_lossless_cut_generated: this.is_lossless_cut_generated,
            is_chatdump_captured: this.is_chatdump_captured,
            is_capture_paused: this.is_capture_paused,

            path_chat: this.path_chat,
            path_downloaded_vod: this.path_downloaded_vod,
            path_losslesscut: this.path_losslesscut,
            path_chatrender: this.path_chatrender,
            path_chatburn: this.path_chatburn,
            path_chatdump: this.path_chatdump,
            path_chatmask: this.path_chatmask,
            // path_adbreak: this.path_adbreak,
            path_playlist: this.path_playlist,

            duration_live: this.getDurationLive(),
            duration: this.duration || 0,

            video_metadata: this.video_metadata,

            total_size: this.total_size,

            webpath: this.webpath,

            stream_number: this.stream_number,
            stream_season: this.stream_season,
            stream_absolute_season: this.stream_absolute_season,
            stream_absolute_number: this.stream_absolute_number,

            comment: this.comment,

            prevent_deletion: this.prevent_deletion,

            failed: this.failed,

            bookmarks: this.bookmarks,

            cloud_storage: this.cloud_storage,

            export_data: this.exportData,

            chapters: this.chapters.map((c) => c.toAPI()),

            viewers: this.viewers.map((v) => {
                return {
                    timestamp: v.timestamp.toISOString(),
                    amount: v.amount,
                };
            }),
            stream_pauses: this.stream_pauses.map((v) => {
                return {
                    start: v.start.toISOString(),
                    end: v.end.toISOString(),
                };
            }),

            api_getDuration: await this.getDuration(true),
            api_getRecordingSize: this.getRecordingSize(),
            api_getDurationLive: this.getDurationLive(),
            api_getConvertingStatus: await this.getConvertingStatus(),
            api_getCapturingStatus: await this.getCapturingStatus(),
        });
    }

    public async toJSON(): Promise<VODJSON> {
        const generated: VODJSON =
            this.json && Object.keys(this.json).length > 0
                ? JSON.parse(JSON.stringify(this.json))
                : {};

        generated.type = this.provider;

        generated.uuid = this.uuid;

        generated.capture_id = this.capture_id;

        generated.stream_resolution = this.stream_resolution ?? undefined;

        if (this.channel_uuid) generated.channel_uuid = this.channel_uuid;

        generated.is_capturing = this.is_capturing;
        generated.is_converting = this.is_converting;
        generated.is_finalized = this.is_finalized;

        generated.duration = this.duration || 0;
        generated.video_metadata = this.video_metadata;
        generated.saved_at = new Date().toISOString();

        if (this.created_at)
            generated.created_at = this.created_at.toISOString();
        if (this.capture_started)
            generated.capture_started = this.capture_started.toISOString();
        if (this.capture_started2)
            generated.capture_started2 = this.capture_started2.toISOString();
        if (this.conversion_started)
            generated.conversion_started =
                this.conversion_started.toISOString();
        if (this.started_at)
            generated.started_at = this.started_at.toISOString();
        if (this.ended_at) generated.ended_at = this.ended_at.toISOString();

        generated.not_started = this.not_started;

        generated.stream_number = this.stream_number;
        generated.stream_season = this.stream_season;
        generated.stream_absolute_season = this.stream_absolute_season;
        generated.stream_absolute_number = this.stream_absolute_number;

        generated.comment = this.comment;
        generated.prevent_deletion = this.prevent_deletion;
        generated.failed = this.failed;
        generated.bookmarks = this.bookmarks;
        generated.cloud_storage = this.cloud_storage;
        generated.export_data = this.exportData;

        generated.viewers = this.viewers.map((viewer) => ({
            timestamp: viewer.timestamp.toJSON(),
            amount: viewer.amount,
        }));

        generated.stream_pauses = this.stream_pauses.flatMap((pause) => {
            return pause.start && pause.end
                ? [{ start: pause.start.toJSON(), end: pause.end.toJSON() }]
                : [];
        });

        generated.external_vod_exists = this.external_vod_exists;
        generated.external_vod_id = this.external_vod_id;
        generated.external_vod_duration = this.external_vod_duration;
        generated.external_vod_title = this.external_vod_title;
        generated.external_vod_date = this.external_vod_date?.toISOString();

        return await Promise.resolve(generated);
    }

    public async saveJSON(reason = ""): Promise<boolean> {
        if (this.json) {
            fs.writeFileSync(
                path.join(
                    BaseConfigDataFolder.backup,
                    `${this.uuid}-${Date.now()}-${reason}.json`
                ),
                JSON.stringify(this.json, null, 4)
            );
        }
        return await Promise.resolve(true);
    }

    public async migrate(): Promise<boolean> {
        let migrated = false;
        if (
            this.firstSegment &&
            !this.firstSegment.metadata &&
            this.video_metadata
        ) {
            this.firstSegment.metadata = this.video_metadata;
            migrated = true;
        }
        return await Promise.resolve(migrated);
    }

    /**
     * Add segment
     * TODO basename or full path?
     * @param segment
     */
    public async addSegment(segment: string): Promise<void> {
        log(
            LOGLEVEL.INFO,
            "vod.addSegment",
            `Adding segment ${segment} to ${this.basename}`
        );

        if (this.segments && this.segments.length > 1) {
            log(
                LOGLEVEL.WARNING,
                "vod.addSegment",
                `VOD ${this.basename} already has segments, adding ${segment}`
            );
        }

        this.segments_raw.push(segment);
        await this.parseSegments(this.segments_raw);
    }

    public async parseSegments(array: string[]): Promise<false | undefined> {
        if (!this.directory) {
            throw new Error("TwitchVOD.parseSegments: directory is not set");
        }

        if (!array) {
            log(
                LOGLEVEL.ERROR,
                "vod.parseSegments",
                `No segment data supplied on ${this.basename}`
            );

            if (!this.segments_raw) {
                log(
                    LOGLEVEL.ERROR,
                    "vod.parseSegments",
                    `No segment_raw data on ${this.basename}, calling rebuild...`
                );
                await this.rebuildSegmentList();
            }

            return false;
        }

        this.total_size = 0;

        const segments: BaseVODSegment[] = [];

        for (const rawSegment of array) {
            if (typeof rawSegment !== "string") {
                log(
                    LOGLEVEL.ERROR,
                    "vod.parseSegments",
                    `Segment list containing invalid data for ${this.basename}, rebuilding...`
                );
                await this.rebuildSegmentList();
                return;
            }

            const baseSegment = path.basename(rawSegment);

            // find invalid characters for windows
            if (baseSegment.match(LiveStreamDVR.filenameIllegalChars)) {
                log(
                    LOGLEVEL.ERROR,
                    "vod.parseSegments",
                    `Segment list containing invalid characters for ${this.basename}: ${baseSegment}`
                );
                return false;
            }

            const segment = new BaseVODSegment();

            // segment.filename = realpath($this.directory . DIRECTORY_SEPARATOR . basename($v));
            // segment.basename = basename($v);
            segment.filename = path.join(
                this.directory,
                path.basename(baseSegment)
            );
            segment.basename = path.basename(baseSegment);
            segment.directory = this.directory;

            if (
                segment.filename &&
                fs.existsSync(segment.filename) &&
                fs.statSync(segment.filename).size > 0
            ) {
                segment.filesize = fs.statSync(segment.filename).size;
                this.total_size += segment.filesize;
                // console.debug(this.basename, segment.basename, segment.filesize);
            } else {
                segment.deleted = true;
            }

            segments.push(segment);
        }

        this.segments = segments;
    }

    public getStartOffset(): number | false {
        return 0;
    }

    public async renderChat(
        chat_width: number,
        chat_height: number,
        font: string,
        font_size: number,
        use_downloaded: boolean,
        overwrite: boolean
    ): Promise<boolean> {
        if (use_downloaded && !this.is_chat_downloaded) {
            console.error(chalk.redBright("No chat downloaded"));
            throw new Error(
                "Use downloaded chat selected but no chat was downloaded"
            );
        } else if (!use_downloaded && !this.is_chatdump_captured) {
            console.error(chalk.redBright("No chat dumped"));
            throw new Error(
                "Use captured chat selected but no chat was captured"
            );
        }

        const segment = this.firstSegment;

        const videoMetadata = segment?.metadata || this.video_metadata;

        if (!videoMetadata) {
            console.error(chalk.redBright("No video metadata"));
            throw new Error("No video metadata");
        }

        if (!("height" in videoMetadata)) {
            console.error(chalk.redBright("No video metadata height"));
            throw new Error("No video metadata height");
        }

        log(
            LOGLEVEL.INFO,
            "vod.renderChat",
            `Render chat for ${this.basename}`
        );

        if (
            fs.existsSync(this.path_chat) &&
            fs.existsSync(this.path_chatrender) &&
            !overwrite
        ) {
            console.error(chalk.redBright("Chat already rendered"));
            throw new Error("Chat already rendered");
        }

        const bin = Helper.path_twitchdownloader();
        const ffmpegBin = Helper.path_ffmpeg();
        const args: string[] = [];

        if (!bin || !fs.existsSync(bin)) {
            console.error(chalk.redBright("TwitchDownloaderCLI not installed"));
            throw new Error("TwitchDownloaderCLI not installed");
        }

        if (!ffmpegBin || !fs.existsSync(ffmpegBin)) {
            console.error(chalk.redBright("FFmpeg not installed"));
            throw new Error("FFmpeg not installed");
        }

        args.push("chatrender");
        args.push("--temp-path", BaseConfigCacheFolder.cache);
        args.push("--ffmpeg-path", ffmpegBin);
        args.push(
            "--input",
            path.normalize(use_downloaded ? this.path_chat : this.path_chatdump)
        );
        args.push(
            "--chat-height",
            (chat_height ? chat_height : videoMetadata.height).toString()
        );
        args.push("--chat-width", chat_width.toString());
        args.push("--framerate", Math.round(videoMetadata.fps).toString());
        args.push("--update-rate", "0");
        args.push("--font", font);
        args.push("--font-size", font_size.toString());
        args.push("--outline");
        args.push("--background-color", "#00000000"); // alpha
        args.push("--generate-mask");
        args.push("--output", this.path_chatrender);

        log(
            LOGLEVEL.INFO,
            "vod.renderChat",
            `Running ${bin} ${args.join(" ")}`
        );

        const env = {
            DOTNET_BUNDLE_EXTRACT_BASE_DIR: BaseConfigCacheFolder.dotnet,
            TEMP: BaseConfigCacheFolder.cache,
        };

        /*
        return new Promise((resolve, reject) => {
            this.stopWatching();

            const job = startJob(`tdrender_${this.basename}`, bin, args, env);

            if (!job) {
                console.error(chalk.redBright("Couldn't start job"));
                this.startWatching();
                reject(new Error("Couldn't start job"));
                throw new Error("Could not start job");
            }

            job.on("stdout", (stdData: string) => {
                if (stdData.includes("Fetching ")) {
                    log(
                        LOGLEVEL.INFO,
                        "vod.renderChat",
                        `Chat render fetching: ${stdData}`
                    );
                } else if (stdData.includes("Rendering Comments")) {
                    log(
                        LOGLEVEL.INFO,
                        "vod.renderChat",
                        "Comments now rendering!"
                    );
                } else if (stdData.trim() == "[STATUS] - Rendering Video 0%") {
                    log(
                        LOGLEVEL.INFO,
                        "vod.renderChat",
                        "Chat history now rendering!"
                    );
                } else if (stdData.includes("FINISHED")) {
                    log(
                        LOGLEVEL.INFO,
                        "vod.renderChat",
                        "Chat render finished!"
                    );
                }
            });

            job.on("close", (code) => {
                this.startWatching();

                if (
                    job.stdout
                        .join("")
                        .includes("Option 'temp-path' is unknown")
                ) {
                    console.error(
                        chalk.redBright(
                            "The version of TwitchDownloaderCLI  is too old. Please update to the latest version."
                        )
                    );
                    reject(
                        new Error(
                            "The version of TwitchDownloaderCLI is too old. Please update to the latest version."
                        )
                    );
                    return;
                }

                if (
                    fs.existsSync(this.path_chatrender) &&
                    fs.statSync(this.path_chatrender).size > 0
                ) {
                    log(
                        LOGLEVEL.INFO,
                        "vod.renderChat",
                        `Chat rendered for ${this.basename} (code ${code})`
                    );
                    resolve(true);
                } else {
                    log(
                        LOGLEVEL.ERROR,
                        "vod.renderChat",
                        `Chat couldn't be rendered for ${this.basename} (code ${code})`
                    );
                    reject(new Error("Chat couldn't be rendered"));
                    // reject(false);
                }
            });
        });
        */

        const job = await exec(
            bin,
            args,
            env,
            `tdrender_${this.basename}`,
            undefined,
            (text) => {
                const m = text.match(/Video:\s(\d+)%/i);
                if (m && m[1]) {
                    return parseInt(m[1]) / 100;
                }
            }
        );

        if (!job) {
            console.error(chalk.redBright("Couldn't start job"));
            throw new Error("Could not start job");
        }

        if (
            fs.existsSync(this.path_chatrender) &&
            fs.statSync(this.path_chatrender).size > 0
        ) {
            log(
                LOGLEVEL.INFO,
                "vod.renderChat",
                `Chat rendered for ${this.basename}`
            );
            return true;
        }

        log(
            LOGLEVEL.ERROR,
            "vod.renderChat",
            `Chat couldn't be rendered for ${this.basename}, no file generated`
        );

        throw new Error("Chat couldn't be rendered, no file generated");
    }

    // TODO: add hardware acceleration
    public async burnChat(
        burn_horizontal = "left",
        burn_vertical = "top",
        ffmpeg_preset = "slow",
        ffmpeg_crf = 26,
        use_vod = false,
        overwrite = false,
        startOffset = 0,
        test_duration = false
    ): Promise<boolean> {
        log(LOGLEVEL.INFO, "vod.burnChat", `Burn chat for ${this.basename}`);

        if (
            this.path_chatburn &&
            fs.existsSync(this.path_chatburn) &&
            !overwrite
        ) {
            log(
                LOGLEVEL.INFO,
                "vod.burnChat",
                `Chat already burned for ${this.basename}`
            );
            throw new Error(`Chat already burned for ${this.basename}`);
        }

        let videoFilename = "";

        if (use_vod) {
            if (!this.is_vod_downloaded) {
                throw new Error(`VOD not downloaded for ${this.basename}`);
            }
            videoFilename = this.path_downloaded_vod;
        } else if (
            this.segments &&
            this.segments.length > 0 &&
            this.segments[0].filename
        ) {
            videoFilename = this.segments[0].filename;
        } else {
            throw new Error(`No segments available for ${this.basename}`);
        }

        if (!videoFilename) {
            throw new Error(`No video file for ${this.basename}`);
        }

        if (!this.path_chatrender || !fs.existsSync(this.path_chatrender)) {
            throw new Error(`Chat render not found for ${this.basename}`);
        }

        if (!this.path_chatmask || !fs.existsSync(this.path_chatmask)) {
            throw new Error(`Chat mask not found for ${this.basename}`);
        }

        const bin = Helper.path_ffmpeg();
        const args: string[] = [];

        if (!bin) {
            throw new Error("ffmpeg not found");
        }

        // const startOffset = this.getStartOffset();

        // chat render offset
        if (startOffset) {
            args.push("-ss", startOffset.toString());
            log(
                LOGLEVEL.INFO,
                "vod.burnChat",
                `Using start offset for chat: ${startOffset}`
            );
        }

        // chat render
        args.push("-i", this.path_chatrender);

        // chat mask offset
        if (startOffset) {
            args.push("-ss", startOffset.toString());
            log(
                LOGLEVEL.INFO,
                "vod.burnChat",
                `Using start offset for chat mask: ${startOffset}`
            );
        }

        if (test_duration) {
            args.push("-t", ffmpeg_time(60 * 1000));
        }

        // chat mask
        args.push("-i", this.path_chatmask);

        // vod
        args.push("-i", videoFilename);

        // alpha mask
        // https://ffmpeg.org/ffmpeg-filters.html#overlay-1
        // https://stackoverflow.com/questions/50338129/use-ffmpeg-to-overlay-a-video-on-top-of-another-using-an-alpha-channel
        const posX = burn_horizontal == "left" ? 0 : "main_w-overlay_w";
        const posY = burn_vertical == "top" ? 0 : "main_h-overlay_h";
        args.push(
            "-filter_complex",
            `[0][1]alphamerge[ia];[2][ia]overlay=${posX}:${posY}`
        );

        // copy audio stream
        args.push("-c:a", "copy");

        // h264 codec
        args.push("-c:v", "libx264");

        // preset
        args.push("-preset", ffmpeg_preset);

        // crf
        args.push("-crf", ffmpeg_crf.toString());

        // overwrite
        args.push("-y");

        // output
        args.push(this.path_chatburn);

        /*
        return new Promise((resolve, reject) => {
            this.stopWatching();

            const job = startJob(`burnchat_${this.basename}`, bin, args);
            if (!job) throw new Error("Job failed");

            job.on("close", (code) => {
                this.startWatching();

                if (
                    fs.existsSync(this.path_chatburn) &&
                    fs.statSync(this.path_chatburn).size > 0
                ) {
                    log(
                        LOGLEVEL.INFO,
                        "vod.burnChat",
                        `Chat burned for ${this.basename} (code ${code})`
                    );
                    resolve(true);
                } else {
                    log(
                        LOGLEVEL.ERROR,
                        "vod.burnChat",
                        `Chat couldn't be burned for ${this.basename} (code ${code})`
                    );
                    reject(false);
                }
            });
        });
        */

        let currentSeconds = 0;
        let totalSeconds = 0;

        const job = await exec(
            bin,
            args,
            {},
            `tdburn_${this.basename}`,
            undefined,
            (text) => {
                const totalDurationMatch = text.match(
                    /Duration: (\d+):(\d+):(\d+)/
                );
                if (totalDurationMatch && !totalSeconds) {
                    totalSeconds =
                        parseInt(totalDurationMatch[1]) * 3600 +
                        parseInt(totalDurationMatch[2]) * 60 +
                        parseInt(totalDurationMatch[3]);
                }
                const currentTimeMatch = text.match(/time=(\d+):(\d+):(\d+)/);
                if (currentTimeMatch && totalSeconds > 0) {
                    currentSeconds =
                        parseInt(currentTimeMatch[1]) * 3600 +
                        parseInt(currentTimeMatch[2]) * 60 +
                        parseInt(currentTimeMatch[3]);
                    return currentSeconds / totalSeconds;
                }
            }
        );

        if (!job) {
            throw new Error("Burn chat job failed");
        }

        if (
            fs.existsSync(this.path_chatburn) &&
            fs.statSync(this.path_chatburn).size > 0
        ) {
            log(
                LOGLEVEL.INFO,
                "vod.burnChat",
                `Chat burned for ${this.basename}`
            );
            return true;
        }

        log(
            LOGLEVEL.ERROR,
            "vod.burnChat",
            `Chat couldn't be burned for ${this.basename}, no file generated`
        );

        throw new Error("Chat couldn't be burned, no file generated");
    }

    /**
     * @test disable
     * @returns
     */
    public broadcastUpdate(): void {
        // if (process.env.NODE_ENV === "test") return;
        if (this._updateTimer) {
            xClearTimeout(this._updateTimer);
            this._updateTimer = undefined;
        }
        this._updateTimer = xTimeout(async () => {
            const vod = await this.toAPI();
            Webhook.dispatchAll("vod_updated", {
                vod: vod,
            } as VodUpdated);
            this._updateTimer = undefined;
        }, 3000);
    }

    /**
     * Finalize the video. Does **NOT** save.
     * TODO save?
     * @returns
     */
    public async finalize(): Promise<boolean> {
        log(
            LOGLEVEL.INFO,
            "vod.finalize",
            `Finalize ${this.basename} @ ${this.directory}`
        );

        if (this.path_playlist && fs.existsSync(this.path_playlist)) {
            fs.unlinkSync(this.path_playlist);
        }

        // generate mediainfo, like duration, size, resolution, etc
        try {
            await this.getMediainfo();
        } catch (error) {
            log(
                LOGLEVEL.ERROR,
                "vod.finalize",
                `Failed to get mediainfo for ${this.basename}: ${
                    (error as Error).message
                }`
            );
            console.error(error);
        }

        // generate chapter related files
        try {
            await this.saveLosslessCut();
        } catch (error) {
            log(
                LOGLEVEL.ERROR,
                "vod.finalize",
                `Failed to save lossless cut for ${this.basename}: ${
                    (error as Error).message
                }`
            );
            console.error(error);
        }

        try {
            await this.saveFFMPEGChapters();
        } catch (error) {
            log(
                LOGLEVEL.ERROR,
                "vod.finalize",
                `Failed to save ffmpeg chapters for ${this.basename}: ${
                    (error as Error).message
                }`
            );
            console.error(error);
        }

        try {
            await this.saveVTTChapters();
        } catch (error) {
            log(
                LOGLEVEL.ERROR,
                "vod.finalize",
                `Failed to save vtt chapters for ${this.basename}: ${
                    (error as Error).message
                }`
            );
            console.error(error);
        }

        try {
            await this.saveKodiNfo();
        } catch (error) {
            log(
                LOGLEVEL.ERROR,
                "vod.finalize",
                `Failed to save kodi nfo for ${this.basename}: ${
                    (error as Error).message
                }`
            );
            console.error(error);
        }

        // generate contact sheet
        if (Config.getInstance().cfg("contact_sheet.enable")) {
            await this.createVideoContactSheet();
        }

        // calculate chapter durations and offsets
        this.calculateChapters();

        await LiveStreamDVR.getInstance().updateFreeStorageDiskSpace();

        return true;
    }

    /**
     * Get duration from the start of the broadcast
     * @returns
     */
    public getDurationLive(): number | false {
        // if (!$this->dt_started_at) return false;
        // $now = new \DateTime();
        // return abs($this->dt_started_at->getTimestamp() - $now->getTimestamp());
        if (!this.started_at) return false;
        const now = new Date();
        return Math.abs((this.started_at.getTime() - now.getTime()) / 1000);
    }

    /**
     * Remove short chapters and change duration of chapters to match the duration of the VOD.
     * @returns
     */
    public async removeShortChapters(): Promise<void> {
        if (!this.chapters || this.chapters.length == 0) return;

        const minDuration = Config.getInstance().cfg("min_chapter_duration", 0);

        if (minDuration <= 0) return;

        const longChapters = this.chapters.filter((chapter) => {
            if (chapter.duration && chapter.duration > minDuration) {
                log(
                    LOGLEVEL.INFO,
                    "vod.removeShortChapters",
                    `Keeping chapter ${chapter.title} with duration ${chapter.duration} on ${this.basename}`
                );
                return true;
            } else if (chapter.duration === undefined) {
                log(
                    LOGLEVEL.ERROR,
                    "vod.removeShortChapters",
                    `Chapter ${chapter.title} has undefined duration on ${this.basename}`
                );
                return true;
            } else {
                log(
                    LOGLEVEL.INFO,
                    "vod.removeShortChapters",
                    `Removing chapter ${chapter.title} with duration ${chapter.duration} on ${this.basename}`
                );
                return false;
            }
        });

        console.debug(
            `Removed ${
                this.chapters.length - longChapters.length
            } chapters on ${this.basename}`
        );

        this.chapters = longChapters;

        this.calculateChapters();

        await this.saveJSON("remove short chapters");
    }

    /**
     * Calculate offset and duration of chapters, based on the start and end time of the VOD.
     * Call this after adding new chapters and as often as possible.
     *
     * @returns
     */
    public calculateChapters(): boolean {
        if (!this.started_at) {
            log(
                LOGLEVEL.ERROR,
                "vod.calculateChapters",
                `No start time found for ${this.basename}, can't calculate chapters`
            );
            return false;
        }

        if (!this.chapters || this.chapters.length == 0) {
            log(
                LOGLEVEL.ERROR,
                "vod.calculateChapters",
                `No chapters found for ${this.basename}, can't calculate chapters`
            );
            return false;
        }

        // console.debug(`Calculating chapters for ${this.basename}, ${this.chapters.length} chapters`);

        this.chapters.forEach((chapter, index) => {
            if (!this.started_at) return; // thanks scoping

            if (!chapter.vod_uuid) chapter.vod_uuid = this.uuid;

            const nextChapter = this.chapters[index + 1];

            chapter.calculateDurationAndOffset(
                this.started_at,
                this.ended_at,
                nextChapter ? nextChapter.started_at : undefined
            );
        });

        return true;
    }

    /**
     * Save chapter data in ffmpeg format for use in remuxing.
     * @see {@link https://ikyle.me/blog/2020/add-mp4-chapters-ffmpeg}
     * @returns Save success
     */
    public async saveFFMPEGChapters(): Promise<boolean> {
        if (!this.directory) {
            throw new Error(
                "TwitchVOD.saveFFMPEGChapters: directory is not set"
            );
        }

        if (!this.chapters || this.chapters.length == 0) {
            // throw new Error('TwitchVOD.saveFFMPEGChapters: chapters are not set');
            return false;
        }

        log(
            LOGLEVEL.INFO,
            "vod.saveFFMPEGChapters",
            `Saving FFMPEG chapters file for ${this.basename} to ${this.path_ffmpegchapters}`
        );

        const meta = new FFmpegMetadata().setArtist(
            this.getChannel().displayName
        );

        // if (isTwitchVOD(this)) {
        meta.setTitle(this.external_vod_title ?? this.chapters[0].title);
        // }

        if (this.started_at) meta.setDate(this.started_at);

        const titleConfig = Config.getInstance().cfg("video.chapters.title");

        this.chapters.forEach((chapter) => {
            const offset = chapter.offset || 0;
            const duration = chapter.duration || 0;
            const start = Math.floor(offset * 1000);
            const end = Math.floor((offset + duration) * 1000);
            // const title = isTwitchVODChapter(chapter)
            //     ? `${chapter.title} (${chapter.game_name})`
            //     : chapter.title;
            let title = chapter.title;
            if (
                titleConfig == "title_and_game" &&
                isTwitchVODChapter(chapter)
            ) {
                title = `${chapter.title} (${chapter.game_name})`;
            } else if (titleConfig == "game" && isTwitchVODChapter(chapter)) {
                title = `${chapter.game_name ?? chapter.title}`;
            }

            try {
                meta.addChapter(start, end, title, "1/1000", [
                    isTwitchVODChapter(chapter)
                        ? `Game ID: ${chapter.game_id}`
                        : "",
                    isTwitchVODChapter(chapter)
                        ? `Game Name: ${chapter.game_name}`
                        : "",
                    `Title: ${chapter.title}`,
                    `Offset: ${offset}`,
                    `Duration: ${duration}`,
                    isTwitchVODChapter(chapter)
                        ? `Viewer count: ${chapter.viewer_count}`
                        : "",
                    `Started at: ${chapter.started_at.toISOString()}`,
                ]);
            } catch (error) {
                log(
                    LOGLEVEL.ERROR,
                    "vod.saveFFMPEGChapters",
                    `Error while adding chapter ${
                        chapter.title
                    } to FFMPEG chapters file for ${this.basename}: ${
                        (error as Error).message
                    }`
                );
            }
        });

        await this.stopWatching();

        fs.writeFileSync(this.path_ffmpegchapters, meta.getString(), {
            encoding: "utf8",
        });

        this.setPermissions();

        await this.startWatching();

        return fs.existsSync(this.path_ffmpegchapters);
    }

    public reencodeSegments(
        addToSegments = false,
        deleteOriginal = false
    ): Promise<boolean> {
        log(
            LOGLEVEL.INFO,
            "vod.reencodeSegments",
            `Reencoding segments of ${this.filename}`
        );

        const tasks = [];

        if (!this.segments) throw new Error("No segments");

        const ffmpegPath = Helper.path_ffmpeg();

        if (!ffmpegPath) {
            throw new Error("Failed to find ffmpeg");
        }

        for (const segment of this.segments) {
            tasks.push(
                new Promise((resolve, reject) => {
                    if (!segment.basename) {
                        reject(new Error("No filename"));
                        return;
                    }
                    const fileInPath = path.join(
                        this.directory,
                        segment.basename
                    );
                    if (!fs.existsSync(fileInPath)) {
                        reject(new Error(`File not found: ${fileInPath}`));
                        return;
                    }
                    const fileOutPath = path.join(
                        this.directory,
                        `${segment.basename}_enc.mp4`
                    );
                    if (fs.existsSync(fileOutPath)) {
                        reject(
                            new Error(`File ${fileOutPath} already exists!`)
                        );
                        return;
                    }

                    const args = [];
                    if (Config.getInstance().cfg<string>("reencoder.hwaccel")) {
                        // args.push("-hwaccel", Config.getInstance().cfg<string>("reencoder.hwaccel"));
                        args.push("-i", fileInPath);
                        args.push(
                            "-c:v",
                            Config.getInstance().cfg<string>(
                                "reencoder.video_codec"
                            )
                        );
                        args.push("-c:a", "copy");
                        args.push(
                            "-preset",
                            Config.getInstance().cfg<string>("reencoder.preset")
                        );
                        args.push(
                            "-tune",
                            Config.getInstance().cfg<string>("reencoder.tune")
                        );
                    } else {
                        args.push("-i", fileInPath);
                        args.push(
                            "-c:v",
                            Config.getInstance().cfg<string>(
                                "reencoder.video_codec"
                            )
                        );
                        args.push("-c:a", "copy"); // no need to reencode audio
                        args.push(
                            "-preset",
                            Config.getInstance().cfg<string>("reencoder.preset")
                        );
                        args.push(
                            "-crf",
                            Config.getInstance().cfg<string>("reencoder.crf")
                        );
                    }
                    args.push("-movflags", "+faststart");
                    if (
                        Config.getInstance().cfg<number>("reencoder.resolution")
                    ) {
                        args.push(
                            "-vf",
                            `scale=-1:${Config.getInstance().cfg<number>(
                                "reencoder.resolution"
                            )}`
                        );
                    }
                    // args.push("-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2"); // scale to nearest multiple of 2
                    args.push(fileOutPath);

                    const job = startJob(
                        `reencode_${path.basename(fileInPath)}`,
                        ffmpegPath,
                        args
                    );

                    if (!job || !job.process) {
                        reject(new Error("Failed to start ffmpeg"));
                        return;
                    }

                    let currentSeconds = 0;
                    let totalSeconds = 0;
                    job.on("log", (stream: string, data: string) => {
                        const totalDurationMatch = data.match(
                            /Duration: (\d+):(\d+):(\d+)/
                        );
                        const fpsMatch = data.match(/fps=(\d+)/);
                        if (totalDurationMatch && !totalSeconds) {
                            totalSeconds =
                                parseInt(totalDurationMatch[1]) * 3600 +
                                parseInt(totalDurationMatch[2]) * 60 +
                                parseInt(totalDurationMatch[3]);
                            console.debug(
                                `Remux total duration: ${totalSeconds}`
                            );
                        }
                        const currentTimeMatch = data.match(
                            /time=(\d+):(\d+):(\d+)/
                        );
                        if (currentTimeMatch && totalSeconds > 0) {
                            currentSeconds =
                                parseInt(currentTimeMatch[1]) * 3600 +
                                parseInt(currentTimeMatch[2]) * 60 +
                                parseInt(currentTimeMatch[3]);
                            job.setProgress(currentSeconds / totalSeconds);
                            console.debug(
                                `Remux current time: ${currentSeconds} / ${totalSeconds} (${Math.round(
                                    (currentSeconds / totalSeconds) * 100
                                )}%, ${fpsMatch ? fpsMatch[1] : "?"}fps)`
                            );
                        }
                        if (data.match(/moving the moov atom/)) {
                            console.debug("Remux moov atom move");
                        }
                    });

                    job.process.on("error", (err) => {
                        log(
                            LOGLEVEL.ERROR,
                            "vod.reencodeSegments",
                            `Process ${process.pid} error: ${err.message}`
                        );
                        console.error(err);
                        // reject({ code: -1, success: false, stdout: job.stdout, stderr: job.stderr });
                        reject(
                            new Error(`Process ${process.pid} error: ${err}`)
                        );
                    });

                    job.process.on("close", (code) => {
                        if (job) {
                            job.clear();
                        }
                        // const out_log = ffmpeg.stdout.read();
                        const success =
                            fs.existsSync(fileOutPath) &&
                            fs.statSync(fileOutPath).size > 0;
                        if (success) {
                            log(
                                LOGLEVEL.SUCCESS,
                                "vod.reencodeSegments",
                                `Reencoded ${fileInPath} to ${fileOutPath}`
                            );
                            if (deleteOriginal) {
                                // fs.unlinkSync(file_in_path);
                            }
                            if (addToSegments) {
                                void this.addSegment(
                                    path.basename(fileOutPath)
                                );
                            }
                            resolve(true);
                        } else {
                            log(
                                LOGLEVEL.ERROR,
                                "vod.reencodeSegments",
                                `Failed to reencode ${path.basename(
                                    fileInPath
                                )} to ${path.basename(fileOutPath)}`
                            );
                            // reject({ code, success, stdout: job.stdout, stderr: job.stderr });

                            let message = "Unknown error";
                            const errorSearch = job.stderr
                                .join("")
                                .match(/\[error\] (.*)/g);
                            if (errorSearch && errorSearch.length > 0) {
                                message = errorSearch.slice(1).join(", ");
                            }

                            if (
                                fs.existsSync(fileOutPath) &&
                                fs.statSync(fileOutPath).size == 0
                            ) {
                                fs.unlinkSync(fileOutPath);
                            }

                            // for (const err of errorSearch) {
                            //    message = err[1];
                            reject(
                                new Error(
                                    `Failed to reencode ${path.basename(
                                        fileInPath
                                    )} to ${path.basename(
                                        fileOutPath
                                    )}: ${message}`
                                )
                            );
                        }
                    });

                    // const ffmpeg_command = `ffmpeg -i ${file_in_path} -c:v libx264 -preset veryfast -crf 23 -c:a aac -b:a 128k -strict -2 ${file_out_path}`;
                })
            );
        }

        void this.stopWatching();

        return Promise.all(tasks)
            .then((results) => {
                console.debug("Reencoded", results);
                log(
                    LOGLEVEL.SUCCESS,
                    "vod.reencodeSegments",
                    `Successfully reencoded ${this.basename}`
                );
                return true;
            })
            .catch((err) => {
                console.debug("Reencoded error", err);
                log(
                    LOGLEVEL.ERROR,
                    "vod.reencodeSegments",
                    `Failed to reencode ${this.basename}: ${
                        (err as Error).message
                    }`
                );
                return false;
            })
            .finally(() => {
                void this.startWatching();
            });
    }

    public async setupFiles(): Promise<void> {
        if (!this.directory) {
            throw new Error("No directory set!");
        }

        this.path_chat = this.realpath(
            path.join(this.directory, `${this.basename}_chat.json`)
        );
        this.path_downloaded_vod = this.realpath(
            path.join(this.directory, `${this.basename}_vod.mp4`)
        );
        this.path_losslesscut = this.realpath(
            path.join(this.directory, `${this.basename}-llc-edl.csv`)
        );
        this.path_chatrender = this.realpath(
            path.join(this.directory, `${this.basename}_chat.mp4`)
        );
        this.path_chatmask = this.realpath(
            path.join(this.directory, `${this.basename}_chat_mask.mp4`)
        );
        this.path_chatburn = this.realpath(
            path.join(this.directory, `${this.basename}_burned.mp4`)
        );
        this.path_chatdump = this.realpath(
            path.join(this.directory, `${this.basename}.chatdump`)
        );
        // this.path_adbreak = this.realpath(path.join(this.directory, `${this.basename}.adbreak`));
        this.path_playlist = this.realpath(
            path.join(this.directory, `${this.basename}.m3u8`)
        );
        this.path_ffmpegchapters = this.realpath(
            path.join(this.directory, `${this.basename}-ffmpeg-chapters.txt`)
        );
        this.path_vttchapters = this.realpath(
            path.join(this.directory, `${this.basename}.chapters.vtt`)
        );
        this.path_kodinfo = this.realpath(
            path.join(this.directory, `${this.basename}.nfo`)
        );

        // just to be sure, remake these
        if (this.is_finalized) {
            try {
                if (!fs.existsSync(this.path_losslesscut)) {
                    await this.saveLosslessCut();
                }
                if (!fs.existsSync(this.path_ffmpegchapters)) {
                    await this.saveFFMPEGChapters();
                }
                if (!fs.existsSync(this.path_vttchapters)) {
                    await this.saveVTTChapters();
                }
                if (
                    !fs.existsSync(this.path_kodinfo) &&
                    Config.getInstance().cfg("create_kodi_nfo")
                ) {
                    await this.saveKodiNfo();
                }
            } catch (error) {
                log(
                    LOGLEVEL.ERROR,
                    "vod.setupFiles",
                    `Could not save associated files for ${this.basename}: ${
                        (error as Error).message
                    }`
                );
            }
        }
    }

    public async saveLosslessCut(): Promise<boolean> {
        if (!this.directory) {
            throw new Error("TwitchVOD.saveLosslessCut: directory is not set");
        }

        if (!this.chapters || this.chapters.length == 0) {
            // throw new Error('TwitchVOD.saveLosslessCut: chapters are not set');
            return false;
        }

        // $csv_path = $this->directory . DIRECTORY_SEPARATOR . $this->basename . '-llc-edl.csv';
        const csvPath = path.join(
            this.directory,
            `${this.basename}-llc-edl.csv`
        );

        log(
            LOGLEVEL.INFO,
            "vod.saveLosslessCut",
            `Saving lossless cut csv for ${this.basename} to ${csvPath}`
        );

        let data = "";

        this.chapters.forEach((chapter, i) => {
            let offset = chapter.offset;
            if (offset === undefined) return;

            offset -= this.chapters[0].offset || 0;

            data += offset + ","; // offset

            if (i < this.chapters.length - 1) {
                // not last chapter
                data += offset + (chapter.duration || 0) + ",";
            } else {
                // last chapter
                data += ",";
            }

            data += '"';
            let label = "";

            if (isTwitchVODChapter(chapter)) {
                `${chapter.game_name || chapter.game_id} (${chapter.title})`;
                label = label.replace(/"/g, '\\"');
            } else {
                label = chapter.title;
            }

            data += label;
            data += '"';

            data += "\n";
        });

        await this.stopWatching();

        fs.writeFileSync(csvPath, data);

        this.setPermissions();

        await this.startWatching();

        return fs.existsSync(csvPath);
    }

    public async saveVTTChapters(): Promise<boolean> {
        return await Promise.resolve(false);
    }

    public async saveKodiNfo(): Promise<boolean> {
        return await Promise.resolve(false);
    }

    /**
     * Set up misc data
     * Requires JSON to be loaded
     */
    public async setupAssoc(): Promise<void> {
        if (!this.json) {
            throw new Error("No JSON loaded for assoc setup!");
        }

        this.video_metadata =
            this.json.video_metadata !== undefined
                ? this.json.video_metadata
                : undefined;

        if (this.json.chapters && this.json.chapters.length > 0) {
            await this.parseChapters(this.json.chapters);
        } else {
            log(
                LOGLEVEL.ERROR,
                "vod.setupAssoc",
                `No chapters on ${this.basename}!`
            );
        }

        this.segments_raw =
            this.json.segments !== undefined ? this.json.segments : [];

        if (this.segments_raw && this.segments_raw.length > 0) {
            await this.parseSegments(this.segments_raw);
        }

        if (this.is_finalized) {
            if (!this.duration) {
                log(
                    LOGLEVEL.DEBUG,
                    "vod.setupAssoc",
                    `VOD ${this.basename} finalized but no duration, trying to fix`
                );
                await this.getDuration(true);
            }
        }

        if (
            this.segments.length == 0 &&
            !this.is_finalized &&
            !this.not_started
        ) {
            throw new Error(
                `No segments available for ${this.basename} and VOD is not finalized and started. Completely broken. Edit the JSON file manually.`
            );
        }

        if (
            !this.video_metadata &&
            this.is_finalized &&
            this.segments_raw.length > 0 &&
            Helper.path_mediainfo()
        ) {
            log(
                LOGLEVEL.DEBUG,
                "vod.setupAssoc",
                `VOD ${this.basename} finalized but no metadata, trying to fix`
            );
            if (await this.getMediainfo()) {
                await this.saveJSON("fix mediainfo");
            }
        }

        this.stream_number =
            this.json.stream_number !== undefined
                ? this.json.stream_number
                : undefined;
        this.stream_absolute_season =
            this.json.stream_absolute_season !== undefined
                ? this.json.stream_absolute_season
                : undefined;
        this.stream_absolute_number =
            this.json.stream_absolute_number !== undefined
                ? this.json.stream_absolute_number
                : undefined;
    }

    /** @deprecated */
    public async getDuration(save = false): Promise<number | null> {
        if (this.duration && this.duration > 0) {
            return this.duration;
        }

        const isOldFormat =
            this.video_metadata && "general" in this.video_metadata;

        if (this.video_metadata && isOldFormat) {
            log(
                LOGLEVEL.WARNING,
                "vod.getDuration",
                `VOD ${this.basename} has old video metadata format.`
            );
        }

        if (this.video_metadata && !isOldFormat) {
            if (this.video_metadata.size && this.video_metadata.size == 0) {
                log(
                    LOGLEVEL.ERROR,
                    "vod.getDuration",
                    `Invalid video metadata for ${this.basename}!`
                );
                return null;
            }

            if (this.video_metadata.duration && this.duration) {
                log(
                    LOGLEVEL.DEBUG,
                    "vod.getDuration",
                    `No duration_seconds but metadata exists for ${this.basename}: ${this.video_metadata.duration}`
                );
                // this.duration = this.video_metadata.duration;
                return this.duration;
            }

            log(
                LOGLEVEL.ERROR,
                "vod.getDuration",
                `Video metadata for ${this.basename} does not include duration!`
            );

            return null;
        }

        if (this.is_capturing) {
            log(
                LOGLEVEL.DEBUG,
                "vod.getDuration",
                `Can't request duration because ${this.basename} is still recording!`
            );
            return null;
        }

        if (!this.is_converted || this.is_converting) {
            log(
                LOGLEVEL.DEBUG,
                "vod.getDuration",
                `Can't request duration because ${this.basename} is converting!`
            );
            return null;
        }

        if (!this.is_finalized) {
            log(
                LOGLEVEL.DEBUG,
                "vod.getDuration",
                `Can't request duration because ${this.basename} is not finalized!`
            );
            return null;
        }

        if (!this.segments_raw || this.segments_raw.length == 0) {
            log(
                LOGLEVEL.ERROR,
                "vod.getDuration",
                `No video file available for duration of ${this.basename}`
            );
            return null;
        }

        log(
            LOGLEVEL.DEBUG,
            "vod.getDuration",
            `No mediainfo for getDuration of ${this.basename}`
        );

        const file = await this.getMediainfo();

        if (!file) {
            log(
                LOGLEVEL.ERROR,
                "vod.getDuration",
                `Could not find duration of ${this.basename}`
            );
            return null;
        } else {
            if (!this.duration) {
                throw new Error("Could not find duration");
            }

            if (save) {
                log(
                    LOGLEVEL.SUCCESS,
                    "vod.getDuration",
                    `Saved duration for ${this.basename}`
                );
                await this.saveJSON("duration save");
            }

            log(
                LOGLEVEL.DEBUG,
                "vod.getDuration",
                `Duration fetched for ${this.basename}: ${this.duration}`
            );

            return this.duration;
        }

        log(
            LOGLEVEL.ERROR,
            "vod.getDuration",
            "Reached end of getDuration for {this.basename}, this shouldn't happen!"
        );
    }

    public async getMediainfo(
        segment_num = 0,
        force = false
    ): Promise<false | VideoMetadata | AudioMetadata> {
        log(
            LOGLEVEL.INFO,
            "vod.getMediainfo",
            `Fetching mediainfo of ${this.basename}, segment #${segment_num}`
        );

        if (!this.directory) {
            throw new Error("No directory set!");
        }

        if (!this.segments || this.segments.length == 0) {
            throw new Error("No segments available");
        }

        const segment = this.segments[segment_num];

        if (!segment) {
            throw new Error(
                `Segment #${segment_num} does not exist for ${this.basename}`
            );
        }

        // const filename = path.join(
        //     this.directory,
        //     path.basename(this.segments_raw[segment_num])
        // );

        if (!fs.existsSync(segment.filename)) {
            log(
                LOGLEVEL.ERROR,
                "vod.getMediainfo",
                `File does not exist for mediainfo of ${this.basename} (${segment.filename} @ ${this.directory})`
            );
            return false;
        }

        let metadata: VideoMetadata | AudioMetadata;
        try {
            metadata = await videometadata(segment.filename, force);
        } catch (e) {
            log(
                LOGLEVEL.ERROR,
                "vod.getMediainfo",
                `Could not get video metadata of ${this.basename} (${
                    segment.filename
                } @ ${this.directory}): ${(e as Error).message}`
            );
            return false;
        }

        this.video_metadata = metadata;
        segment.metadata = metadata;

        this.broadcastUpdate();

        return metadata;
    }

    public async parseChapters(
        raw_chapters: BaseVODChapterJSON[]
    ): Promise<boolean> {
        return await Promise.resolve(false);
    }

    public setupUserData(): void {
        return;
    }

    public setupBasic(): void {
        if (!this.json) {
            throw new Error("No JSON loaded for basic setup!");
        }

        this.not_started = this.json.not_started ?? false;

        this.is_capturing = this.json.is_capturing;
        this.is_converting = this.json.is_converting;
        this.is_finalized = this.json.is_finalized;

        // this.duration = this.json.duration ?? undefined;

        this.comment = this.json.comment;
        this.prevent_deletion = this.json.prevent_deletion ?? false;
        this.failed = this.json.failed ?? false;

        this.webpath =
            `${Config.getInstance().cfg<string>("basepath", "")}/vods/` +
            path.relative(BaseConfigDataFolder.vod, this.directory);

        if (this.json.export_data) {
            this.exportData = this.json.export_data;
        }

        if (this.json.viewers) {
            this.viewers = this.json.viewers.map((v) => {
                return { timestamp: parseJSON(v.timestamp), amount: v.amount };
            });
        } else {
            this.viewers = [];
        }

        if (this.json.stream_pauses) {
            this.stream_pauses = this.json.stream_pauses
                // .filter((p) => p.start && p.end)
                .flatMap((v) => {
                    // return {
                    //     start: parseJSON(v.start),
                    //     end: parseJSON(v.end),
                    // };
                    return v.start && v.end
                        ? [
                              {
                                  start: parseJSON(v.start),
                                  end: parseJSON(v.end),
                              },
                          ]
                        : [];
                });
        }

        this.external_vod_id = this.json.external_vod_id;
        this.external_vod_title = this.json.external_vod_title;
        this.external_vod_date = this.json.external_vod_date
            ? parseJSON(this.json.external_vod_date)
            : undefined;
        this.external_vod_duration = this.json.external_vod_duration;
        this.external_vod_exists = this.json.external_vod_exists ?? false;
    }

    public setupProvider(): void {
        return;
    }

    /**
     * Delete VOD from disk and all associated files.
     * Also removes the VOD from the channel database.
     *
     * @returns {Promise<boolean>} True if successful, false if not.
     */
    public async delete(): Promise<boolean> {
        if (!this.directory) {
            throw new Error("No directory set for deletion");
        }

        if (this.prevent_deletion) {
            log(
                LOGLEVEL.INFO,
                "vod.delete",
                `Deletion of ${this.basename} prevented`
            );
            throw new Error("Vod has been marked with prevent_deletion");
        }

        log(
            LOGLEVEL.INFO,
            "vod.delete",
            `Delete ${this.basename}`,
            this.associatedFiles
        );

        await this.stopWatching();

        for (const file of this.associatedFiles) {
            if (fs.existsSync(path.join(this.directory, file))) {
                log(LOGLEVEL.DEBUG, "vod.delete", `Delete ${file}`);
                fs.unlinkSync(path.join(this.directory, file));
            }
        }

        this.deleteEmptyFolder();

        const channel = this.getChannel();
        if (channel) channel.removeVod(this.uuid);

        return fs.existsSync(this.filename);
    }

    public async deleteSegment(
        segmentIndex: number,
        keepEntry = false
    ): Promise<boolean> {
        if (!this.directory) {
            throw new Error("No directory set for deletion");
        }

        if (this.prevent_deletion) {
            log(
                LOGLEVEL.INFO,
                "vod.deleteSegment",
                `Deletion of ${this.basename} segment prevented`
            );
            throw new Error("Vod has been marked with prevent_deletion");
        }

        log(
            LOGLEVEL.INFO,
            "vod.deleteSegment",
            `Delete segment #${segmentIndex} of ${this.basename}`
        );

        if (segmentIndex >= this.segments_raw.length) {
            log(
                LOGLEVEL.ERROR,
                "vod.deleteSegment",
                `Segment #${segmentIndex} does not exist for ${this.basename}`
            );
            throw new Error("Segment does not exist");
        }

        const file = this.segments[segmentIndex];

        await this.stopWatching();

        if (!file.filename) {
            log(
                LOGLEVEL.ERROR,
                "vod.deleteSegment",
                `No filename for segment #${segmentIndex} of ${this.basename}`
            );
            throw new Error("No filename for segment");
        }

        if (fs.existsSync(file.filename)) {
            log(LOGLEVEL.DEBUG, "vod.deleteSegment", `Delete ${file.filename}`);
            fs.unlinkSync(file.filename);
        }

        if (!keepEntry) {
            this.segments.splice(segmentIndex, 1);
            this.segments_raw.splice(segmentIndex, 1);
        } else {
            this.cloud_storage = true;
        }

        await this.saveJSON("delete segment");

        return fs.existsSync(file.filename);
    }

    public async changeBaseName(new_basename: string): Promise<boolean> {
        if (this.basename == new_basename) return false;
        const oldBasename = this.basename;

        log(
            LOGLEVEL.INFO,
            "vodclass.changeBaseName",
            `Changing basename from ${oldBasename} to ${new_basename}`
        );

        await this.stopWatching();

        // copy array so it doesn't change during loop
        const associatedFiles = [...this.associatedFiles];

        for (const file of associatedFiles) {
            if (this.segments_raw.map((s) => path.basename(s)).includes(file)) {
                log(
                    LOGLEVEL.INFO,
                    "vodclass.changeBaseName",
                    `Skip over assoc '${file}' due to it being a segment!`
                );
                continue;
            }
            const filePath = path.join(this.directory, path.basename(file));
            if (fs.existsSync(filePath)) {
                log(
                    LOGLEVEL.INFO,
                    "vodclass.changeBaseName",
                    `Rename assoc '${filePath}' to '${filePath.replaceAll(
                        oldBasename,
                        new_basename
                    )}'`
                );
                fs.renameSync(
                    filePath,
                    filePath.replaceAll(oldBasename, new_basename)
                );
            } else {
                log(
                    LOGLEVEL.WARNING,
                    "vodclass.changeBaseName",
                    `File assoc '${filePath}' not found!`
                );
            }
        }

        const newSegments = [];
        for (const segment of this.segments_raw) {
            const filePath = path.join(this.directory, path.basename(segment));
            if (fs.existsSync(filePath)) {
                log(
                    LOGLEVEL.INFO,
                    "vodclass.changeBaseName",
                    `Rename segment '${filePath}' to '${filePath.replaceAll(
                        oldBasename,
                        new_basename
                    )}'`
                );
                fs.renameSync(
                    filePath,
                    filePath.replaceAll(oldBasename, new_basename)
                );
                newSegments.push(
                    path.basename(
                        filePath.replaceAll(oldBasename, new_basename)
                    )
                );
            } else {
                log(
                    LOGLEVEL.WARNING,
                    "vodclass.changeBaseName",
                    `Segment '${filePath}' not found!`
                );
            }
        }

        this.basename = new_basename;
        this.filename = this.filename.replaceAll(oldBasename, new_basename);
        await this.setupFiles();
        this.segments_raw = newSegments;
        await this.parseSegments(this.segments_raw);
        await this.saveJSON("basename rename");
        // this.rebuildSegmentList();
        await this.startWatching();
        return true;
    }

    public async downloadVod(quality: VideoQuality = "best"): Promise<boolean> {
        return await Promise.resolve(false);
    }

    public async downloadChat(method: "td" | "tcd" = "td"): Promise<boolean> {
        return await Promise.resolve(false);
    }

    public async checkMutedVod(save = false): Promise<MuteStatus> {
        return await Promise.resolve(MuteStatus.UNKNOWN);
    }

    public async matchProviderVod(force = false): Promise<boolean | undefined> {
        return await Promise.resolve(false);
    }

    public addChapter(chapter: BaseVODChapter): void {
        log(
            LOGLEVEL.INFO,
            "vod.addChapter",
            `Adding chapter ${chapter.title} to ${this.basename}`
        );
        this.chapters.push(chapter);
        this.chapters_raw.push(chapter.toJSON()); // needed?
        this.calculateChapters();
    }

    public backupJSON(): void {
        if (fs.existsSync(this.filename)) {
            const backupFile = path.join(
                BaseConfigDataFolder.backup,
                `${this.basename}.${Date.now()}.json`
            );
            log(
                LOGLEVEL.INFO,
                "vod.backupJSON",
                `Backing up ${this.basename} to ${backupFile}`
            );
            fs.copyFileSync(this.filename, backupFile);
        }
    }

    public setPermissions(): void {
        if (
            !Config.getInstance().cfg("file_permissions") ||
            !Config.getInstance().cfg("file_chown_uid") ||
            !Config.getInstance().cfg("file_chown_gid") ||
            !Config.getInstance().cfg("file_chmod")
        ) {
            return;
        }

        for (const file of this.associatedFiles) {
            const fullpath = path.join(this.directory, file);
            if (fs.existsSync(fullpath)) {
                fs.chownSync(
                    fullpath,
                    Config.getInstance().cfg("file_chown_uid"),
                    Config.getInstance().cfg("file_chown_gid")
                );
                fs.chmodSync(fullpath, Config.getInstance().cfg("file_chmod"));
            }
        }
    }

    public getRecordingSize(): number | false {
        if (!this.is_capturing) return false;
        const filename =
            this.capturingFilename ??
            path.join(this.directory, `${this.basename}.ts`);
        if (!fs.existsSync(filename)) return false;
        return fs.statSync(filename).size;
    }

    public async getCapturingStatus(use_command = false): Promise<JobStatus> {
        const job = Job.findJob(`capture_${this.basename}`);
        return job ? await job.getStatus(use_command) : JobStatus.STOPPED;
    }

    public async getConvertingStatus(): Promise<JobStatus> {
        const job = Job.findJob(`convert_${this.basename}`);
        return job ? await job.getStatus() : JobStatus.STOPPED;
    }

    /**
     * Fix issues
     *
     * @returns true if no more issues need fixing, false if more issues need fixing
     */
    public async fixIssues(source = "Unknown"): Promise<boolean> {
        log(
            LOGLEVEL.DEBUG,
            "vod.fixIssues",
            `Run fixIssues for VOD ${this.basename} (${source})`
        );

        if (this.issueFixCount > 10) {
            log(
                LOGLEVEL.WARNING,
                "vod.fixIssues",
                `Too many issue fixes for VOD ${this.basename}`
            );
            return true;
        }

        // if (!this.getChannel()) {
        //     logAdvanced(LOGLEVEL.ERROR, "vod", `VOD ${this.basename} has no channel!`);
        //     return;
        // }

        if (this.not_started) {
            log(
                LOGLEVEL.INFO,
                "vod.fixIssues",
                `VOD ${this.basename} not started yet, skipping fix!`
            );
            this.issueFixCount = 0;
            return true;
        }

        if (await this.migrate()) {
            log(
                LOGLEVEL.INFO,
                "vod.fixIssues",
                `VOD ${this.basename} has been migrated`
            );
            this.issueFixCount++;
            await this.saveJSON("fix migrate");
            return false;
        }

        // fix illegal characters
        if (
            this.basename.match(LiveStreamDVR.filenameIllegalChars) &&
            !this.issueFixes["illegal_chars"]
        ) {
            console.log(
                chalk.bgRed.whiteBright(
                    `🛠️ [${source}] ${this.basename} contains invalid characters!`
                )
            );
            const newBasename = this.basename.replaceAll(
                LiveStreamDVR.filenameIllegalChars,
                "_"
            );
            await this.changeBaseName(newBasename);
            this.issueFixCount++;
            this.issueFixes["illegal_chars"] = true;
            return false;
        }

        if (
            !this.is_capturing &&
            !this.is_converting &&
            !this.is_finalized &&
            this.segments &&
            this.segments.length > 0
        ) {
            this.segments.forEach((segment) => {
                if (
                    segment.filename &&
                    path.extname(segment.filename) !== ".ts"
                ) {
                    console.log(
                        chalk.bgRed.whiteBright(
                            `🛠️ [${source}] ${this.basename} has non-ts segments but is not converting!`
                        )
                    );
                }
            });
        }

        // if finalized but no segments
        if (
            this.is_finalized &&
            (!this.segments || this.segments.length === 0) &&
            !this.issueFixes["finalized_no_segments"]
        ) {
            console.log(
                chalk.bgRed.whiteBright(
                    `🛠️ [${source}] ${this.basename} is finalized but no segments found, rebuilding!`
                )
            );
            const segs = await this.rebuildSegmentList();
            if (segs) {
                await this.saveJSON("fix rebuild segment list");
                this.issueFixCount++;
                this.issueFixes["finalized_no_segments"] = true;
                return false;
            } else {
                console.log(
                    chalk.bgRed.whiteBright(
                        `🛠️ [${source}] ${this.basename} could not be rebuilt!`
                    )
                );
                this.issueFixes["finalized_no_segments"] = true;
            }
        }

        // finalize if finished converting and not yet finalized
        if (
            this.is_converted &&
            !this.is_finalized &&
            this.segments.length > 0 &&
            !this.issueFixes["converted_finalize"]
        ) {
            console.log(
                chalk.bgRed.whiteBright(
                    `🛠️ [${source}] ${this.basename} is finished converting but not finalized, finalizing now!`
                )
            );
            await this.finalize();
            await this.saveJSON("fix finalize");
            this.issueFixCount++;
            this.issueFixes["converted_finalize"] = true;
            return false;
        }

        // if capturing but process not running
        if (
            this.is_capturing &&
            (await this.getCapturingStatus(true)) !== JobStatus.RUNNING &&
            !this.issueFixes["capture_not_running"]
        ) {
            console.log(
                chalk.bgRed.whiteBright(
                    `🛠️ [${source}] ${this.basename} is capturing but process not running. Setting to false for fixing.`
                )
            );
            this.is_capturing = false;
            await this.saveJSON("fix set capturing to false");
            this.issueFixCount++;
            this.issueFixes["capture_not_running"] = true;
            return false;
        }

        // if converting but process not running
        if (
            this.is_converting &&
            (await this.getConvertingStatus()) !== JobStatus.RUNNING &&
            !this.issueFixes["convert_not_running"]
        ) {
            console.log(
                chalk.bgRed.whiteBright(
                    `🛠️ [${source}] ${this.basename} is converting but process not running. Setting to false for fixing.`
                )
            );
            this.is_converting = false;
            await this.saveJSON("fix set converting to false");
            this.issueFixCount++;
            this.issueFixes["convert_not_running"] = true;
            return false;
        }

        // if not finalized and no segments found
        if (
            !this.is_finalized &&
            (!this.segments || this.segments.length === 0) &&
            !this.issueFixes["not_finalized_no_segments"]
        ) {
            console.log(
                chalk.bgRed.whiteBright(
                    `🛠️ [${source}] ${this.basename} is not finalized and no segments found.`
                )
            );
            await this.rebuildSegmentList();
            if (this.segments.length > 0) {
                await this.saveJSON("fix rebuild segment list");
                this.issueFixCount++;
                this.issueFixes["not_finalized_no_segments"] = true;
                return false;
            } else {
                console.log(
                    chalk.bgRed.whiteBright(
                        `🛠️ [${source}] ${this.basename} could not be rebuilt!`
                    )
                );
                // this.issueFixCount++;
                this.issueFixes["not_finalized_no_segments"] = true;
                return false;
            }
        }

        // remux if not yet remuxed
        if (
            !this.is_capturing &&
            !this.is_converted &&
            !this.is_finalized &&
            !this.issueFixes["not_remuxed"]
        ) {
            if (
                fs.existsSync(path.join(this.directory, `${this.basename}.ts`))
            ) {
                console.log(
                    chalk.bgRed.whiteBright(
                        `${this.basename} is not yet remuxed, remuxing now!`
                    )
                );

                let channel;
                try {
                    channel = this.getChannel();
                } catch (error) {
                    console.log(
                        chalk.bgRed.whiteBright(
                            `🛠️ [${source}] ${this.basename} has no channel!`
                        )
                    );
                }

                if (channel) {
                    const containerExt =
                        channel &&
                        channel.quality &&
                        channel.quality[0] === "audio_only"
                            ? Config.AudioContainer
                            : Config.getInstance().cfg("vod_container", "mp4");

                    const inFile = path.join(
                        this.directory,
                        `${this.basename}.ts`
                    );
                    const outFile = path.join(
                        this.directory,
                        `${this.basename}.${containerExt}`
                    );

                    if (fs.existsSync(outFile)) {
                        console.log(
                            chalk.bgRed.whiteBright(
                                `🛠️ [${source}] Converted file '${outFile}' for '${this.basename}' already exists, skipping remux!`
                            )
                        );
                    } else {
                        this.is_converting = true;
                        remuxFile(inFile, outFile)
                            .then(async (status) => {
                                console.log(
                                    chalk.bgRed.whiteBright(
                                        `🛠️ [${source}] ${this.basename} remux status: ${status.success}`
                                    )
                                );
                                await this.addSegment(
                                    `${this.basename}.${containerExt}`
                                );
                                this.is_converting = false;
                                await this.finalize();
                                await this.saveJSON("fix remux");
                            })
                            .catch(async (e) => {
                                console.log(
                                    chalk.bgRed.whiteBright(
                                        `🛠️ [${source}] ${this.basename} remux failed: ${e.message}`
                                    )
                                );
                                this.is_converting = false;
                                await this.saveJSON("fix remux failed");
                            });
                        this.issueFixCount++;
                        this.issueFixes["not_remuxed"] = true;
                        return false;
                    }
                }
            } else {
                console.log(
                    chalk.bgRed.whiteBright(
                        `🛠️ [${source}] ${this.basename} is not yet remuxed but no ts file found, skipping!`
                    )
                );

                if (
                    fs.existsSync(
                        path.join(this.directory, `${this.basename}.mp4`)
                    )
                ) {
                    console.log(
                        chalk.bgRed.whiteBright(
                            `🛠️ [${source}] ${this.basename} has an mp4 file but is not finalized!`
                        )
                    );
                    await this.addSegment(`${this.basename}.mp4`);
                    await this.finalize();
                    await this.saveJSON("fix no segment added");
                    this.issueFixCount++;
                    this.issueFixes["not_remuxed"] = true;
                    return false;
                }
            }
            this.issueFixes["not_remuxed"] = true;
        }

        // if no ended_at set
        if (
            this.is_finalized &&
            !this.ended_at &&
            !this.issueFixes["no_ended_at"]
        ) {
            console.log(
                chalk.bgRed.whiteBright(
                    `🛠️ [${source}] ${this.basename} is finalized but no ended_at found, fixing!`
                )
            );
            const duration = await this.getDuration();
            if (duration && this.started_at) {
                this.ended_at = new Date(
                    this.started_at.getTime() + duration * 1000
                );
                await this.saveJSON("fix set ended_at");
                this.issueFixCount++;
                this.issueFixes["no_ended_at"] = true;
                return false;
            } else {
                console.log(
                    chalk.bgRed.whiteBright(
                        `🛠️ [${source}] ${this.basename} has no duration or started_at, skipping!`
                    )
                );
            }
            this.issueFixes["no_ended_at"] = true;
        }

        // add default chapter
        if (
            this.is_finalized &&
            (!this.chapters || this.chapters.length === 0) &&
            isTwitchVOD(this) &&
            !this.issueFixes["no_default_chapter"]
        ) {
            console.log(
                chalk.bgRed.whiteBright(
                    `🛠️ [${source}] ${this.basename} is finalized but no chapters found, fixing now!`
                )
            );
            await this.generateDefaultChapter();
            await this.saveJSON("fix chapters");
            this.issueFixCount++;
            this.issueFixes["no_default_chapter"] = true;
            return false;
        }

        // if all else fails
        if (
            this.not_started &&
            !this.is_finalized &&
            !this.is_converted &&
            !this.is_capturing &&
            !this.is_converting &&
            this.segments.length === 0 &&
            !this.failed &&
            !this.issueFixes["all_else_fails"]
        ) {
            console.log(
                chalk.bgRed.whiteBright(
                    `🛠️ [${source}] ${this.basename} is not finalized, converting, capturing or converting, failed recording?`
                )
            );
            this.failed = true;
            await this.saveJSON("fix set failed true");
            this.issueFixCount++;
            this.issueFixes["all_else_fails"] = true;
            return false;
        }

        // if failed but actually not
        if (
            this.failed &&
            this.is_finalized &&
            this.segments.length > 0 &&
            !this.issueFixes["failed_but_not"]
        ) {
            console.log(
                chalk.bgRed.whiteBright(
                    `🛠️ [${source}] ${this.basename} is failed but is finalized, fixing!`
                )
            );
            this.failed = false;
            await this.saveJSON("fix set failed false");
            this.issueFixCount++;
            this.issueFixes["failed_but_not"] = true;
            return false;
        }

        // if segments don't begin with login
        if (this.is_finalized && this.segments.length > 0) {
            /*
            let error_segments = 0;
            for (const seg of this.segments_raw) {
                if (!path.basename(seg).startsWith(`${this.streamer_login}_`)) {
                    console.log(chalk.bgRed.whiteBright(`🛠️ [${source}] ${this.basename} segment ${seg} does not start with login ${this.streamer_login}!`));
                    error_segments++;
                    // this.segments_raw[index] = replaceAll(segment, `${this.streamer_login}_`, `${this.streamer_login}_${this.streamer_login}_`);
                }
            }
            if (error_segments == this.segments_raw.length) {
                console.log(chalk.bgRed.whiteBright(`🛠️ [${source}] ${this.basename} has no segments starting with login ${this.streamer_login}, fixing!`));
                this.rebuildSegmentList();
            }*/
            /*
            for (const seg of this.segments) {
                if (!seg.filename) continue;
                const dir = path.dirname(seg.filename);
                if (dir !== Helper.vodFolder(this.streamer_login) && seg.deleted) { // TODO: channel might not be added yet
                    // rebuild here
                    await this.rebuildSegmentList();
                    continue;
                }
            }
            */
        }

        // if finalized but has segments and duration is 0
        if (
            this.is_finalized &&
            this.segments.length > 0 &&
            this.duration === 0 &&
            !this.issueFixes["finalized_but_no_duration"]
        ) {
            console.log(
                chalk.bgRed.whiteBright(
                    `🛠️ [${source}] ${this.basename} is finalized but has segments and duration is 0, fixing!`
                )
            );
            const duration = await this.getDuration(true);
            console.log(
                chalk.bgRed.whiteBright(
                    `🛠️ [${source}] ${this.basename} duration: ${duration}`
                )
            );
            if (duration) {
                this.issueFixCount++;
                this.issueFixes["finalized_but_no_duration"] = true;
                return false;
            } else {
                console.log(
                    chalk.bgRed.whiteBright(
                        `🛠️ [${source}] ${this.basename} has no duration`
                    )
                );
                this.issueFixes["finalized_but_no_duration"] = true;
            }
        }

        if (!this.uuid && !this.issueFixes["no_uuid"]) {
            this.uuid = randomUUID();
            await this.saveJSON("new uuid");
            this.issueFixCount++;
            this.issueFixes["no_uuid"] = true;
            return false;
        }

        // if (!this.is_finalized && !this.is_converted && !this.is_converting && !this.is_capturing && !this.is_converted && !this.failed) {
        // console.debug(`🛠️ [${source}] ${this.basename} is finalized: ${this.is_finalized}, converting: ${this.is_converting}, capturing: ${this.is_capturing}, converted: ${this.is_converted}, failed: ${this.failed}`);

        log(
            LOGLEVEL.DEBUG,
            "vod.fixIssues",
            `fixIssues meta dump for ${this.basename} (${this.uuid})`,
            {
                channel_uuid: this.channel_uuid,
                channel_name:
                    this.channel_uuid &&
                    LiveStreamDVR.getInstance().getChannelByUUID(
                        this.channel_uuid
                    )
                        ? this.getChannel().internalName
                        : "unknown",
                uuid: this.uuid,

                basename: this.basename,
                is_capturing: this.is_capturing,
                is_converting: this.is_converting,
                is_converted: this.is_converted,
                is_finalized: this.is_finalized,
                chapter_count: this.chapters.length,
                segment_count: this.segments.length,
                has_started_at: this.started_at !== undefined,
                has_ended_at: this.ended_at !== undefined,
                not_started: this.not_started,
            }
        );

        if (this.issueFixCount > 0) {
            console.log(
                chalk.bgRed.whiteBright(
                    `🛠️ [${source}] ${this.basename} fixed ${this.issueFixCount} issues!`
                )
            );
        }

        // this.issueFixCount = 0; // TODO: should it be set to 0?
        return true;
    }

    /**
     * Rebuild segment list from video files named as basename and parse it
     * @saves
     * @returns
     */
    public async rebuildSegmentList(
        includeMisnamedFiles = false
    ): Promise<boolean> {
        log(
            LOGLEVEL.INFO,
            "vod.rebuildSegmentList",
            `Rebuilding segment list for ${this.basename}`
        );

        let files: string[];

        if (
            this.directory !== Helper.vodFolder(this.getChannel().internalName)
        ) {
            // is not in vod folder root, TODO: channel might not be added yet
            log(
                LOGLEVEL.INFO,
                "vod.rebuildSegmentList",
                `VOD ${this.basename} has its own folder (${this.directory}), find all files.`
            );
            files = fs
                .readdirSync(this.directory)
                .filter(
                    (file) =>
                        (file.endsWith(
                            `.${Config.getInstance().cfg(
                                "vod_container",
                                "mp4"
                            )}`
                        ) ||
                            file.endsWith(Config.AudioContainer)) &&
                        !file.includes("_vod") &&
                        !file.includes("_chat") &&
                        !file.includes("_chat_mask") &&
                        !file.includes("_burned")
                );
        } else {
            log(
                LOGLEVEL.INFO,
                "vod.rebuildSegmentList",
                `VOD ${this.basename} does not have a folder, find by basename.`
            );
            files = fs
                .readdirSync(this.directory)
                .filter(
                    (file) =>
                        file.startsWith(this.basename) &&
                        (file.endsWith(
                            `.${Config.getInstance().cfg(
                                "vod_container",
                                "mp4"
                            )}`
                        ) ||
                            file.endsWith(Config.AudioContainer)) &&
                        !file.includes("_vod") &&
                        !file.includes("_chat") &&
                        !file.includes("_chat_mask") &&
                        !file.includes("_burned")
                );
        }

        if (!includeMisnamedFiles) {
            files = files.filter((file) => file.startsWith(this.basename));
        }

        if (!files || files.length == 0) {
            log(
                LOGLEVEL.ERROR,
                "vod.rebuildSegmentList",
                `No segments found for ${this.basename}, can't rebuild segment list`
            );
            return false;
        }

        if (files.length > 1) {
            log(
                LOGLEVEL.WARNING,
                "vod.rebuildSegmentList",
                `Found more than one segment for ${this.basename} (${files.length})`
            );
        }

        this.segments_raw = [];
        this.segments = [];

        await Promise.all(
            files.map(async (file) => {
                await this.addSegment(path.basename(file));
            })
        );

        // this.parseSegments(this.segments_raw);
        await this.saveJSON("segments rebuild");

        return true;
    }

    public calculateBookmarks(): boolean {
        if (!this.bookmarks || this.bookmarks.length == 0) return false;
        if (!this.started_at) return false;

        this.bookmarks.forEach((bookmark) => {
            if (!this.started_at) return false;
            bookmark.offset =
                (bookmark.date.getTime() - this.started_at.getTime()) / 1000;
        });

        return true;
    }

    public async createVideoContactSheet(): Promise<boolean> {
        if (
            !this.segments ||
            this.segments.length == 0 ||
            !this.segments[0].filename
        ) {
            log(
                LOGLEVEL.ERROR,
                "vod.createVideoContactSheet",
                `No segments found for ${this.basename}, can't create video contact sheet`
            );
            return false;
        }

        if (this.video_metadata?.type !== "video") {
            log(
                LOGLEVEL.ERROR,
                "vod.createVideoContactSheet",
                `VOD ${this.basename} is not a video, can't create video contact sheet`
            );
            return false;
        }

        try {
            await videoContactSheet(
                this.segments[0].filename,
                path.join(this.directory, `${this.basename}-contact_sheet.png`),
                {
                    width: Config.getInstance().cfg(
                        "contact_sheet.width",
                        1920
                    ),
                    grid: Config.getInstance().cfg("contact_sheet.grid", "3x5"),
                }
            );
        } catch (error) {
            if (error instanceof Error) {
                log(
                    LOGLEVEL.ERROR,
                    "vod.createVideoContactSheet",
                    `Failed to create video contact sheet for ${this.basename}: ${error.message}`,
                    error
                );
            } else if (isExecError(error)) {
                log(
                    LOGLEVEL.ERROR,
                    "vod.createVideoContactSheet",
                    `Failed to create video contact sheet for ${
                        this.basename
                    }: ${error.stdout.join("")} ${error.stderr.join("")}`,
                    error
                );
            } else {
                log(
                    LOGLEVEL.ERROR,
                    "vod.createVideoContactSheet",
                    `Failed to create video contact sheet for ${
                        this.basename
                    }: ${(error as Error).message}`,
                    error
                );
            }
            return false;
        }
        return true;
    }

    public deleteEmptyFolder(): boolean {
        if (
            this.directory === Helper.vodFolder(this.getChannel().internalName)
        ) {
            log(
                LOGLEVEL.ERROR,
                "vod.deleteEmptyFolder",
                `Can't delete root vod folder ${this.directory}`
            );
            return false;
        }
        if (
            fs.existsSync(this.directory) &&
            fs.readdirSync(this.directory).length == 0
        ) {
            log(
                LOGLEVEL.INFO,
                "vod.deleteEmptyFolder",
                `Deleting empty vod folder ${this.directory}`
            );
            fs.rmdirSync(this.directory);
            return true;
        }
        return false;
    }

    public move(newDirectory: string): void {
        if (!this.directory) throw new Error("No directory set for move");

        log(
            LOGLEVEL.INFO,
            "vod.move",
            `Move ${this.basename} to ${newDirectory}`
        );

        for (const file of this.associatedFiles) {
            const fileFrom = path.join(this.directory, file);
            const fileTo = path.join(newDirectory, file);
            if (fs.existsSync(fileFrom)) {
                log(
                    LOGLEVEL.DEBUG,
                    "vod.move",
                    `Move ${fileFrom} to ${fileTo}`
                );
                fs.renameSync(fileFrom, fileTo);
            } else {
                log(
                    LOGLEVEL.ERROR,
                    "vod.move",
                    `File ${fileFrom} does not exist`
                );
            }
        }
    }

    public archive(): void {
        this.move(BaseConfigDataFolder.saved_vods);

        const channel = this.getChannel();
        if (channel) channel.removeVod(this.uuid);
    }
}
