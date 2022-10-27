import chalk from "chalk";
import chokidar from "chokidar";
import { randomUUID } from "node:crypto";
import { format, parseJSON } from "date-fns";
import fs from "node:fs";
import path from "node:path";
import { BaseVODChapterJSON, VODJSON } from "Storage/JSON";
import { ApiBaseVod } from "@common/Api/Client";
import { VideoQuality } from "@common/Config";
import { JobStatus, MuteStatus, Providers } from "@common/Defs";
import { ExportData } from "@common/Exporter";
import { AudioMetadata, VideoMetadata } from "@common/MediaInfo";
import { VodUpdated } from "@common/Webhook";
import { FFmpegMetadata } from "../../../Core/FFmpegMetadata";
import { Helper } from "../../../Core/Helper";
import { Job } from "../../../Core/Job";
import { isTwitchVOD, isTwitchVODChapter } from "../../../Helpers/Types";
import { BaseConfigCacheFolder, BaseConfigDataFolder } from "../../BaseConfig";
import { ClientBroker } from "../../ClientBroker";
import { Config } from "../../Config";
import { LiveStreamDVR, VODTypes } from "../../LiveStreamDVR";
import { Log } from "../../Log";
import { Webhook } from "../../Webhook";
import { BaseChannel } from "./BaseChannel";
import { BaseVODChapter } from "./BaseVODChapter";
import { BaseVODSegment } from "./BaseVODSegment";

export class BaseVOD {

    public provider: Providers = "base";

    loaded = false;

    uuid = "";
    capture_id = "";
    filename = "";
    basename = "";
    directory = "";

    json?: VODJSON;

    /**
     * Date for when the VOD was created
     */
    created_at?: Date;

    /**
     * Date for when the stream was started on the provider's end.
     */
    started_at?: Date;
    ended_at?: Date;
    saved_at?: Date;

    /**
     * Date for when the capture process was launched
     */
    capture_started?: Date;

    /**
     * Date for when the capture file was output
     */
    capture_started2?: Date;
    conversion_started?: Date;

    video_metadata: VideoMetadata | AudioMetadata | undefined;

    force_record = false;

    duration = 0;
    total_size = 0;

    created = false;
    not_started = false;

    is_capturing = false;
    is_converting = false;
    is_finalized = false;

    stream_number?: number;
    stream_absolute_season?: number;

    comment?: string;

    prevent_deletion = false;

    failed = false;

    chapters_raw: BaseVODChapterJSON[] = [];

    chapters: Array<BaseVODChapter> = [];

    path_chat = "";
    path_downloaded_vod = "";
    path_losslesscut = "";
    path_chatrender = "";
    path_chatmask = "";
    path_chatburn = "";
    path_chatdump = "";
    path_adbreak = "";
    path_playlist = "";
    path_ffmpegchapters = "";
    path_vttchapters = "";
    path_kodinfo = "";

    stream_resolution: VideoQuality | undefined;
    stream_title = "";

    public cloud_storage = false;

    /**
     * An array of strings containing the file paths of the segments.
     */
    segments_raw: string[] = [];
    segments: BaseVODSegment[] = [];

    public channel_uuid?: string;

    webpath = "";

    public fileWatcher?: chokidar.FSWatcher;
    public _writeJSON = false;
    public _updateTimer: NodeJS.Timeout | undefined;

    public capturingFilename?: string;

    public exportData: ExportData = {};

    /**
     * Set up date related data
     * Requires JSON to be loaded
     */
    public setupDates(): void {

        if (!this.json) {
            throw new Error("No JSON loaded for date setup!");
        }

        if (this.json.created_at) this.created_at = parseJSON(this.json.created_at);
        if (this.json.started_at) this.started_at = parseJSON(this.json.started_at);

        if (this.json.ended_at) this.ended_at = parseJSON(this.json.ended_at);
        if (this.json.saved_at) this.saved_at = parseJSON(this.json.saved_at);

        if (this.json.capture_started) this.capture_started = parseJSON(this.json.capture_started);
        if (this.json.capture_started2) this.capture_started2 = parseJSON(this.json.capture_started2);
        if (this.json.conversion_started) this.conversion_started = parseJSON(this.json.conversion_started);

    }

