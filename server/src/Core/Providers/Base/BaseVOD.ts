import chalk from "chalk";
import chokidar from "chokidar";
import { format, parseJSON } from "date-fns";
import fs from "fs";
import path from "path";
import { BaseVODChapterJSON, VODJSON } from "Storage/JSON";
import { ApiBaseVod } from "../../../../../common/Api/Client";
import { VideoQuality } from "../../../../../common/Config";
import { MuteStatus, Providers } from "../../../../../common/Defs";
import { AudioMetadata, VideoMetadata } from "../../../../../common/MediaInfo";
import { VodUpdated } from "../../../../../common/Webhook";
import { FFmpegMetadata } from "../../../Core/FFmpegMetadata";
import { Helper } from "../../../Core/Helper";
import { isTwitchVOD, isTwitchVODChapter } from "../../../Helpers/Types";
import { BaseConfigCacheFolder, BaseConfigDataFolder } from "../../BaseConfig";
import { ClientBroker } from "../../ClientBroker";
import { Config } from "../../Config";
import { LiveStreamDVR, VODTypes } from "../../LiveStreamDVR";
import { Log, LOGLEVEL } from "../../Log";
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
                Log.logAdvanced(LOGLEVEL.ERROR, "vod.watch", `VOD ${this.basename} has no channel UUID!`);
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
                    Log.logAdvanced(LOGLEVEL.WARNING, "vodclass", `VOD JSON ${this.basename} deleted!`);
                    if (LiveStreamDVR.getInstance().vods.find(v => v.basename == this.basename)) {
                        Log.logAdvanced(LOGLEVEL.WARNING, "vodclass", `VOD ${this.basename} still in memory!`);

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
                    Log.logAdvanced(LOGLEVEL.DEBUG, "vodclass", `VOD JSON ${this.basename} exists (again?) ${eventType}`);
                }
            } else if (this.segments.some(s => s.filename === filename)) {
                if (Config.debug) console.debug(`VOD segment ${filename} changed (${eventType})!`);
                Log.logAdvanced(LOGLEVEL.INFO, "vod.watch", `VOD segment ${filename} changed (${eventType})!`);
                ClientBroker.notify(
                    "Segment changed externally",
                    path.basename(filename),
                    undefined,
                    "system"
                );
            } else {
                if (Config.debug) console.debug(`VOD file ${filename} changed (${eventType})!`);
                Log.logAdvanced(LOGLEVEL.INFO, "vod.watch", `VOD file ${filename} changed (${eventType})!`);
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
    public addSegment(segment: string): void {
        Log.logAdvanced(LOGLEVEL.INFO, "vod.addSegment", `Adding segment ${segment} to ${this.basename}`);
        this.segments_raw.push(segment);
        this.parseSegments(this.segments_raw);
    }

    public parseSegments(array: string[]): false | undefined {

        if (!this.directory) {
            throw new Error("TwitchVOD.parseSegments: directory is not set");
        }

        if (!array) {
            Log.logAdvanced(LOGLEVEL.ERROR, "vod.parseSegments", `No segment data supplied on ${this.basename}`);

            if (!this.segments_raw) {
                Log.logAdvanced(LOGLEVEL.ERROR, "vod.parseSegments", `No segment_raw data on ${this.basename}, calling rebuild...`);
                this.rebuildSegmentList();
            }

            return false;
        }

        this.total_size = 0;

        const segments: BaseVODSegment[] = [];

        for (const raw_segment of array) {

            if (typeof raw_segment !== "string") {
                Log.logAdvanced(LOGLEVEL.ERROR, "vod.parseSegments", `Segment list containing invalid data for ${this.basename}, rebuilding...`);
                this.rebuildSegmentList();
                return;
            }

            const base_segment = path.basename(raw_segment);

            // find invalid characters for windows
            if (base_segment.match(LiveStreamDVR.filenameIllegalChars)) {
                Log.logAdvanced(LOGLEVEL.ERROR, "vod.parseSegments", `Segment list containing invalid characters for ${this.basename}: ${base_segment}`);
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
    rebuildSegmentList() {
        throw new Error("Method not implemented.");
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

        Log.logAdvanced(LOGLEVEL.INFO, "vodclass", `Render chat for ${this.basename}`);

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

        Log.logAdvanced(LOGLEVEL.INFO, "vodclass", `Running ${bin} ${args.join(" ")}`);

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
                    Log.logAdvanced(LOGLEVEL.INFO, "vodclass", `Chat render fetching: ${data}`);
                } else if (data.includes("Rendering Comments")) {
                    Log.logAdvanced(LOGLEVEL.INFO, "vodclass", "Comments now rendering!");
                } else if (data.trim() == "[STATUS] - Rendering Video 0%") {
                    Log.logAdvanced(LOGLEVEL.INFO, "vodclass", "Chat history now rendering!");
                } else if (data.includes("FINISHED")) {
                    Log.logAdvanced(LOGLEVEL.INFO, "vodclass", "Chat render finished!");
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
                    Log.logAdvanced(LOGLEVEL.INFO, "vodclass", `Chat rendered for ${this.basename} (code ${code})`);
                    resolve(true);
                } else {
                    Log.logAdvanced(LOGLEVEL.ERROR, "vodclass", `Chat couldn't be rendered for ${this.basename} (code ${code})`);
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

        Log.logAdvanced(LOGLEVEL.INFO, "vodclass", `Burn chat for ${this.basename}`);

        if (this.path_chatburn && fs.existsSync(this.path_chatburn) && !overwrite) {
            Log.logAdvanced(LOGLEVEL.INFO, "vodclass", `Chat already burned for ${this.basename}`);
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
            Log.logAdvanced(LOGLEVEL.INFO, "vodclass", `Using start offset for chat: ${startOffset}`);
        }

        // chat render
        args.push("-i", this.path_chatrender);


        // chat mask offset
        if (startOffset) {
            args.push("-ss", startOffset.toString());
            Log.logAdvanced(LOGLEVEL.INFO, "vodclass", `Using start offset for chat mask: ${startOffset}`);
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
                    Log.logAdvanced(LOGLEVEL.INFO, "vodclass", `Chat burned for ${this.basename} (code ${code})`);
                    resolve(true);
                } else {
                    Log.logAdvanced(LOGLEVEL.ERROR, "vodclass", `Chat couldn't be burned for ${this.basename} (code ${code})`);
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
                Log.logAdvanced(LOGLEVEL.INFO, "vod.removeShortChapters", `Keeping chapter ${chapter.title} with duration ${chapter.duration} on ${this.basename}`);
                return true;
            } else if (chapter.duration === undefined) {
                Log.logAdvanced(LOGLEVEL.ERROR, "vod.removeShortChapters", `Chapter ${chapter.title} has undefined duration on ${this.basename}`);
                return true;
            } else {
                Log.logAdvanced(LOGLEVEL.INFO, "vod.removeShortChapters", `Removing chapter ${chapter.title} with duration ${chapter.duration} on ${this.basename}`);
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
            Log.logAdvanced(LOGLEVEL.ERROR, "vod.calculateChapters", `No start time found for ${this.basename}, can't calculate chapters`);
            return false;
        }

        if (!this.chapters || this.chapters.length == 0) {
            Log.logAdvanced(LOGLEVEL.ERROR, "vod.calculateChapters", `No chapters found for ${this.basename}, can't calculate chapters`);
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
    public saveFFMPEGChapters(): boolean {

        if (!this.directory) {
            throw new Error("TwitchVOD.saveFFMPEGChapters: directory is not set");
        }

        if (!this.chapters || this.chapters.length == 0) {
            // throw new Error('TwitchVOD.saveFFMPEGChapters: chapters are not set');
            return false;
        }

        Log.logAdvanced(LOGLEVEL.INFO, "vod.saveFFMPEGChapters", `Saving FFMPEG chapters file for ${this.basename} to ${this.path_ffmpegchapters}`);

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
            meta.addChapter(start, end, title, "1/1000", [
                isTwitchVODChapter(chapter) ? `Game ID: ${chapter.game_id}` : "",
                isTwitchVODChapter(chapter) ? `Game Name: ${chapter.game_name}` : "",
                `Title: ${chapter.title}`,
                `Offset: ${offset}`,
                `Duration: ${duration}`,
                isTwitchVODChapter(chapter) ? `Viewer count: ${chapter.viewer_count}` : "",
                `Started at: ${chapter.started_at.toISOString()}`,
            ]);
        });

        fs.writeFileSync(this.path_ffmpegchapters, meta.getString(), { encoding: "utf8" });

        this.setPermissions();

        return fs.existsSync(this.path_ffmpegchapters);

    }

    public reencodeSegments(addToSegments = false, deleteOriginal = false): Promise<boolean> {

        Log.logAdvanced(LOGLEVEL.INFO, "vodclass", `Reencoding segments of ${this.filename}`);

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
                    Log.logAdvanced(LOGLEVEL.ERROR, "helper", `Process ${process.pid} error: ${err}`);
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
                        Log.logAdvanced(LOGLEVEL.SUCCESS, "helper", `Reencoded ${file_in_path} to ${file_out_path}`);
                        if (deleteOriginal) {
                            // fs.unlinkSync(file_in_path);
                        }
                        if (addToSegments) {
                            this.addSegment(path.basename(file_out_path));
                        }
                        resolve(true);
                    } else {
                        Log.logAdvanced(LOGLEVEL.ERROR, "helper", `Failed to reencode ${path.basename(file_in_path)} to ${path.basename(file_out_path)}`);
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
            Log.logAdvanced(LOGLEVEL.SUCCESS, "helper", `Successfully reencoded ${this.basename}`);
            return true;
        }).catch((err) => {
            console.debug("Reencoded error", err);
            Log.logAdvanced(LOGLEVEL.ERROR, "helper", `Failed to reencode ${this.basename}: ${(err as Error).message}`);
            return false;
        }).finally(() => {
            this.startWatching();
        });

    }

    get is_converted(): boolean {
        if (!this.directory) return false;
        if (!this.segments || this.segments.length == 0) return false;
        if (this.is_converting) return false;
        return this.segments.some(segment => segment.filename && fs.existsSync(segment.filename) && fs.statSync(segment.filename).size > 0);
    }

    get stream_season(): string | undefined {
        if (!this.started_at) return undefined;
        return format(this.started_at, Config.SeasonFormat);
    }

    async fixIssues(): Promise<void> {
        return;
    }

    public setupFiles(): void {

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
                    this.saveLosslessCut();
                }
                if (!fs.existsSync(this.path_ffmpegchapters)) {
                    this.saveFFMPEGChapters();
                }
                if (!fs.existsSync(this.path_vttchapters)) {
                    this.saveVTTChapters();
                }
                if (!fs.existsSync(this.path_kodinfo) && Config.getInstance().cfg("create_kodi_nfo")) {
                    this.saveKodiNfo();
                }
            } catch (error) {
                Log.logAdvanced(LOGLEVEL.ERROR, "vodclass", `Could not save associated files for ${this.basename}: ${(error as Error).message}`);
            }
        }
    }

    public saveLosslessCut(): boolean {

        if (!this.directory) {
            throw new Error("TwitchVOD.saveLosslessCut: directory is not set");
        }

        if (!this.chapters || this.chapters.length == 0) {
            // throw new Error('TwitchVOD.saveLosslessCut: chapters are not set');
            return false;
        }

        // $csv_path = $this->directory . DIRECTORY_SEPARATOR . $this->basename . '-llc-edl.csv';
        const csv_path = path.join(this.directory, `${this.basename}-llc-edl.csv`);

        Log.logAdvanced(LOGLEVEL.INFO, "vod.saveLosslessCut", `Saving lossless cut csv for ${this.basename} to ${csv_path}`);

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

        fs.writeFileSync(csv_path, data);

        this.setPermissions();

        return fs.existsSync(csv_path);
    }

    public saveVTTChapters(): boolean { return false; }
    public saveKodiNfo(): boolean { return false; }

    public static hasVod(basename: string): boolean {
        return LiveStreamDVR.getInstance().vods.findIndex(vod => vod.basename == basename) != -1;
    }

    public static addVod(vod: VODTypes): boolean {

        if (!vod.basename)
            throw new Error("VOD basename is not set!");

        if (this.hasVod(vod.basename))
            throw new Error(`VOD ${vod.basename} is already in cache!`);

        LiveStreamDVR.getInstance().vods.push(vod);

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
            Log.logAdvanced(LOGLEVEL.ERROR, "vodclass", `No chapters on ${this.basename}!`);
        }

        this.segments_raw = this.json.segments !== undefined ? this.json.segments : [];

        if (this.segments_raw && this.segments_raw.length > 0) {
            this.parseSegments(this.segments_raw);
        }

        if (this.is_finalized) {
            if (!this.duration) {
                Log.logAdvanced(LOGLEVEL.DEBUG, "vodclass", `VOD ${this.basename} finalized but no duration, trying to fix`);
                this.getDuration(true);
            }
        }

        if (!this.video_metadata && this.is_finalized && this.segments_raw.length > 0 && Helper.path_mediainfo()) {
            Log.logAdvanced(LOGLEVEL.DEBUG, "vodclass", `VOD ${this.basename} finalized but no metadata, trying to fix`);
            if (await this.getMediainfo()) {
                await this.saveJSON("fix mediainfo");
            }
        }

        this.stream_number = this.json.stream_number !== undefined ? this.json.stream_number : undefined;

    }

    public async getDuration(save = false): Promise<number | null> {

        if (this.duration && this.duration > 0) {
            // TwitchHelper.log(LOGLEVEL.DEBUG, "Returning saved duration for " . this.basename . ": " . this.duration_seconds );
            return this.duration;
        }

        const isOldFormat = this.video_metadata && "general" in this.video_metadata;

        if (this.video_metadata && isOldFormat) {
            Log.logAdvanced(LOGLEVEL.WARNING, "vodclass", `VOD ${this.basename} has old video metadata format.`);
        }

        if (this.video_metadata && !isOldFormat) {

            if (this.video_metadata.size && this.video_metadata.size == 0) {
                Log.logAdvanced(LOGLEVEL.ERROR, "vodclass", `Invalid video metadata for ${this.basename}!`);
                return null;
            }

            if (this.video_metadata.duration) {
                Log.logAdvanced(LOGLEVEL.DEBUG, "vodclass", `No duration_seconds but metadata exists for ${this.basename}: ${this.video_metadata.duration}`);
                this.duration = this.video_metadata.duration;
                return this.duration;
            }

            Log.logAdvanced(LOGLEVEL.ERROR, "vodclass", `Video metadata for ${this.basename} does not include duration!`);

            return null;
        }

        if (this.is_capturing) {
            Log.logAdvanced(LOGLEVEL.DEBUG, "vodclass", `Can't request duration because ${this.basename} is still recording!`);
            return null;
        }

        if (!this.is_converted || this.is_converting) {
            Log.logAdvanced(LOGLEVEL.DEBUG, "vodclass", `Can't request duration because ${this.basename} is converting!`);
            return null;
        }

        if (!this.is_finalized) {
            Log.logAdvanced(LOGLEVEL.DEBUG, "vodclass", `Can't request duration because ${this.basename} is not finalized!`);
            return null;
        }

        if (!this.segments_raw || this.segments_raw.length == 0) {
            Log.logAdvanced(LOGLEVEL.ERROR, "vodclass", `No video file available for duration of ${this.basename}`);
            return null;
        }

        Log.logAdvanced(LOGLEVEL.DEBUG, "vodclass", `No mediainfo for getDuration of ${this.basename}`);

        const file = await this.getMediainfo();

        if (!file) {
            Log.logAdvanced(LOGLEVEL.ERROR, "vodclass", `Could not find duration of ${this.basename}`);
            return null;
        } else {

            // this.duration 			= $file['playtime_string'];
            this.duration = file.duration;

            if (save) {
                Log.logAdvanced(LOGLEVEL.SUCCESS, "vodclass", `Saved duration for ${this.basename}`);
                await this.saveJSON("duration save");
            }

            Log.logAdvanced(LOGLEVEL.DEBUG, "vodclass", `Duration fetched for ${this.basename}: ${this.duration}`);

            return this.duration;
        }

        Log.logAdvanced(LOGLEVEL.ERROR, "vodclass", "Reached end of getDuration for {this.basename}, this shouldn't happen!");
    }

    public async getMediainfo(segment_num = 0): Promise<false | VideoMetadata | AudioMetadata> {

        Log.logAdvanced(LOGLEVEL.INFO, "vodclass", `Fetching mediainfo of ${this.basename}, segment #${segment_num}`);

        if (!this.directory) {
            throw new Error("No directory set!");
        }

        if (!this.segments_raw || this.segments_raw.length == 0) {
            Log.logAdvanced(LOGLEVEL.ERROR, "vodclass", `No segments available for mediainfo of ${this.basename}`);
            return false;
        }

        const filename = path.join(this.directory, path.basename(this.segments_raw[segment_num]));

        if (!fs.existsSync(filename)) {
            Log.logAdvanced(LOGLEVEL.ERROR, "vodclass", `File does not exist for mediainfo of ${this.basename} (${filename} @ ${this.directory})`);
            return false;
        }

        let metadata: VideoMetadata | AudioMetadata;
        try {
            metadata = await Helper.videometadata(filename);
        } catch (e) {
            Log.logAdvanced(LOGLEVEL.ERROR, "vodclass", `Could not get mediainfo of ${this.basename} (${filename} @ ${this.directory}): ${(e as Error).message}`);
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
            Log.logAdvanced(LOGLEVEL.INFO, "vodclass", `Deletion of ${this.basename} prevented`);
            throw new Error("Vod has been marked with prevent_deletion");
        }

        Log.logAdvanced(LOGLEVEL.INFO, "vodclass", `Delete ${this.basename}`, this.associatedFiles);

        await this.stopWatching();

        for (const file of this.associatedFiles) {
            if (fs.existsSync(path.join(this.directory, file))) {
                Log.logAdvanced(LOGLEVEL.DEBUG, "vodclass", `Delete ${file}`);
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
            Log.logAdvanced(LOGLEVEL.INFO, "vod.deleteSegment", `Deletion of ${this.basename} segment prevented`);
            throw new Error("Vod has been marked with prevent_deletion");
        }

        Log.logAdvanced(LOGLEVEL.INFO, "vod.deleteSegment", `Delete segment #${segmentIndex} of ${this.basename}`);

        if (segmentIndex >= this.segments_raw.length) {
            Log.logAdvanced(LOGLEVEL.ERROR, "vod.deleteSegment", `Segment #${segmentIndex} does not exist for ${this.basename}`);
            throw new Error("Segment does not exist");
        }

        const file = this.segments[segmentIndex];

        await this.stopWatching();

        if (!file.filename) {
            Log.logAdvanced(LOGLEVEL.ERROR, "vod.deleteSegment", `No filename for segment #${segmentIndex} of ${this.basename}`);
            throw new Error("No filename for segment");
        }

        if (fs.existsSync(file.filename)) {
            Log.logAdvanced(LOGLEVEL.DEBUG, "vod.deleteSegment", `Delete ${file}`);
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

        Log.logAdvanced(LOGLEVEL.INFO, "vodclass.changeBaseName", `Changing basename from ${old_basename} to ${new_basename}`);

        await this.stopWatching();

        // copy array so it doesn't change during loop
        const associatedFiles = [...this.associatedFiles];

        for (const file of associatedFiles) {
            if (this.segments_raw.map(s => path.basename(s)).includes(file)) {
                Log.logAdvanced(LOGLEVEL.INFO, "vodclass.changeBaseName", `Skip over assoc '${file}' due to it being a segment!`);
                continue;
            }
            const file_path = path.join(this.directory, path.basename(file));
            if (fs.existsSync(file_path)) {
                Log.logAdvanced(LOGLEVEL.INFO, "vodclass.changeBaseName", `Rename assoc '${file_path}' to '${file_path.replaceAll(old_basename, new_basename)}'`);
                fs.renameSync(file_path, file_path.replaceAll(old_basename, new_basename));
            } else {
                Log.logAdvanced(LOGLEVEL.WARNING, "vodclass.changeBaseName", `File assoc '${file_path}' not found!`);
            }
        }

        const new_segments = [];
        for (const segment of this.segments_raw) {
            const file_path = path.join(this.directory, path.basename(segment));
            if (fs.existsSync(file_path)) {
                Log.logAdvanced(LOGLEVEL.INFO, "vodclass.changeBaseName", `Rename segment '${file_path}' to '${file_path.replaceAll(old_basename, new_basename)}'`);
                fs.renameSync(file_path, file_path.replaceAll(old_basename, new_basename));
                new_segments.push(path.basename(file_path.replaceAll(old_basename, new_basename)));
            } else {
                Log.logAdvanced(LOGLEVEL.WARNING, "vodclass.changeBaseName", `Segment '${file_path}' not found!`);
            }
        }

        this.basename = new_basename;
        this.filename = this.filename.replaceAll(old_basename, new_basename);
        this.setupFiles();
        this.segments_raw = new_segments;
        this.parseSegments(this.segments_raw);
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
        Log.logAdvanced(LOGLEVEL.INFO, "vod.addChapter", `Adding chapter ${chapter.title} to ${this.basename}`);
        this.chapters.push(chapter);
        this.chapters_raw.push(chapter.toJSON()); // needed?
        this.calculateChapters();
    }

    public backupJSON(): void {
        if (fs.existsSync(this.filename)) {
            const backup_file = path.join(BaseConfigDataFolder.backup, `${this.basename}.${Date.now()}.json`);
            Log.logAdvanced(LOGLEVEL.INFO, "vod.backupJSON", `Backing up ${this.basename} to ${backup_file}`);
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

}