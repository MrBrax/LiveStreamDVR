import { VODChapter } from "./VODChapter";
import chokidar from "chokidar";
import path from "path";
import { ClientBroker } from "./ClientBroker";
import { Config } from "./Config";
import { LiveStreamDVR } from "./LiveStreamDVR";
import { Log, LOGLEVEL } from "./Log";
import { TwitchVOD } from "./TwitchVOD";
import fs from "fs";
import { VChannel } from "./VChannel";
import { VODSegment } from "./VODSegment";
import { VideoMetadata, AudioMetadata } from "../../../common/MediaInfo";
import { parseJSON } from "date-fns";
import { VODJSON } from "Storage/JSON";

export class VOD {

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

    chapters: VODChapter[] = [];

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

    /**
     * An array of strings containing the file paths of the segments.
     */
    segments_raw: string[] = [];
    segments: VODSegment[] = [];

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
                        TwitchVOD.cleanLingeringVODs();
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

    public getChannel(): VChannel | undefined {
        throw new Error("Not implemented");
    }

    public realpath(expanded_path: string): string {
        return path.normalize(expanded_path);
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

}