    public async startWatching(): Promise<boolean> {
        if (this.fileWatcher) await this.stopWatching();

        // no blocks in testing
        if (process.env.NODE_ENV === "test") return false;

        const files = this.associatedFiles.map((f) => path.join(this.directory, f));

        this.fileWatcher = chokidar.watch(files, {
            ignoreInitial: true,
        }).on("all", (eventType, filename) => {

            if (LiveStreamDVR.shutting_down) {
                this.stopWatching();
                return;
            }

            if (!this.channel_uuid) {
                Log.logAdvanced(Log.Level.ERROR, "vod.watch", `VOD ${this.basename} has no channel UUID!`);
                return;
            }

            const channel = this.getChannel();
            if (channel) {
                if (channel.live_chat && (filename.endsWith(".chatdump.line") || filename.endsWith(".chatdump.txt"))) {
                    return;
                }
            }

            if (Config.debug) console.log(`VOD file ${filename} changed (${this._writeJSON ? "internal" : "external"}/${eventType})!`);

            if (filename === this.filename) {
                if (!fs.existsSync(this.filename)) {
                    Log.logAdvanced(Log.Level.WARNING, "vod", `VOD JSON ${this.basename} deleted!`);
                    if (LiveStreamDVR.getInstance().getVods().find(v => v.basename == this.basename)) {
                        Log.logAdvanced(Log.Level.WARNING, "vod", `VOD ${this.basename} still in memory!`);

                        // const channel = TwitchChannel.getChannelByLogin(this.streamer_login);
                        // if (channel) channel.removeVod(this.basename);
                    }

                    setTimeout(() => {
                        LiveStreamDVR.getInstance().cleanLingeringVODs();
                    }, 4000);

                    const channel = this.getChannel();
                    if (channel) {
                        setTimeout(() => {
                            if (!channel) return;
                            channel.checkStaleVodsInMemory();
                        }, 5000);
                    }
                } else {
                    Log.logAdvanced(Log.Level.DEBUG, "vod", `VOD JSON ${this.basename} exists (again?) ${eventType}`);
                }
            } else if (this.segments.some(s => s.filename === filename)) {
                if (Config.debug) console.debug(`VOD segment ${filename} changed (${eventType})!`);
                Log.logAdvanced(Log.Level.INFO, "vod.watch", `VOD segment ${filename} changed (${eventType})!`);
                ClientBroker.notify(
                    "Segment changed externally",
                    path.basename(filename),
                    undefined,
                    "system"
                );
            } else {
                if (Config.debug) console.debug(`VOD file ${filename} changed (${eventType})!`);
                Log.logAdvanced(Log.Level.INFO, "vod.watch", `VOD file ${filename} changed (${eventType})!`);
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

    get associatedFiles(): string[] {

        if (!this.directory) return [];

        const base = [
            `${this.basename}.json`,
            `${this.basename}.chat`,
            `${this.basename}_chat.json`,
            `${this.basename}_vod.mp4`,
            `${this.basename}-llc-edl.csv`,
            `${this.basename}_chat.mp4`,
            `${this.basename}_chat_mask.mp4`,
            `${this.basename}_burned.mp4`,
            `${this.basename}.chatdump`,
            `${this.basename}.chatdump.txt`,
            `${this.basename}.chatdump.line`,
            `${this.basename}.m3u8`,
            `${this.basename}.adbreak`,
            `${this.basename}-ffmpeg-chapters.txt`,
            `${this.basename}.chapters.vtt`,
            `${this.basename}.nfo`,
        ];

        if (this.segments_raw) {
            // for (const seg of this.segments_raw) {
            //     base.push(path.basename(seg));
            // }
            base.push(...this.segments_raw.map(seg => path.basename(seg)));
        }

        return base.filter(f => fs.existsSync(this.realpath(path.join(this.directory || "", f))));

    }

    get is_chat_downloaded(): boolean { return this.path_chat !== "" && fs.existsSync(this.path_chat); }
    get is_vod_downloaded(): boolean { return this.path_downloaded_vod !== "" && fs.existsSync(this.path_downloaded_vod); }
    get is_lossless_cut_generated(): boolean { return this.path_losslesscut !== "" && fs.existsSync(this.path_losslesscut); }
    get is_chatdump_captured(): boolean { return this.path_chatdump !== "" && fs.existsSync(this.path_chatdump); }
    get is_capture_paused(): boolean { return this.path_adbreak !== "" && fs.existsSync(this.path_adbreak); }
    get is_chat_rendered(): boolean { return this.path_chatrender !== "" && fs.existsSync(this.path_chatrender); }
    get is_chat_burned(): boolean { return this.path_chatburn !== "" && fs.existsSync(this.path_chatburn); }

    public async toAPI(): Promise<ApiBaseVod> {
        throw new Error("Not implemented");
    }

    public async saveJSON(reason = ""): Promise<false | VODJSON> {
        throw new Error("Not implemented");
    }

    /**
     * Add segment
     * TODO basename or full path?
     * @param segment 
     */
    public async addSegment(segment: string): Promise<void> {

        Log.logAdvanced(Log.Level.INFO, "vod.addSegment", `Adding segment ${segment} to ${this.basename}`);

        if (this.segments && this.segments.length > 1) {
            Log.logAdvanced(Log.Level.WARNING, "vod.addSegment", `VOD ${this.basename} already has segments, adding ${segment}`);
        }

        this.segments_raw.push(segment);
        await this.parseSegments(this.segments_raw);

    }

    public async parseSegments(array: string[]): Promise<false | undefined> {

        if (!this.directory) {
            throw new Error("TwitchVOD.parseSegments: directory is not set");
        }

        if (!array) {
            Log.logAdvanced(Log.Level.ERROR, "vod.parseSegments", `No segment data supplied on ${this.basename}`);

            if (!this.segments_raw) {
                Log.logAdvanced(Log.Level.ERROR, "vod.parseSegments", `No segment_raw data on ${this.basename}, calling rebuild...`);
                await this.rebuildSegmentList();
            }

            return false;
        }

        this.total_size = 0;

        const segments: BaseVODSegment[] = [];

        for (const raw_segment of array) {

            if (typeof raw_segment !== "string") {
                Log.logAdvanced(Log.Level.ERROR, "vod.parseSegments", `Segment list containing invalid data for ${this.basename}, rebuilding...`);
                await this.rebuildSegmentList();
                return;
            }

            const base_segment = path.basename(raw_segment);

            // find invalid characters for windows
            if (base_segment.match(LiveStreamDVR.filenameIllegalChars)) {
                Log.logAdvanced(Log.Level.ERROR, "vod.parseSegments", `Segment list containing invalid characters for ${this.basename}: ${base_segment}`);
                return false;
            }

            const segment = new BaseVODSegment();

            // segment.filename = realpath($this.directory . DIRECTORY_SEPARATOR . basename($v));
            // segment.basename = basename($v);
            segment.filename = path.join(this.directory, path.basename(base_segment));
            segment.basename = path.basename(base_segment);

            if (segment.filename && fs.existsSync(segment.filename) && fs.statSync(segment.filename).size > 0) {
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

    public renderChat(chat_width: number, chat_height: number, font: string, font_size: number, use_downloaded: boolean, overwrite: boolean): Promise<boolean> {

        if (use_downloaded && !this.is_chat_downloaded) {
            console.error(chalk.redBright("No chat downloaded"));
            throw new Error("No chat downloaded");
        } else if (!use_downloaded && !this.is_chatdump_captured) {
            console.error(chalk.redBright("No chat dumped"));
            throw new Error("No chat dumped");
        }

        if (!this.video_metadata) {
            console.error(chalk.redBright("No video metadata"));
            throw new Error("No video metadata");
        }

        if (!("height" in this.video_metadata)) {
            console.error(chalk.redBright("No video metadata height"));
            throw new Error("No video metadata height");
        }

        Log.logAdvanced(Log.Level.INFO, "vod", `Render chat for ${this.basename}`);

        if (fs.existsSync(this.path_chat) && fs.existsSync(this.path_chatrender) && !overwrite) {
            console.error(chalk.redBright("Chat already rendered"));
            throw new Error("Chat already rendered");
        }

        const bin = Helper.path_twitchdownloader();
        const ffmpeg_bin = Helper.path_ffmpeg();
        const args: string[] = [];

        if (!bin || !fs.existsSync(bin)) {
            console.error(chalk.redBright("TwitchDownloaderCLI not installed"));
            throw new Error("TwitchDownloaderCLI not installed");
        }

        if (!ffmpeg_bin || !fs.existsSync(ffmpeg_bin)) {
            console.error(chalk.redBright("FFmpeg not installed"));
            throw new Error("FFmpeg not installed");
        }

        args.push("--mode", "ChatRender");
        args.push("--temp-path", BaseConfigCacheFolder.cache);
        args.push("--ffmpeg-path", ffmpeg_bin);
        args.push("--input", path.normalize(use_downloaded ? this.path_chat : this.path_chatdump));
        args.push("--chat-height", (chat_height ? chat_height : this.video_metadata.height).toString());
        args.push("--chat-width", chat_width.toString());
        args.push("--framerate", Math.round(this.video_metadata.fps).toString());
        args.push("--update-rate", "0");
        args.push("--font", font);
        args.push("--font-size", font_size.toString());
        args.push("--outline");
        args.push("--background-color", "#00000000"); // alpha
        args.push("--generate-mask");
        args.push("--output", this.path_chatrender);

        Log.logAdvanced(Log.Level.INFO, "vod", `Running ${bin} ${args.join(" ")}`);

        const env = {
            DOTNET_BUNDLE_EXTRACT_BASE_DIR: BaseConfigCacheFolder.dotnet,
            TEMP: BaseConfigCacheFolder.cache,
        };

        return new Promise((resolve, reject) => {

            this.stopWatching();

            const job = Helper.startJob(`tdrender_${this.basename}`, bin, args, env);

            if (!job) {
                console.error(chalk.redBright("Couldn't start job"));
                this.startWatching();
                reject(new Error("Couldn't start job"));
                throw new Error("Could not start job");
            }

            job.on("stdout", (data: string) => {
                if (data.includes("Fetching ")) {
                    Log.logAdvanced(Log.Level.INFO, "vod", `Chat render fetching: ${data}`);
                } else if (data.includes("Rendering Comments")) {
                    Log.logAdvanced(Log.Level.INFO, "vod", "Comments now rendering!");
                } else if (data.trim() == "[STATUS] - Rendering Video 0%") {
                    Log.logAdvanced(Log.Level.INFO, "vod", "Chat history now rendering!");
                } else if (data.includes("FINISHED")) {
                    Log.logAdvanced(Log.Level.INFO, "vod", "Chat render finished!");
                }
            });

            job.on("close", (code) => {

                this.startWatching();

                if (job.stdout.join("").includes("Option 'temp-path' is unknown")) {
                    console.error(chalk.redBright("The version of TwitchDownloaderCLI  is too old. Please update to the latest version."));
                    reject(new Error("The version of TwitchDownloaderCLI is too old. Please update to the latest version."));
                    return;
                }

                if (fs.existsSync(this.path_chatrender) && fs.statSync(this.path_chatrender).size > 0) {
                    Log.logAdvanced(Log.Level.INFO, "vod", `Chat rendered for ${this.basename} (code ${code})`);
                    resolve(true);
                } else {
                    Log.logAdvanced(Log.Level.ERROR, "vod", `Chat couldn't be rendered for ${this.basename} (code ${code})`);
                    reject(new Error("Chat couldn't be rendered"));
                    // reject(false);
                }
            });

        });

    }

    // TODO: add hardware acceleration
    public burnChat(
        burn_horizontal = "left",
        burn_vertical = "top",
        ffmpeg_preset = "slow",
        ffmpeg_crf = 26,
        use_vod = false,
        overwrite = false,
        startOffset = 0,
        test_duration = false
    ): Promise<boolean> {

        Log.logAdvanced(Log.Level.INFO, "vod", `Burn chat for ${this.basename}`);

        if (this.path_chatburn && fs.existsSync(this.path_chatburn) && !overwrite) {
            Log.logAdvanced(Log.Level.INFO, "vod", `Chat already burned for ${this.basename}`);
            throw new Error(`Chat already burned for ${this.basename}`);
        }

        let video_filename = "";

        if (use_vod) {
            if (!this.is_vod_downloaded) {
                throw new Error(`VOD not downloaded for ${this.basename}`);
            }
            video_filename = this.path_downloaded_vod;
        } else if (this.segments && this.segments.length > 0 && this.segments[0].filename) {
            video_filename = this.segments[0].filename;
        } else {
            throw new Error(`No segments available for ${this.basename}`);
        }

        if (!video_filename) {
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
            Log.logAdvanced(Log.Level.INFO, "vod", `Using start offset for chat: ${startOffset}`);
        }

        // chat render
        args.push("-i", this.path_chatrender);


        // chat mask offset
        if (startOffset) {
            args.push("-ss", startOffset.toString());
            Log.logAdvanced(Log.Level.INFO, "vod", `Using start offset for chat mask: ${startOffset}`);
        }

        if (test_duration) {
            args.push("-t", Helper.ffmpeg_time(60 * 1000));
        }

        // chat mask
        args.push("-i", this.path_chatmask);

        // vod
        args.push("-i", video_filename);

        // alpha mask
        // https://ffmpeg.org/ffmpeg-filters.html#overlay-1
        // https://stackoverflow.com/questions/50338129/use-ffmpeg-to-overlay-a-video-on-top-of-another-using-an-alpha-channel
        const pos_x = burn_horizontal == "left" ? 0 : "main_w-overlay_w";
        const pos_y = burn_vertical == "top" ? 0 : "main_h-overlay_h";
        args.push("-filter_complex", `[0][1]alphamerge[ia];[2][ia]overlay=${pos_x}:${pos_y}`);

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

        return new Promise((resolve, reject) => {

            this.stopWatching();

            const job = Helper.startJob(`burnchat_${this.basename}`, bin, args);
            if (!job) throw new Error("Job failed");

            job.on("close", (code) => {

                this.startWatching();

                if (fs.existsSync(this.path_chatburn) && fs.statSync(this.path_chatburn).size > 0) {
                    Log.logAdvanced(Log.Level.INFO, "vod", `Chat burned for ${this.basename} (code ${code})`);
                    resolve(true);
                } else {
                    Log.logAdvanced(Log.Level.ERROR, "vod", `Chat couldn't be burned for ${this.basename} (code ${code})`);
                    reject(false);
                }

            });
        });

    }

    public broadcastUpdate(): void {
        if (process.env.NODE_ENV === "test") return;
        if (this._updateTimer) {
            clearTimeout(this._updateTimer);
            this._updateTimer = undefined;
        }
        this._updateTimer = setTimeout(async () => {
            const vod = await this.toAPI();
            Webhook.dispatch("vod_updated", {
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
        throw new Error("Not implemented");
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

        const longChapters = this.chapters.filter(chapter => {
            if (chapter.duration && chapter.duration > minDuration) {
                Log.logAdvanced(Log.Level.INFO, "vod.removeShortChapters", `Keeping chapter ${chapter.title} with duration ${chapter.duration} on ${this.basename}`);
                return true;
            } else if (chapter.duration === undefined) {
                Log.logAdvanced(Log.Level.ERROR, "vod.removeShortChapters", `Chapter ${chapter.title} has undefined duration on ${this.basename}`);
                return true;
            } else {
                Log.logAdvanced(Log.Level.INFO, "vod.removeShortChapters", `Removing chapter ${chapter.title} with duration ${chapter.duration} on ${this.basename}`);
                return false;
            }
        });

        console.debug(`Removed ${this.chapters.length - longChapters.length} chapters on ${this.basename}`);

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
            Log.logAdvanced(Log.Level.ERROR, "vod.calculateChapters", `No start time found for ${this.basename}, can't calculate chapters`);
            return false;
        }

        if (!this.chapters || this.chapters.length == 0) {
            Log.logAdvanced(Log.Level.ERROR, "vod.calculateChapters", `No chapters found for ${this.basename}, can't calculate chapters`);
            return false;
        }

        // console.debug(`Calculating chapters for ${this.basename}, ${this.chapters.length} chapters`);

        this.chapters.forEach((chapter, index) => {

            if (!this.started_at) return; // thanks scoping

            if (!chapter.vod_uuid) chapter.vod_uuid = this.uuid;

            const next_chapter = this.chapters[index + 1];

            chapter.calculateDurationAndOffset(this.started_at, this.ended_at, next_chapter ? next_chapter.started_at : undefined);

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
            throw new Error("TwitchVOD.saveFFMPEGChapters: directory is not set");
        }

        if (!this.chapters || this.chapters.length == 0) {
            // throw new Error('TwitchVOD.saveFFMPEGChapters: chapters are not set');
            return false;
        }

        Log.logAdvanced(Log.Level.INFO, "vod.saveFFMPEGChapters", `Saving FFMPEG chapters file for ${this.basename} to ${this.path_ffmpegchapters}`);

        const meta = new FFmpegMetadata()
            .setArtist(this.getChannel().displayName);

        if (isTwitchVOD(this)) {
            meta.setTitle(this.twitch_vod_title ?? this.chapters[0].title);
        }

        if (this.started_at) meta.setDate(this.started_at);

        this.chapters.forEach((chapter) => {
            const offset = chapter.offset || 0;
            const duration = chapter.duration || 0;
            const start = Math.floor(offset * 1000);
            const end = Math.floor((offset + duration) * 1000);
            const title = isTwitchVODChapter(chapter) ? `${chapter.title} (${chapter.game_name})` : chapter.title;
            try {
                meta.addChapter(start, end, title, "1/1000", [
                    isTwitchVODChapter(chapter) ? `Game ID: ${chapter.game_id}` : "",
                    isTwitchVODChapter(chapter) ? `Game Name: ${chapter.game_name}` : "",
                    `Title: ${chapter.title}`,
                    `Offset: ${offset}`,
                    `Duration: ${duration}`,
                    isTwitchVODChapter(chapter) ? `Viewer count: ${chapter.viewer_count}` : "",
                    `Started at: ${chapter.started_at.toISOString()}`,
                ]);
            } catch (error) {
                Log.logAdvanced(Log.Level.ERROR, "vod.saveFFMPEGChapters", `Error while adding chapter ${chapter.title} to FFMPEG chapters file for ${this.basename}: ${(error as Error).message}`);
            }

        });

        await this.stopWatching();

        fs.writeFileSync(this.path_ffmpegchapters, meta.getString(), { encoding: "utf8" });

        this.setPermissions();

        await this.startWatching();

        return fs.existsSync(this.path_ffmpegchapters);

    }

    public reencodeSegments(addToSegments = false, deleteOriginal = false): Promise<boolean> {

        Log.logAdvanced(Log.Level.INFO, "vod", `Reencoding segments of ${this.filename}`);

        const tasks = [];

        if (!this.segments) throw new Error("No segments");

        const ffmpeg_path = Helper.path_ffmpeg();

        if (!ffmpeg_path) {
            throw new Error("Failed to find ffmpeg");
        }

        for (const segment of this.segments) {
            tasks.push(new Promise((resolve, reject) => {
                if (!segment.basename) { reject(new Error("No filename")); return; }
                const file_in_path = path.join(this.directory, segment.basename);
                if (!fs.existsSync(file_in_path)) { reject(new Error(`File not found: ${file_in_path}`)); return; }
                const file_out_path = path.join(this.directory, `${segment.basename}_enc.mp4`);
                if (fs.existsSync(file_out_path)) {
                    reject(new Error(`File ${file_out_path} already exists!`));
                    return;
                }

                const args = [];
                if (Config.getInstance().cfg<string>("reencoder.hwaccel")) {
                    // args.push("-hwaccel", Config.getInstance().cfg<string>("reencoder.hwaccel"));
                    args.push("-i", file_in_path);
                    args.push("-c:v", Config.getInstance().cfg<string>("reencoder.video_codec"));
                    args.push("-c:a", "copy");
                    args.push("-preset", Config.getInstance().cfg<string>("reencoder.preset"));
                    args.push("-tune", Config.getInstance().cfg<string>("reencoder.tune"));
                } else {
                    args.push("-i", file_in_path);
                    args.push("-c:v", Config.getInstance().cfg<string>("reencoder.video_codec"));
                    args.push("-c:a", "copy"); // no need to reencode audio
                    args.push("-preset", Config.getInstance().cfg<string>("reencoder.preset"));
                    args.push("-crf", Config.getInstance().cfg<string>("reencoder.crf"));
                }
                args.push("-movflags", "+faststart");
                if (Config.getInstance().cfg<number>("reencoder.resolution")) {
                    args.push("-vf", `scale=-1:${Config.getInstance().cfg<number>("reencoder.resolution")}`);
                }
                // args.push("-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2"); // scale to nearest multiple of 2
                args.push(file_out_path);

                const job = Helper.startJob(`reencode_${path.basename(file_in_path)}`, ffmpeg_path, args);

                if (!job || !job.process) {
                    reject(new Error("Failed to start ffmpeg"));
                    return;
                }

                let currentSeconds = 0;
                let totalSeconds = 0;
                job.on("log", (stream: string, data: string) => {
                    const totalDurationMatch = data.match(/Duration: (\d+):(\d+):(\d+)/);
                    const fpsMatch = data.match(/fps=(\d+)/);
                    if (totalDurationMatch && !totalSeconds) {
                        totalSeconds = parseInt(totalDurationMatch[1]) * 3600 + parseInt(totalDurationMatch[2]) * 60 + parseInt(totalDurationMatch[3]);
                        console.debug(`Remux total duration: ${totalSeconds}`);
                    }
                    const currentTimeMatch = data.match(/time=(\d+):(\d+):(\d+)/);
                    if (currentTimeMatch && totalSeconds > 0) {
                        currentSeconds = parseInt(currentTimeMatch[1]) * 3600 + parseInt(currentTimeMatch[2]) * 60 + parseInt(currentTimeMatch[3]);
                        job.setProgress(currentSeconds / totalSeconds);
                        console.debug(`Remux current time: ${currentSeconds} / ${totalSeconds} (${Math.round(currentSeconds / totalSeconds * 100)}%, ${fpsMatch ? fpsMatch[1] : "?"}fps)`);
                    }
                    if (data.match(/moving the moov atom/)) {
                        console.debug("Remux moov atom move");
                    }
                });

                job.process.on("error", (err) => {
                    Log.logAdvanced(Log.Level.ERROR, "helper", `Process ${process.pid} error: ${err}`);
                    // reject({ code: -1, success: false, stdout: job.stdout, stderr: job.stderr });
                    reject(new Error(`Process ${process.pid} error: ${err}`));
                });

                job.process.on("close", (code) => {
                    if (job) {
                        job.clear();
                    }
                    // const out_log = ffmpeg.stdout.read();
                    const success = fs.existsSync(file_out_path) && fs.statSync(file_out_path).size > 0;
                    if (success) {
                        Log.logAdvanced(Log.Level.SUCCESS, "helper", `Reencoded ${file_in_path} to ${file_out_path}`);
                        if (deleteOriginal) {
                            // fs.unlinkSync(file_in_path);
                        }
                        if (addToSegments) {
                            this.addSegment(path.basename(file_out_path));
                        }
                        resolve(true);
                    } else {
                        Log.logAdvanced(Log.Level.ERROR, "helper", `Failed to reencode ${path.basename(file_in_path)} to ${path.basename(file_out_path)}`);
                        // reject({ code, success, stdout: job.stdout, stderr: job.stderr });

                        let message = "Unknown error";
                        const errorSearch = job.stderr.join("").match(/\[error\] (.*)/g);
                        if (errorSearch && errorSearch.length > 0) {
                            message = errorSearch.slice(1).join(", ");
                        }

                        if (fs.existsSync(file_out_path) && fs.statSync(file_out_path).size == 0) {
                            fs.unlinkSync(file_out_path);
                        }

                        // for (const err of errorSearch) {
                        //    message = err[1];
                        reject(new Error(`Failed to reencode ${path.basename(file_in_path)} to ${path.basename(file_out_path)}: ${message}`));
                    }
                });

                // const ffmpeg_command = `ffmpeg -i ${file_in_path} -c:v libx264 -preset veryfast -crf 23 -c:a aac -b:a 128k -strict -2 ${file_out_path}`;
            }));
        }


        this.stopWatching();

        return Promise.all(tasks).then((results) => {
            console.debug("Reencoded", results);
            Log.logAdvanced(Log.Level.SUCCESS, "helper", `Successfully reencoded ${this.basename}`);
            return true;
        }).catch((err) => {
            console.debug("Reencoded error", err);
            Log.logAdvanced(Log.Level.ERROR, "helper", `Failed to reencode ${this.basename}: ${(err as Error).message}`);
            return false;
        }).finally(() => {
            this.startWatching();
        });

    }

    /**
     * Is ts filed converted?
     * GETTER
     */
    get is_converted(): boolean {
        if (!this.directory) return false;
        if (!this.segments || this.segments.length == 0) return false;
        if (this.is_converting) return false;
        return this.segments.some(segment => segment.filename && fs.existsSync(segment.filename) && fs.statSync(segment.filename).size > 0);
    }

    /**
     * Stream season
     * GETTER
     */
    get stream_season(): string | undefined {
        if (!this.started_at) return undefined;
        return format(this.started_at, Config.SeasonFormat);
    }

    public async setupFiles(): Promise<void> {

        if (!this.directory) {
            throw new Error("No directory set!");
        }

        this.path_chat = this.realpath(path.join(this.directory, `${this.basename}_chat.json`));
        this.path_downloaded_vod = this.realpath(path.join(this.directory, `${this.basename}_vod.mp4`));
        this.path_losslesscut = this.realpath(path.join(this.directory, `${this.basename}-llc-edl.csv`));
        this.path_chatrender = this.realpath(path.join(this.directory, `${this.basename}_chat.mp4`));
        this.path_chatmask = this.realpath(path.join(this.directory, `${this.basename}_chat_mask.mp4`));
        this.path_chatburn = this.realpath(path.join(this.directory, `${this.basename}_burned.mp4`));
        this.path_chatdump = this.realpath(path.join(this.directory, `${this.basename}.chatdump`));
        this.path_adbreak = this.realpath(path.join(this.directory, `${this.basename}.adbreak`));
        this.path_playlist = this.realpath(path.join(this.directory, `${this.basename}.m3u8`));
        this.path_ffmpegchapters = this.realpath(path.join(this.directory, `${this.basename}-ffmpeg-chapters.txt`));
        this.path_vttchapters = this.realpath(path.join(this.directory, `${this.basename}.chapters.vtt`));
        this.path_kodinfo = this.realpath(path.join(this.directory, `${this.basename}.nfo`));

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
                if (!fs.existsSync(this.path_kodinfo) && Config.getInstance().cfg("create_kodi_nfo")) {
                    await this.saveKodiNfo();
                }
            } catch (error) {
                Log.logAdvanced(Log.Level.ERROR, "vod", `Could not save associated files for ${this.basename}: ${(error as Error).message}`);
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
        const csv_path = path.join(this.directory, `${this.basename}-llc-edl.csv`);

        Log.logAdvanced(Log.Level.INFO, "vod.saveLosslessCut", `Saving lossless cut csv for ${this.basename} to ${csv_path}`);

        let data = "";

        this.chapters.forEach((chapter, i) => {
            let offset = chapter.offset;
            if (offset === undefined) return;

            offset -= this.chapters[0].offset || 0;

            data += offset + ","; // offset

            if (i < this.chapters.length - 1) { // not last chapter
                data += (offset + (chapter.duration || 0)) + ",";
            } else { // last chapter
                data += ",";
            }

            data += "\"";
            let label = "";

            if (isTwitchVODChapter(chapter)) {
                `${chapter.game_name || chapter.game_id} (${chapter.title})`;
                label = label.replace(/"/g, "\\\"");
            } else {
                label = chapter.title;
            }

            data += label;
            data += "\"";

            data += "\n";
        });

        await this.stopWatching();

        fs.writeFileSync(csv_path, data);

        this.setPermissions();

        await this.startWatching();

        return fs.existsSync(csv_path);
    }

    public async saveVTTChapters(): Promise<boolean> { return await Promise.resolve(false); }
    public async saveKodiNfo(): Promise<boolean> { return await Promise.resolve(false); }

    /**
     * 
     * @param basename 
     * @deprecated
     * @returns 
     */
    public static hasVod(basename: string): boolean {
        return LiveStreamDVR.getInstance().getVods().findIndex(vod => vod.basename == basename) != -1;
    }

    public static addVod(vod: VODTypes): boolean {

        if (!vod.basename)
            throw new Error("VOD basename is not set!");

        if (this.hasVod(vod.basename))
            throw new Error(`VOD ${vod.basename} is already in cache!`);

        LiveStreamDVR.getInstance().addVod(vod);

        return this.hasVod(vod.basename);
    }

    /**
     * Set up misc data
     * Requires JSON to be loaded
     */
    public async setupAssoc(): Promise<void> {

        if (!this.json) {
            throw new Error("No JSON loaded for assoc setup!");
        }

        // this.video_fail2 = this.json.video_fail2 !== undefined ? this.json.video_fail2 : false;
        this.video_metadata = this.json.video_metadata !== undefined ? this.json.video_metadata : undefined;
        // this.filterMediainfo();

        // this.ads = this.json.ads !== undefined ? this.json.ads : [];
        if (this.json.chapters && this.json.chapters.length > 0) {
            await this.parseChapters(this.json.chapters);
        } else {
            Log.logAdvanced(Log.Level.ERROR, "vod", `No chapters on ${this.basename}!`);
        }

        this.segments_raw = this.json.segments !== undefined ? this.json.segments : [];

        if (this.segments_raw && this.segments_raw.length > 0) {
            await this.parseSegments(this.segments_raw);
        }

        if (this.is_finalized) {
            if (!this.duration) {
                Log.logAdvanced(Log.Level.DEBUG, "vod", `VOD ${this.basename} finalized but no duration, trying to fix`);
                this.getDuration(true);
            }
        }

        if (!this.video_metadata && this.is_finalized && this.segments_raw.length > 0 && Helper.path_mediainfo()) {
            Log.logAdvanced(Log.Level.DEBUG, "vod", `VOD ${this.basename} finalized but no metadata, trying to fix`);
            if (await this.getMediainfo()) {
                await this.saveJSON("fix mediainfo");
            }
        }

        this.stream_number = this.json.stream_number !== undefined ? this.json.stream_number : undefined;
        this.stream_absolute_season = this.json.stream_absolute_season !== undefined ? this.json.stream_absolute_season : undefined;

    }

    public async getDuration(save = false): Promise<number | null> {

        if (this.duration && this.duration > 0) {
            // TwitchHelper.log(Log.Level.DEBUG, "Returning saved duration for " . this.basename . ": " . this.duration_seconds );
            return this.duration;
        }

        const isOldFormat = this.video_metadata && "general" in this.video_metadata;

        if (this.video_metadata && isOldFormat) {
            Log.logAdvanced(Log.Level.WARNING, "vod", `VOD ${this.basename} has old video metadata format.`);
        }

        if (this.video_metadata && !isOldFormat) {

            if (this.video_metadata.size && this.video_metadata.size == 0) {
                Log.logAdvanced(Log.Level.ERROR, "vod", `Invalid video metadata for ${this.basename}!`);
                return null;
            }

            if (this.video_metadata.duration) {
                Log.logAdvanced(Log.Level.DEBUG, "vod", `No duration_seconds but metadata exists for ${this.basename}: ${this.video_metadata.duration}`);
                this.duration = this.video_metadata.duration;
                return this.duration;
            }

            Log.logAdvanced(Log.Level.ERROR, "vod", `Video metadata for ${this.basename} does not include duration!`);

            return null;
        }

        if (this.is_capturing) {
            Log.logAdvanced(Log.Level.DEBUG, "vod", `Can't request duration because ${this.basename} is still recording!`);
            return null;
        }

        if (!this.is_converted || this.is_converting) {
            Log.logAdvanced(Log.Level.DEBUG, "vod", `Can't request duration because ${this.basename} is converting!`);
            return null;
        }

        if (!this.is_finalized) {
            Log.logAdvanced(Log.Level.DEBUG, "vod", `Can't request duration because ${this.basename} is not finalized!`);
            return null;
        }

        if (!this.segments_raw || this.segments_raw.length == 0) {
            Log.logAdvanced(Log.Level.ERROR, "vod", `No video file available for duration of ${this.basename}`);
            return null;
        }

        Log.logAdvanced(Log.Level.DEBUG, "vod", `No mediainfo for getDuration of ${this.basename}`);

        const file = await this.getMediainfo();

        if (!file) {
            Log.logAdvanced(Log.Level.ERROR, "vod", `Could not find duration of ${this.basename}`);
            return null;
        } else {

            // this.duration 			= $file['playtime_string'];
            this.duration = file.duration;

            if (save) {
                Log.logAdvanced(Log.Level.SUCCESS, "vod", `Saved duration for ${this.basename}`);
                await this.saveJSON("duration save");
            }

            Log.logAdvanced(Log.Level.DEBUG, "vod", `Duration fetched for ${this.basename}: ${this.duration}`);

            return this.duration;
        }

        Log.logAdvanced(Log.Level.ERROR, "vod", "Reached end of getDuration for {this.basename}, this shouldn't happen!");
    }

    public async getMediainfo(segment_num = 0): Promise<false | VideoMetadata | AudioMetadata> {

        Log.logAdvanced(Log.Level.INFO, "vod", `Fetching mediainfo of ${this.basename}, segment #${segment_num}`);

        if (!this.directory) {
            throw new Error("No directory set!");
        }

        if (!this.segments_raw || this.segments_raw.length == 0) {
            Log.logAdvanced(Log.Level.ERROR, "vod", `No segments available for mediainfo of ${this.basename}`);
            return false;
        }

        const filename = path.join(this.directory, path.basename(this.segments_raw[segment_num]));

        if (!fs.existsSync(filename)) {
            Log.logAdvanced(Log.Level.ERROR, "vod", `File does not exist for mediainfo of ${this.basename} (${filename} @ ${this.directory})`);
            return false;
        }

        let metadata: VideoMetadata | AudioMetadata;
        try {
            metadata = await Helper.videometadata(filename);
        } catch (e) {
            Log.logAdvanced(Log.Level.ERROR, "vod", `Could not get mediainfo of ${this.basename} (${filename} @ ${this.directory}): ${(e as Error).message}`);
            return false;
        }

        this.video_metadata = metadata;

        return metadata;

    }

    public async parseChapters(raw_chapters: BaseVODChapterJSON[]): Promise<boolean> {
        return false;
    }

    public setupUserData(): void { return; }
    public setupBasic(): void {

        if (!this.json) {
            throw new Error("No JSON loaded for basic setup!");
        }

        this.is_capturing = this.json.is_capturing;
        this.is_converting = this.json.is_converting;
        this.is_finalized = this.json.is_finalized;

        this.duration = this.json.duration ?? undefined;

        this.comment = this.json.comment;
        this.prevent_deletion = this.json.prevent_deletion ?? false;
        this.failed = this.json.failed ?? false;

        this.webpath = `${Config.getInstance().cfg<string>("basepath", "")}/vods/` + path.relative(BaseConfigDataFolder.vod, this.directory);

        if (this.json.export_data) {
            this.exportData = this.json.export_data;
        }

    }
    public setupProvider(): void { return; }

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
            Log.logAdvanced(Log.Level.INFO, "vod", `Deletion of ${this.basename} prevented`);
            throw new Error("Vod has been marked with prevent_deletion");
        }

        Log.logAdvanced(Log.Level.INFO, "vod", `Delete ${this.basename}`, this.associatedFiles);

        await this.stopWatching();

        for (const file of this.associatedFiles) {
            if (fs.existsSync(path.join(this.directory, file))) {
                Log.logAdvanced(Log.Level.DEBUG, "vod", `Delete ${file}`);
                fs.unlinkSync(path.join(this.directory, file));
            }
        }

        const channel = this.getChannel();
        if (channel) channel.removeVod(this.uuid);

        return fs.existsSync(this.filename);

    }

    public async deleteSegment(segmentIndex: number, keepEntry = false): Promise<boolean> {

        if (!this.directory) {
            throw new Error("No directory set for deletion");
        }

        if (this.prevent_deletion) {
            Log.logAdvanced(Log.Level.INFO, "vod.deleteSegment", `Deletion of ${this.basename} segment prevented`);
            throw new Error("Vod has been marked with prevent_deletion");
        }

        Log.logAdvanced(Log.Level.INFO, "vod.deleteSegment", `Delete segment #${segmentIndex} of ${this.basename}`);

        if (segmentIndex >= this.segments_raw.length) {
            Log.logAdvanced(Log.Level.ERROR, "vod.deleteSegment", `Segment #${segmentIndex} does not exist for ${this.basename}`);
            throw new Error("Segment does not exist");
        }

        const file = this.segments[segmentIndex];

        await this.stopWatching();

        if (!file.filename) {
            Log.logAdvanced(Log.Level.ERROR, "vod.deleteSegment", `No filename for segment #${segmentIndex} of ${this.basename}`);
            throw new Error("No filename for segment");
        }

        if (fs.existsSync(file.filename)) {
            Log.logAdvanced(Log.Level.DEBUG, "vod.deleteSegment", `Delete ${file}`);
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
        const old_basename = this.basename;

        Log.logAdvanced(Log.Level.INFO, "vodclass.changeBaseName", `Changing basename from ${old_basename} to ${new_basename}`);

        await this.stopWatching();

        // copy array so it doesn't change during loop
        const associatedFiles = [...this.associatedFiles];

        for (const file of associatedFiles) {
            if (this.segments_raw.map(s => path.basename(s)).includes(file)) {
                Log.logAdvanced(Log.Level.INFO, "vodclass.changeBaseName", `Skip over assoc '${file}' due to it being a segment!`);
                continue;
            }
            const file_path = path.join(this.directory, path.basename(file));
            if (fs.existsSync(file_path)) {
                Log.logAdvanced(Log.Level.INFO, "vodclass.changeBaseName", `Rename assoc '${file_path}' to '${file_path.replaceAll(old_basename, new_basename)}'`);
                fs.renameSync(file_path, file_path.replaceAll(old_basename, new_basename));
            } else {
                Log.logAdvanced(Log.Level.WARNING, "vodclass.changeBaseName", `File assoc '${file_path}' not found!`);
            }
        }

        const new_segments = [];
        for (const segment of this.segments_raw) {
            const file_path = path.join(this.directory, path.basename(segment));
            if (fs.existsSync(file_path)) {
                Log.logAdvanced(Log.Level.INFO, "vodclass.changeBaseName", `Rename segment '${file_path}' to '${file_path.replaceAll(old_basename, new_basename)}'`);
                fs.renameSync(file_path, file_path.replaceAll(old_basename, new_basename));
                new_segments.push(path.basename(file_path.replaceAll(old_basename, new_basename)));
            } else {
                Log.logAdvanced(Log.Level.WARNING, "vodclass.changeBaseName", `Segment '${file_path}' not found!`);
            }
        }

        this.basename = new_basename;
        this.filename = this.filename.replaceAll(old_basename, new_basename);
        await this.setupFiles();
        this.segments_raw = new_segments;
        await this.parseSegments(this.segments_raw);
        await this.saveJSON("basename rename");
        // this.rebuildSegmentList();
        await this.startWatching();
        return true;
    }

    public archive(): void { return; }
    public async downloadVod(quality: VideoQuality = "best"): Promise<boolean> { return await Promise.resolve(false); }
    public async downloadChat(method: "td" | "tcd" = "td"): Promise<boolean> { return await Promise.resolve(false); }
    public async checkMutedVod(save = false): Promise<MuteStatus> { return await Promise.resolve(MuteStatus.UNKNOWN); }
    public async matchProviderVod(force = false): Promise<boolean | undefined> { return await Promise.resolve(false); }

    public addChapter(chapter: BaseVODChapter): void {
        Log.logAdvanced(Log.Level.INFO, "vod.addChapter", `Adding chapter ${chapter.title} to ${this.basename}`);
        this.chapters.push(chapter);
        this.chapters_raw.push(chapter.toJSON()); // needed?
        this.calculateChapters();
    }

    public backupJSON(): void {
        if (fs.existsSync(this.filename)) {
            const backup_file = path.join(BaseConfigDataFolder.backup, `${this.basename}.${Date.now()}.json`);
            Log.logAdvanced(Log.Level.INFO, "vod.backupJSON", `Backing up ${this.basename} to ${backup_file}`);
            fs.copyFileSync(this.filename, backup_file);
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
                fs.chownSync(fullpath, Config.getInstance().cfg("file_chown_uid"), Config.getInstance().cfg("file_chown_gid"));
                fs.chmodSync(fullpath, Config.getInstance().cfg("file_chmod"));
            }
        }

    }

    public getRecordingSize(): number | false {
        if (!this.is_capturing) return false;
        const filename = this.capturingFilename ?? path.join(this.directory, `${this.basename}.ts`);
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


    public issueFixCount = 0;
    public issueFixes: Record<string, boolean> = {};
    /**
     * Fix issues
     * 
     * @returns true if no more issues need fixing, false if more issues need fixing
     */
    public async fixIssues(source = "Unknown"): Promise<boolean> {

        Log.logAdvanced(Log.Level.DEBUG, "vod", `Run fixIssues for VOD ${this.basename} (${source})`);

        if (this.issueFixCount > 10) {
            Log.logAdvanced(Log.Level.WARNING, "vod", `Too many issue fixes for VOD ${this.basename}`);
            return true;
        }

        // if (!this.getChannel()) {
        //     Log.logAdvanced(Log.Level.ERROR, "vod", `VOD ${this.basename} has no channel!`);
        //     return;
        // }

        if (this.not_started) {
            Log.logAdvanced(Log.Level.INFO, "vod", `VOD ${this.basename} not started yet, skipping fix!`);
            this.issueFixCount = 0;
            return true;
        }

        // fix illegal characters
        if (this.basename.match(LiveStreamDVR.filenameIllegalChars) && !this.issueFixes["illegal_chars"]) {
            console.log(chalk.bgRed.whiteBright(`🛠️ [${source}] ${this.basename} contains invalid characters!`));
            const new_basename = this.basename.replaceAll(LiveStreamDVR.filenameIllegalChars, "_");
            this.changeBaseName(new_basename);
            this.issueFixCount++;
            this.issueFixes["illegal_chars"] = true;
            return false;
        }

        if (!this.is_capturing && !this.is_converting && !this.is_finalized && this.segments && this.segments.length > 0) {
            this.segments.forEach((segment) => {
                if (segment.filename && path.extname(segment.filename) !== ".ts") {
                    console.log(chalk.bgRed.whiteBright(`🛠️ [${source}] ${this.basename} has non-ts segments but is not converting!`));
                }
            });
        }

        // if finalized but no segments
        if (this.is_finalized && (!this.segments || this.segments.length === 0) && !this.issueFixes["finalized_no_segments"]) {
            console.log(chalk.bgRed.whiteBright(`🛠️ [${source}] ${this.basename} is finalized but no segments found, rebuilding!`));
            const segs = await this.rebuildSegmentList();
            if (segs) {
                await this.saveJSON("fix rebuild segment list");
                this.issueFixCount++;
                this.issueFixes["finalized_no_segments"] = true;
                return false;
            } else {
                console.log(chalk.bgRed.whiteBright(`🛠️ [${source}] ${this.basename} could not be rebuilt!`));
                this.issueFixes["finalized_no_segments"] = true;
            }
        }

        // finalize if finished converting and not yet finalized
        if (this.is_converted && !this.is_finalized && this.segments.length > 0 && !this.issueFixes["converted_finalize"]) {
            console.log(chalk.bgRed.whiteBright(`🛠️ [${source}] ${this.basename} is finished converting but not finalized, finalizing now!`));
            await this.finalize();
            await this.saveJSON("fix finalize");
            this.issueFixCount++;
            this.issueFixes["converted_finalize"] = true;
            return false;
        }

        // if capturing but process not running
        if (this.is_capturing && await this.getCapturingStatus(true) !== JobStatus.RUNNING && !this.issueFixes["capture_not_running"]){
            console.log(chalk.bgRed.whiteBright(`🛠️ [${source}] ${this.basename} is capturing but process not running. Setting to false for fixing.`));
            this.is_capturing = false;
            await this.saveJSON("fix set capturing to false");
            this.issueFixCount++;
            this.issueFixes["capture_not_running"] = true;
            return false;
        }

        // if converting but process not running
        if (this.is_converting && await this.getConvertingStatus() !== JobStatus.RUNNING && !this.issueFixes["convert_not_running"]) {
            console.log(chalk.bgRed.whiteBright(`🛠️ [${source}] ${this.basename} is converting but process not running. Setting to false for fixing.`));
            this.is_converting = false;
            await this.saveJSON("fix set converting to false");
            this.issueFixCount++;
            this.issueFixes["convert_not_running"] = true;
            return false;
        }

        // if not finalized and no segments found
        if (!this.is_finalized && (!this.segments || this.segments.length === 0) && !this.issueFixes["not_finalized_no_segments"]) {
            console.log(chalk.bgRed.whiteBright(`🛠️ [${source}] ${this.basename} is not finalized and no segments found.`));
            await this.rebuildSegmentList();
            if (this.segments.length > 0) {
                await this.saveJSON("fix rebuild segment list");
                this.issueFixCount++;
                this.issueFixes["not_finalized_no_segments"] = true;
                return false;
            } else {
                console.log(chalk.bgRed.whiteBright(`🛠️ [${source}] ${this.basename} could not be rebuilt!`));
                // this.issueFixCount++;
                this.issueFixes["not_finalized_no_segments"] = true;
                return false;
            }
        }

        // remux if not yet remuxed
        if (!this.is_capturing && !this.is_converted && !this.is_finalized && !this.issueFixes["not_remuxed"]) {
            if (fs.existsSync(path.join(this.directory, `${this.basename}.ts`))) {
                console.log(chalk.bgRed.whiteBright(`${this.basename} is not yet remuxed, remuxing now!`));

                let channel;
                try {
                    channel = this.getChannel();
                } catch (error) {
                    console.log(chalk.bgRed.whiteBright(`🛠️ [${source}] ${this.basename} has no channel!`));
                }

                if (channel) {
                    const container_ext =
                        channel && channel.quality && channel.quality[0] === "audio_only" ?
                            Config.AudioContainer :
                            Config.getInstance().cfg("vod_container", "mp4");

                    const in_file = path.join(this.directory, `${this.basename}.ts`);
                    const out_file = path.join(this.directory, `${this.basename}.${container_ext}`);

                    if (fs.existsSync(out_file)) {
                        console.log(chalk.bgRed.whiteBright(`🛠️ [${source}] Converted file '${out_file}' for '${this.basename}' already exists, skipping remux!`));
                    } else {
                        this.is_converting = true;
                        Helper.remuxFile(in_file, out_file)
                            .then(async status => {
                                console.log(chalk.bgRed.whiteBright(`🛠️ [${source}] ${this.basename} remux status: ${status.success}`));
                                this.addSegment(`${this.basename}.${container_ext}`);
                                this.is_converting = false;
                                await this.finalize();
                                await this.saveJSON("fix remux");
                            }).catch(async e => {
                                console.log(chalk.bgRed.whiteBright(`🛠️ [${source}] ${this.basename} remux failed: ${e.message}`));
                                this.is_converting = false;
                                await this.saveJSON("fix remux failed");
                            });
                        this.issueFixCount++;
                        this.issueFixes["not_remuxed"] = true;
                        return false;
                    }
                }
            } else {
                console.log(chalk.bgRed.whiteBright(`🛠️ [${source}] ${this.basename} is not yet remuxed but no ts file found, skipping!`));

                if (fs.existsSync(path.join(this.directory, `${this.basename}.mp4`))) {
                    console.log(chalk.bgRed.whiteBright(`🛠️ [${source}] ${this.basename} has an mp4 file but is not finalized!`));
                    this.addSegment(`${this.basename}.mp4`);
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
        if (this.is_finalized && !this.ended_at && !this.issueFixes["no_ended_at"]) {
            console.log(chalk.bgRed.whiteBright(`🛠️ [${source}] ${this.basename} is finalized but no ended_at found, fixing!`));
            const duration = await this.getDuration();
            if (duration && this.started_at) {
                this.ended_at = new Date(this.started_at.getTime() + (duration * 1000));
                await this.saveJSON("fix set ended_at");
                this.issueFixCount++;
                this.issueFixes["no_ended_at"] = true;
                return false;
            } else {
                console.log(chalk.bgRed.whiteBright(`🛠️ [${source}] ${this.basename} has no duration or started_at, skipping!`));
            }
            this.issueFixes["no_ended_at"] = true;
        }

        // add default chapter
        if (this.is_finalized && (!this.chapters || this.chapters.length === 0) && isTwitchVOD(this) && !this.issueFixes["no_default_chapter"]) {
            console.log(chalk.bgRed.whiteBright(`🛠️ [${source}] ${this.basename} is finalized but no chapters found, fixing now!`));
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
            this.segments.length === 0
            && !this.failed &&
            !this.issueFixes["all_else_fails"]
        ) {
            console.log(chalk.bgRed.whiteBright(`🛠️ [${source}] ${this.basename} is not finalized, converting, capturing or converting, failed recording?`));
            this.failed = true;
            await this.saveJSON("fix set failed true");
            this.issueFixCount++;
            this.issueFixes["all_else_fails"] = true;
            return false;
        }

        // if failed but actually not
        if (this.failed && this.is_finalized && this.segments.length > 0 && !this.issueFixes["failed_but_not"]) {
            console.log(chalk.bgRed.whiteBright(`🛠️ [${source}] ${this.basename} is failed but is finalized, fixing!`));
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
        if (this.is_finalized && this.segments.length > 0 && this.duration === 0 && !this.issueFixes["finalized_but_no_duration"]) {
            console.log(chalk.bgRed.whiteBright(`🛠️ [${source}] ${this.basename} is finalized but has segments and duration is 0, fixing!`));
            const duration = await this.getDuration(true);
            console.log(chalk.bgRed.whiteBright(`🛠️ [${source}] ${this.basename} duration: ${duration}`));
            if (duration) {
                this.issueFixCount++;
                this.issueFixes["finalized_but_no_duration"] = true;
                return false;
            } else {
                console.log(chalk.bgRed.whiteBright(`🛠️ [${source}] ${this.basename} has no duration`));
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

        Log.logAdvanced(Log.Level.DEBUG, "vod", `fixIssues meta dump for ${this.basename} (${this.uuid})`, {
            "channel_uuid": this.channel_uuid,
            "channel_name": this.getChannel().internalName,
            "uuid": this.uuid,

            "basename": this.basename,
            "is_capturing": this.is_capturing,
            "is_converting": this.is_converting,
            "is_converted": this.is_converted,
            "is_finalized": this.is_finalized,
            "chapter_count": this.chapters.length,
            "segment_count": this.segments.length,
            "has_started_at": this.started_at !== undefined,
            "has_ended_at": this.ended_at !== undefined,
            "not_started": this.not_started,
        });

        if (this.issueFixCount > 0) {
            console.log(chalk.bgRed.whiteBright(`🛠️ [${source}] ${this.basename} fixed ${this.issueFixCount} issues!`));
        }

        // this.issueFixCount = 0; // TODO: should it be set to 0?
        return true;

    }

    /**
     * Rebuild segment list from video files named as basename and parse it
     * @saves
     * @returns 
     */
    public async rebuildSegmentList(includeMisnamedFiles = false): Promise<boolean> {

        Log.logAdvanced(Log.Level.INFO, "vod.rebuildSegmentList", `Rebuilding segment list for ${this.basename}`);

        let files: string[];

        if (this.directory !== Helper.vodFolder(this.getChannel().internalName)) { // is not in vod folder root, TODO: channel might not be added yet
            Log.logAdvanced(Log.Level.INFO, "vod.rebuildSegmentList", `VOD ${this.basename} has its own folder (${this.directory}), find all files.`);
            files = fs.readdirSync(this.directory).filter(file =>
                (
                    file.endsWith(`.${Config.getInstance().cfg("vod_container", "mp4")}`) ||
                    file.endsWith(Config.AudioContainer)
                ) &&
                !file.includes("_vod") && !file.includes("_chat") && !file.includes("_chat_mask") && !file.includes("_burned")
            );
        } else {
            Log.logAdvanced(Log.Level.INFO, "vod.rebuildSegmentList", `VOD ${this.basename} does not have a folder, find by basename.`);
            files = fs.readdirSync(this.directory).filter(file =>
                file.startsWith(this.basename) &&
                (
                    file.endsWith(`.${Config.getInstance().cfg("vod_container", "mp4")}`) ||
                    file.endsWith(Config.AudioContainer)
                ) &&
                !file.includes("_vod") && !file.includes("_chat") && !file.includes("_chat_mask") && !file.includes("_burned")
            );
        }

        if (!includeMisnamedFiles) {
            files = files.filter(file => file.startsWith(this.basename));
        }

        if (!files || files.length == 0) {
            Log.logAdvanced(Log.Level.ERROR, "vod.rebuildSegmentList", `No segments found for ${this.basename}, can't rebuild segment list`);
            return false;
        }

        if (files.length > 1) {
            Log.logAdvanced(Log.Level.WARNING, "vod.rebuildSegmentList", `Found more than one segment for ${this.basename} (${files.length})`);
        }

        this.segments_raw = [];
        this.segments = [];

        files.forEach(file => this.addSegment(path.basename(file)));

        // this.parseSegments(this.segments_raw);
        await this.saveJSON("segments rebuild");

        return true;

    }

}