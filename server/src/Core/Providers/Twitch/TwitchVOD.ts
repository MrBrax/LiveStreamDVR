import { progressOutput } from "@/Helpers/Console";
import {
    execAdvanced,
    execSimple,
    isExecReturn,
    startJob,
} from "@/Helpers/Execute";
import { validateAbsolutePath, validateFilename } from "@/Helpers/Filesystem";
import { formatDuration, formatSubtitleDuration } from "@/Helpers/Format";
import { xClearInterval, xInterval, xTimeout } from "@/Helpers/Timeout";
import { isTwitchVOD } from "@/Helpers/Types";
import { ffprobe, remuxFile } from "@/Helpers/Video";
import type { ApiTwitchVod } from "@common/Api/Client";
import type { TwitchComment, TwitchCommentDump } from "@common/Comments";
import type { VideoQuality } from "@common/Config";
import type { Providers } from "@common/Defs";
import { JobStatus, MuteStatus } from "@common/Defs";
import type { AudioStream, FFProbe, VideoStream } from "@common/FFProbe";
import { formatString } from "@common/Format";
import type { VideoMetadata } from "@common/MediaInfo";
import type { ProxyVideo } from "@common/Proxies/Video";
import type { VodBasenameWithChapterTemplate } from "@common/Replacements";
import type { Clip, ClipsResponse } from "@common/TwitchAPI/Clips";
import type {
    GqlVideoChapterResponse,
    VideoMomentEdge,
} from "@common/TwitchAPI/GQL/VideoChapter";
import type { GqlVideoInfoResponse } from "@common/TwitchAPI/GQL/VideoInfo";
import type {
    Video,
    VideoRequestParams,
    VideosResponse,
} from "@common/TwitchAPI/Video";
import axios from "axios";
import chalk from "chalk";
import chokidar from "chokidar";
import { format, parseJSON } from "date-fns";
import { encode as htmlentities } from "html-entities";
import fs from "node:fs";
import path from "node:path";
import sanitize from "sanitize-filename";
import { TwitchHelper } from "../../../Providers/Twitch";
import type {
    TwitchVODChapterJSON,
    TwitchVODJSON,
} from "../../../Storage/JSON";
import {
    AppName,
    BaseConfigCacheFolder,
    BaseConfigDataFolder,
} from "../../BaseConfig";
import { ClientBroker } from "../../ClientBroker";
import { Config } from "../../Config";
import { FFmpegMetadata } from "../../FFmpegMetadata";
import { Helper } from "../../Helper";
import { Job } from "../../Job";
import { LiveStreamDVR } from "../../LiveStreamDVR";
import { LOGLEVEL, censoredLogWords, log } from "../../Log";
import { Webhook } from "../../Webhook";
import { BaseVOD } from "../Base/BaseVOD";
import { TwitchChannel } from "./TwitchChannel";
import type { TwitchGame } from "./TwitchGame";
import { TwitchVODChapter } from "./TwitchVODChapter";

/**
 * Twitch VOD
 *
 * @warning **Do NOT create this class directly. Use TwitchChannel.createVOD() instead.**
 */
export class TwitchVOD extends BaseVOD {
    public provider: Providers = "twitch";

    json?: TwitchVODJSON;

    chapters_raw: Array<TwitchVODChapterJSON> = [];
    chapters: Array<TwitchVODChapter> = [];

    /** @deprecated Use external_vod_id instead */
    twitch_vod_id?: string;
    /** @deprecated Use external_vod_duration instead */
    twitch_vod_duration?: number;
    /** @deprecated Use external_vod_title instead */
    twitch_vod_title?: string;
    /** @deprecated Use external_vod_date instead */
    twitch_vod_date?: string;
    twitch_vod_muted?: MuteStatus;
    // twitch_vod_status?: ExistStatus;
    twitch_vod_neversaved?: boolean;
    /** @deprecated Use external_vod_exists instead */
    twitch_vod_exists?: boolean;
    twitch_vod_attempted?: boolean;

    // duration_live: number | undefined;

    /*
    public ?bool $api_hasFavouriteGame = null;
    public ?array $api_getUniqueGames = null;
    public ?string $api_getWebhookDuration = null;
    public ?int $api_getDuration = null;
    public $api_getCapturingStatus = null;
    public ?int $api_getRecordingSize = null;
    public ?int $api_getChatDumpStatus = null;
    public ?int $api_getDurationLive = null;
    */

    /**
     * Set up basic data
     * Requires JSON to be loaded
     */
    public setupBasic(): void {
        if (!this.json) {
            throw new Error("No JSON loaded for basic setup!");
        }

        super.setupBasic();

        this.stream_resolution = this.json.stream_resolution;

        // TODO: what
        // const dur = this.getDurationLive();
        // this.duration_live = dur === false ? -1 : dur;

        this.bookmarks = this.json.bookmarks
            ? this.json.bookmarks.map((b) => {
                  return {
                      name: b.name,
                      date: parseJSON(b.date),
                  };
              })
            : [];
    }

    /**
     * Set up user data
     * Requires JSON to be loaded
     */
    public async setupUserData(): Promise<void> {
        if (!this.json) {
            throw new Error("No JSON loaded for user data setup!");
        }

        if (this.json.channel_uuid) {
            this.channel_uuid = this.json.channel_uuid;
        } else {
            log(
                LOGLEVEL.ERROR,
                "vod.setupUserData",
                `No stored channel UUID for VOD ${this.basename}`
            );
        }
        return await Promise.resolve();
    }

    /**
     * Set up provider related data
     * Requires JSON to be loaded
     */
    public setupProvider(): void {
        if (!this.json) {
            throw new Error("No JSON loaded for provider setup!");
        }

        this.twitch_vod_id =
            this.json.twitch_vod_id !== undefined
                ? this.json.twitch_vod_id
                : undefined;
        // this.twitch_vod_url = this.json.twitch_vod_url !== undefined ? this.json.twitch_vod_url : undefined;
        this.twitch_vod_duration =
            this.json.twitch_vod_duration !== undefined
                ? this.json.twitch_vod_duration
                : undefined;
        this.twitch_vod_title =
            this.json.twitch_vod_title !== undefined
                ? this.json.twitch_vod_title
                : undefined;
        this.twitch_vod_date =
            this.json.twitch_vod_date !== undefined
                ? this.json.twitch_vod_date
                : undefined;

        this.twitch_vod_exists =
            this.json.twitch_vod_exists !== undefined
                ? this.json.twitch_vod_exists
                : undefined;
        this.twitch_vod_neversaved =
            this.json.twitch_vod_neversaved !== undefined
                ? this.json.twitch_vod_neversaved
                : undefined;
        this.twitch_vod_attempted =
            this.json.twitch_vod_attempted !== undefined
                ? this.json.twitch_vod_attempted
                : undefined;

        this.twitch_vod_muted =
            this.json.twitch_vod_muted !== undefined
                ? this.json.twitch_vod_muted
                : undefined;

        /*
        if (typeof this.json.twitch_vod_muted == "boolean") {
            if (this.json.twitch_vod_muted === false) this.twitch_vod_muted = MUTE_STATUS.UNMUTED;
            else if (this.json.twitch_vod_muted === true) this.twitch_vod_muted = MUTE_STATUS.MUTED;
        } else if (this.json.twitch_vod_muted === null) {
            this.twitch_vod_muted = MUTE_STATUS.UNKNOWN;
        } else if (typeof this.json.twitch_vod_muted == "number") {
            this.twitch_vod_muted = this.json.twitch_vod_muted;
        }

        if (this.json.twitch_vod_status) {
            this.twitch_vod_status = this.json.twitch_vod_status;
        } else if (this.twitch_vod_neversaved) {
            this.twitch_vod_status = EXIST_STATUS.NEVER_EXISTED;
        } else if (this.twitch_vod_exists) {
            this.twitch_vod_status = EXIST_STATUS.EXISTS;
        } else if (!this.twitch_vod_exists) {
            this.twitch_vod_status = EXIST_STATUS.NOT_EXISTS;
        } else {
            this.twitch_vod_status = EXIST_STATUS.UNKNOWN;
        }
        */
        // this.twitch_vod_status = this.json.twitch_vod_status;

        // legacy
        // if (this.meta?.data[0]?.title) {
        //     this.stream_title = this.meta.data[0].title;
        // }
        //
        // if (this.meta?.title) {
        //     this.stream_title = this.meta.title;
        // }
    }

    public getWebhookDuration(): string | undefined {
        if (this.started_at && this.ended_at) {
            // format is H:i:s
            const diff_seconds =
                (this.ended_at.getTime() - this.started_at.getTime()) / 1000;
            return formatDuration(diff_seconds);
        } else {
            return undefined;
        }
    }

    /** TODO: implement ffprobe for mediainfo */
    public async getFFProbe(segment_num = 0): Promise<false | VideoMetadata> {
        log(
            LOGLEVEL.INFO,
            "vod.getFFProbe",
            `Fetching ffprobe of ${this.basename}, segment #${segment_num}`
        );

        if (!this.directory) {
            throw new Error("No directory set!");
        }

        if (!this.segments_raw || this.segments_raw.length == 0) {
            log(
                LOGLEVEL.ERROR,
                "vod.getFFProbe",
                `No segments available for ffprobe of ${this.basename}`
            );
            return false;
        }

        const filename = path.join(
            this.directory,
            path.basename(this.segments_raw[segment_num])
        );

        if (!fs.existsSync(filename)) {
            log(
                LOGLEVEL.ERROR,
                "vod.getFFProbe",
                `File does not exist for ffprobe of ${this.basename} (${filename} @ ${this.directory})`
            );
            return false;
        }

        let data: FFProbe | false = false;

        try {
            data = await ffprobe(filename);
        } catch (th) {
            log(
                LOGLEVEL.ERROR,
                "vod.getFFProbe",
                `Trying to get ffprobe of ${this.basename} returned: ${
                    (th as Error).message
                }`
            );
            return false;
        }

        if (data) {
            // console.debug(`Got ffprobe of ${this.basename}`);

            if (!data.streams || data.streams.length == 0) {
                log(
                    LOGLEVEL.ERROR,
                    "vod.getFFProbe",
                    `Invalid ffprobe for ${this.basename}`
                );
                return false;
            }

            const video_stream = data.streams.find(
                (stream): stream is VideoStream => stream.codec_type == "video"
            ); // FFProbeStream
            const audio_stream = data.streams.find(
                (stream): stream is AudioStream => stream.codec_type == "audio"
            ); // FFProbeStream[]

            if (!video_stream || !audio_stream) {
                log(
                    LOGLEVEL.ERROR,
                    "vod.getFFProbe",
                    `Invalid ffprobe for ${this.basename}`
                );
                return false;
            }

            // let fps = 0;
            // if (video_stream?.r_frame_rate) {
            //     const fps_base = parseInt(video_stream.r_frame_rate.split("/")[0]);
            //     const fps_den = parseInt(video_stream.r_frame_rate.split("/")[1]);
            //     fps = fps_base / fps_den;
            // }

            // use proxy type for mediainfo, can switch to ffprobe if needed
            /*
            this.video_metadata = {
                container: data.format.format_name,

                size: parseInt(data.format.size),
                duration: parseInt(data.format.duration),
                bitrate: parseInt(data.format.bit_rate),

                width: video_stream.width,
                height: video_stream.height,

                fps: fps,
                fps_mode: 
                // fps_mode: video_stream.r_frame_rate_mode as "VFR" | "CFR",

                audio_codec: audio_stream.codec_name,
                audio_bitrate: parseInt(audio_stream.bit_rate),
                // audio_bitrate_mode: audio_stream.bit_rate_mode as "VBR" | "CBR",
                audio_sample_rate: audio_stream.sample_rate,
                audio_channels: audio_stream.channels,

                video_codec: video_stream.codec_name,
                video_bitrate: parseInt(video_stream.bit_rate),
                // video_bitrate_mode: video_stream.bit_rate_mode as "VBR" | "CBR",
            };
            */

            // return this.video_metadata;
        } else {
            log(
                LOGLEVEL.ERROR,
                "vod.getFFProbe",
                `Could not get ffprobe of ${this.basename}`
            );
        }

        // this.video_fail2 = true;
        return false;
    }

    get current_game(): TwitchGame | undefined {
        if (!this.chapters || this.chapters.length == 0) return undefined;
        // return this.chapters.at(-1)?.game;
        return this.chapters[this.chapters.length - 1].game;
    }

    // getter for game_name, which is the first game in the chapters
    public get game_name(): string {
        if (!this.chapters || this.chapters.length == 0) return "";
        return this.chapters[0].game_name;
    }

    public get game_id(): string {
        if (!this.chapters || this.chapters.length == 0) return "";
        return this.chapters[0].game_id?.toString() || "";
    }

    /**
     * Returns an array of filenames associated with this Twitch VOD, including the JSON metadata file,
     * chat logs, video files, and other related files. If the VOD has been segmented, the filenames of
     * the individual segments will also be included in the array.
     *
     * @returns An array of filenames associated with this Twitch VOD.
     */
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
            base.push(...this.segments_raw.map((seg) => path.basename(seg)));
        }

        return base.filter((f) =>
            fs.existsSync(this.realpath(path.join(this.directory || "", f)))
        );
    }

    /**
     * Parses the raw chapter data for the VOD and creates an array of `TwitchVODChapter` objects.
     * @param raw_chapters The raw chapter data to parse.
     * @returns A boolean indicating whether the parsing was successful or not.
     */
    public async parseChapters(
        raw_chapters: TwitchVODChapterJSON[]
    ): Promise<boolean> {
        if (!raw_chapters || raw_chapters.length == 0) {
            log(
                LOGLEVEL.ERROR,
                "vod.parseChapters",
                `No chapter data found for ${this.basename}`
            );
            return false;
        }

        const chapters: TwitchVODChapter[] = [];

        for (const chapter of raw_chapters) {
            if (!this.started_at || !this.ended_at) {
                log(
                    LOGLEVEL.ERROR,
                    "vod.parseChapters",
                    `Time error for chapter parsing found for ${this.basename} (started_at: ${this.started_at}, ended_at: ${this.ended_at})`
                );
                return false;
            }

            const new_chapter = await TwitchVODChapter.fromJSON(chapter);
            new_chapter.vod_uuid = this.uuid;

            chapters.push(new_chapter);
        }

        chapters.forEach((chapter, index) => {
            const previousChapter = chapters[index - 1];
            const nextChapter = chapters[index + 1];

            if (previousChapter) {
                if (
                    previousChapter.started_at.getTime() >
                    chapter.started_at.getTime()
                ) {
                    log(
                        LOGLEVEL.ERROR,
                        "vod.parseChapters",
                        `Chapter ${chapter.title} has a previous chapter with a later start time for ${this.basename} (previous: ${previousChapter.started_at}, current: ${chapter.started_at})`
                    );
                }
            }
            if (nextChapter) {
                if (
                    nextChapter.started_at.getTime() <
                    chapter.started_at.getTime()
                ) {
                    log(
                        LOGLEVEL.ERROR,
                        "vod.parseChapters",
                        `Chapter ${chapter.title} has a next chapter with an earlier start time for ${this.basename} (next: ${nextChapter.started_at}, current: ${chapter.started_at})`
                    );
                }
            }
        });

        /*
        this.chapters.forEach((chapter, index) => {

            const nextChapter = this.chapters[index + 1];

            // calculate duration from next chapter
            if (nextChapter && nextChapter.started_at && chapter.started_at) {
                chapter.duration = nextChapter.started_at.getTime() - chapter.started_at.getTime();
            } else {
                console.warn(`Could not calculate duration for chapter ${chapter.title}`);
            }

            // can't remember why this is here
            // TODO: investigate
            // if (index == 0) {
            //     this.game_offset = chapter.offset;
            // }

            // final chapter, make duration to end of vod
            if (index == chapters.length - 1 && this.ended_at && chapter.started_at) {
                chapter.duration = this.ended_at.getTime() - chapter.started_at.getTime();
            }
        });
        */

        // console.log("Chapters:", chapters);

        // this.chapters_raw = raw_chapters;
        this.chapters = chapters;

        this.calculateChapters();

        return true;
    }

    public addChapter(chapter: TwitchVODChapter): void {
        log(
            LOGLEVEL.INFO,
            "vod.addChapter",
            `Adding chapter ${chapter.title} (${chapter.game_name}) to ${this.basename}`
        );
        this.chapters.push(chapter);
        this.chapters_raw.push(chapter.toJSON()); // needed?
        this.calculateChapters();
    }

    public async generateDefaultChapter(): Promise<void> {
        if (!this.started_at) return;
        const chapter = await TwitchVODChapter.fromJSON({
            title: this.json?.twitch_vod_title ?? "Unknown title",
            started_at: this.started_at.toISOString(),
            is_mature: false,
            online: true,
        });

        this.addChapter(chapter);
    }

    /**
     * Splits the video by chapters.
     * @returns A boolean indicating whether the operation was successful or not.
     */
    public async splitSegmentVideoByChapters(): Promise<boolean> {
        if (!this.segments_raw || this.segments_raw.length == 0) {
            log(
                LOGLEVEL.ERROR,
                "vod.splitSegmentByChapters",
                `No segments found for ${this.basename}`
            );
            throw new Error(`No segments found for ${this.basename}`);
            return false;
        }

        if (!this.chapters || this.chapters.length == 0) {
            log(
                LOGLEVEL.ERROR,
                "vod.splitSegmentByChapters",
                `No chapters found for ${this.basename}`
            );
            throw new Error(`No chapters found for ${this.basename}`);
            return false;
        }

        if (!this.created_at) {
            throw new Error(
                "TwitchVOD.splitSegmentVideoByChapters: created_at is not set"
            );
        }

        const video_input = path.join(this.directory, this.segments_raw[0]); // TODO: burned video etc

        const bin = Helper.path_ffmpeg();

        if (!bin) {
            log(
                LOGLEVEL.ERROR,
                "vod.splitSegmentByChapters",
                `FFmpeg binary not found for ${this.basename}`
            );
            throw new Error(`FFmpeg binary not found for ${this.basename}`);
            return false;
        }

        let chapter_index = 1;
        for (const chapter of this.chapters) {
            if (!chapter.started_at) {
                log(
                    LOGLEVEL.ERROR,
                    "vod.splitSegmentByChapters",
                    `Chapter ${chapter.title} has no start time for ${this.basename}`
                );
                throw new Error(
                    `Chapter ${chapter.title} has no start time for ${this.basename}`
                );
                return false;
            }

            if (chapter.offset == undefined) {
                log(
                    LOGLEVEL.ERROR,
                    "vod.splitSegmentByChapters",
                    `Chapter ${chapter.title} has no offset for ${this.basename}`
                );
                throw new Error(
                    `Chapter ${chapter.title} has no offset for ${this.basename}`
                );
            }

            if (chapter.duration == undefined) {
                log(
                    LOGLEVEL.ERROR,
                    "vod.splitSegmentByChapters",
                    `Chapter ${chapter.title} has no duration for ${this.basename}`
                );
                throw new Error(
                    `Chapter ${chapter.title} has no duration for ${this.basename}`
                );
            }

            if (
                chapter.offset < 0 ||
                chapter.duration < 0 ||
                chapter.offset > this.duration
            ) {
                log(
                    LOGLEVEL.ERROR,
                    "vod.splitSegmentByChapters",
                    `Chapter ${chapter.title} has invalid offset or duration for ${this.basename}`
                );
                throw new Error(
                    `Chapter ${chapter.title} has invalid offset or duration for ${this.basename}`
                );
            }

            if (
                chapter.offset + chapter.duration > this.duration &&
                chapter_index != this.chapters.length
            ) {
                log(
                    LOGLEVEL.ERROR,
                    "vod.splitSegmentByChapters",
                    `Chapter ${chapter.title} has invalid duration for ${this.basename}`
                );
                throw new Error(
                    `Chapter ${chapter.title} has invalid duration for ${this.basename}`
                );
            }

            const chapter_start = chapter.offset || 0;
            const chapter_end = chapter.offset + chapter.duration;

            let basepath = this.directory;

            const channel_basepath = this.getChannel().getFolder();

            const chapter_template_variables: VodBasenameWithChapterTemplate = {
                // login: this.getChannel().login,
                internalName: this.getChannel().internalName,
                displayName: this.getChannel().displayName,
                date: format(this.created_at, "yyyy-MM-dd"), // TODO: check format
                year: format(this.created_at, "yyyy"),
                year_short: format(this.created_at, "yy"),
                month: format(this.created_at, "MM"),
                day: format(this.created_at, "dd"),
                hour: format(this.created_at, "HH"),
                minute: format(this.created_at, "mm"),
                second: format(this.created_at, "ss"),
                id: this.external_vod_id || "",
                season: this.stream_season || "",
                absolute_season: this.stream_absolute_season?.toString() || "",
                episode: this.stream_number?.toString() || "",
                absolute_episode: this.stream_absolute_number?.toString() || "",
                title: this.stream_title || this.external_vod_title || "",
                game_name: this.game_name,
                game_id: this.current_game?.id || "",
                chapter_number: chapter_index.toString(),
                chapter_title: chapter.title,
                chapter_game_id: chapter.game_id?.toString() || "",
                chapter_game_name: chapter.game_name,
            };

            if (Config.getInstance().cfg<boolean>("vod_folders")) {
                basepath = path.join(
                    channel_basepath,
                    formatString(
                        Config.getInstance().cfg<string>(
                            "template.vodsplit.folder"
                        ),
                        chapter_template_variables
                    )
                );

                if (!validateAbsolutePath(basepath)) {
                    throw new Error(
                        `Invalid basepath for ${this.basename}: ${basepath}`
                    );
                }
            }

            if (!fs.existsSync(basepath)) {
                fs.mkdirSync(basepath, { recursive: true });
            }

            let chapter_filename =
                formatString(
                    Config.getInstance().cfg<string>(
                        "template.vodsplit.filename"
                    ),
                    chapter_template_variables
                ) +
                "." +
                Config.getInstance().cfg<string>("vod_container", "mp4");

            // quickly replace invalid characters
            chapter_filename = sanitize(chapter_filename);

            if (!validateFilename(chapter_filename)) {
                throw new Error(
                    `Invalid filename for ${this.basename}: ${chapter_filename}`
                );
            }

            const chapter_path = path.join(basepath, chapter_filename);

            const args: string[] = [];

            // args.push(// "-y",);
            args.push(
                "-i",
                // this.realpath(path.join(this.directory, this.segments_raw[0]))
                this.realpath(video_input)
            );
            args.push("-ss", formatSubtitleDuration(chapter_start));
            // final chapter doesn't need to end at a specific time
            if (chapter_index == this.chapters.length) {
                args.push("-to", formatSubtitleDuration(this.duration));
            }
            args.push("-c", "copy");
            args.push(chapter_path);

            let job;

            try {
                job = await execAdvanced(
                    bin,
                    args,
                    `chapter_split_${this.basename}_${chapter_index}`
                );
            } catch (error) {
                if (isExecReturn(error)) {
                    throw new Error(
                        `Chapter ${chapter.title} failed to split for ${this.basename}: ${error.stderr}`
                    );
                }
                throw error;
            }

            if (
                !fs.existsSync(chapter_path) ||
                fs.statSync(chapter_path).size == 0
            ) {
                log(
                    LOGLEVEL.ERROR,
                    "vod.splitSegmentByChapters",
                    `Chapter ${chapter.title} did not generate a file for ${this.basename}`
                );
                throw new Error(
                    `Chapter ${chapter.title} did not generate a file for ${this.basename}`
                );
                return false;
            }

            chapter_index++;
        }

        return true;
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
                `Failed to get mediainfo for ${this.basename}: ${error}`
            );
        }

        // generate chapter related files
        try {
            await this.saveLosslessCut();
        } catch (error) {
            log(
                LOGLEVEL.ERROR,
                "vod.finalize",
                `Failed to save lossless cut for ${this.basename}: ${error}`
            );
        }

        try {
            await this.saveFFMPEGChapters();
        } catch (error) {
            log(
                LOGLEVEL.ERROR,
                "vod.finalize",
                `Failed to save ffmpeg chapters for ${this.basename}: ${error}`
            );
        }

        try {
            await this.saveVTTChapters();
        } catch (error) {
            log(
                LOGLEVEL.ERROR,
                "vod.finalize",
                `Failed to save vtt chapters for ${this.basename}: ${error}`
            );
        }

        try {
            await this.saveKodiNfo();
        } catch (error) {
            log(
                LOGLEVEL.ERROR,
                "vod.finalize",
                `Failed to save kodi nfo for ${this.basename}: ${error}`
            );
        }

        // match stored vod to online vod
        try {
            await this.matchProviderVod();
        } catch (error) {
            log(
                LOGLEVEL.ERROR,
                "vod.finalize",
                `Failed to match provider vod for ${this.basename}: ${error}`
            );
        }

        // generate contact sheet
        if (Config.getInstance().cfg("contact_sheet.enable")) {
            await this.createVideoContactSheet();
        }

        // calculate chapter durations and offsets
        this.calculateChapters();

        LiveStreamDVR.getInstance().updateFreeStorageDiskSpace();

        // this.checkMutedVod(); // initially not muted when vod is published

        this.is_finalized = true;

        return true;
    }

    public async migrate(): Promise<boolean> {
        if (!this.json) {
            throw new Error("No JSON loaded for migration!");
        }

        let migrated = false;

        if (this.twitch_vod_id !== undefined && !this.external_vod_id) {
            this.external_vod_id = this.twitch_vod_id;
            migrated = true;
        }
        if (
            this.twitch_vod_duration !== undefined &&
            !this.external_vod_duration
        ) {
            this.external_vod_duration = this.twitch_vod_duration;
            migrated = true;
        }
        if (this.twitch_vod_title !== undefined && !this.external_vod_title) {
            this.external_vod_title = this.twitch_vod_title;
            migrated = true;
        }
        if (this.twitch_vod_date !== undefined && !this.external_vod_date) {
            this.external_vod_date = parseJSON(this.twitch_vod_date);
            migrated = true;
        }
        if (
            this.twitch_vod_exists !== undefined &&
            this.external_vod_exists === undefined
        ) {
            this.external_vod_exists = this.twitch_vod_exists;
            migrated = true;
        }

        return await Promise.resolve(migrated);
    }

    /**
     * Match the stored vod to the online vod.
     * Does **NOT** save.
     * @param force
     * @throws
     * @returns
     */
    public async matchProviderVod(force = false): Promise<boolean | undefined> {
        if (this.external_vod_id && !force) {
            throw new Error("VOD already has a provider VOD ID");
        }
        if (this.is_capturing || this.is_converting) {
            throw new Error("VOD is still capturing or converting");
        }
        if (!this.started_at) {
            throw new Error("VOD has no start time");
        }

        log(
            LOGLEVEL.INFO,
            "vod.matchProviderVod",
            `Trying to match ${this.basename} to provider...`
        );

        const channel_videos = await TwitchVOD.getLatestVideos(
            this.getChannel().internalId
        );
        if (!channel_videos) {
            log(
                LOGLEVEL.ERROR,
                "vod.matchProviderVod",
                `No videos returned from streamer of ${this.basename}`
            );
            this.twitch_vod_neversaved = true;
            this.external_vod_exists = false;
            this.broadcastUpdate();
            // return false;
            throw new Error("No videos returned from streamer");
        }

        for (const video of channel_videos) {
            const video_time = parseJSON(video.created_at);
            if (!video_time) continue;

            const startOffset = Math.abs(
                this.started_at.getTime() - video_time.getTime()
            );
            const matchingCaptureId =
                video.stream_id &&
                this.capture_id &&
                video.stream_id == this.capture_id;
            const maxOffset = 1000 * 60 * 5; // 5 minutes

            // log(LOGLEVEL.DEBUG, "vod.matchProviderVod", `Checking '${this.basename}' (${this.getTitle()}) against '${video.title}' (${video.id}) with offset ${startOffset}ms: ${matchingCaptureId}`);

            const videoDuration = TwitchHelper.parseTwitchDuration(
                video.duration
            );

            if (
                startOffset < maxOffset || // 5 minutes
                matchingCaptureId
            ) {
                log(
                    LOGLEVEL.SUCCESS,
                    "vod.matchProviderVod",
                    `Found matching VOD for ${
                        this.basename
                    } (${this.started_at.toISOString()}): ${video.id} (${
                        video.title
                    })`
                );

                this.setProviderVod(video);
                this.external_vod_exists = true;

                this.broadcastUpdate();

                return true;
            }
        }

        this.twitch_vod_attempted = true;
        this.twitch_vod_neversaved = true;
        this.external_vod_exists = false;

        log(
            LOGLEVEL.ERROR,
            "vod.matchProviderVod",
            `No matching VOD for ${this.basename}`
        );

        this.broadcastUpdate();

        throw new Error(`No matching VOD from ${channel_videos.length} videos`);
    }

    public setProviderVod(video: Video): void {
        this.twitch_vod_id = video.id;
        this.twitch_vod_duration = TwitchHelper.parseTwitchDuration(
            video.duration
        );
        this.twitch_vod_title = video.title;
        this.twitch_vod_date = video.created_at;

        this.external_vod_id = video.id;
        this.external_vod_duration = TwitchHelper.parseTwitchDuration(
            video.duration
        );
        this.external_vod_title = video.title;
        this.external_vod_date = parseJSON(video.created_at);
        // this.external_vod_exists = true;
    }

    getTitle(): string {
        if (!this.chapters || this.chapters.length == 0)
            return this.external_vod_title ?? "Unknown title";
        return this.chapters[0].title;
    }

    public async saveVTTChapters(): Promise<boolean> {
        if (!this.directory) {
            throw new Error("TwitchVOD.saveVTTChapters: directory is not set");
        }

        if (!this.chapters || this.chapters.length == 0) {
            throw new Error("TwitchVOD.saveVTTChapters: chapters are not set");
        }

        log(
            LOGLEVEL.INFO,
            "vod.saveVTTChapters",
            `Saving VTT chapters file for ${this.basename} to ${this.path_vttchapters}`
        );

        let data = `WEBVTT - Generated by ${AppName}\n\n`;

        this.chapters.forEach((chapter, i) => {
            const offset = chapter.offset || 0;
            const duration = chapter.duration || 0;

            const start = offset;
            const end = offset + duration;

            const txt_start = formatSubtitleDuration(start);
            const txt_end = formatSubtitleDuration(end);

            data += `Chapter ${i + 1}\n`;
            data += `${txt_start} --> ${txt_end}\n`;
            data += `${chapter.title} (${chapter.game_name})\n\n`;
        });

        await this.stopWatching();

        fs.writeFileSync(this.path_vttchapters, data, { encoding: "utf8" });

        this.setPermissions();

        await this.startWatching();

        return fs.existsSync(this.path_vttchapters);
    }

    public async saveKodiNfo(): Promise<boolean> {
        if (!Config.getInstance().cfg("create_kodi_nfo")) return false;

        if (!this.directory) {
            throw new Error("TwitchVOD.saveKodiNfo: directory is not set");
        }

        if (!this.started_at) {
            throw new Error("TwitchVOD.saveKodiNfo: started_at is not set");
        }

        log(
            LOGLEVEL.INFO,
            "vod.saveKodiNfo",
            `Saving Kodi NFO file for ${this.basename} to ${this.path_kodinfo}`
        );

        const title = this.external_vod_title
            ? this.external_vod_title
            : this.chapters[0]
            ? this.chapters[0].title
            : this.basename;

        let data = "";
        data += '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>\n';
        data += "<episodedetails>\n";
        data += `\t<title>${htmlentities(title)}</title>\n`;
        data += `\t<showtitle>${this.getChannel().displayName}</showtitle>\n`;
        data += `\t<uniqueid type="twitch">${this.external_vod_id}</uniqueid>\n`;

        data += `\t<season>${format(
            this.started_at,
            Config.SeasonFormat
        )}</season>\n`;
        data += `\t<episode>${(this.stream_number || 0) + 1}</episode>\n`;

        if (this.chapters && this.chapters.length > 0) {
            let plot = "";
            this.chapters.forEach((chapter, index) => {
                plot += `${index + 1}. ${chapter.title} (${
                    chapter.game_name
                })\n`;
            });
            data += `\t<plot>${htmlentities(plot)}</plot>\n`;
        }

        if (this.duration)
            data += `\t<runtime>${Math.ceil(this.duration / 60)}</runtime>\n`;

        data += "\t<actor>\n";
        data += `\t\t<name>${this.getChannel().displayName}</name>\n`;
        data += "\t\t<role>Themselves</role>\n";
        data += "\t</actor>\n";

        if (this.getUniqueGames()) {
            this.getUniqueGames().forEach((game) => {
                data += `\t<tag>${game.name}</tag>\n`;
            });
        }

        data += `\t<premiered>${format(
            this.started_at,
            "yyyy-MM-dd"
        )}</premiered>\n`;
        data += `\t<aired>${format(this.started_at, "yyyy-MM-dd")}</aired>\n`;
        data += `\t<dateadded>${format(
            this.started_at,
            "yyyy-MM-dd"
        )}</dateadded>\n`;
        data += `\t<year>${format(this.started_at, "yyyy")}</year>\n`;
        data += `\t<studio>${this.getChannel().displayName}</studio>\n`;

        data += `\t<id>${this.external_vod_id}</id>\n`;

        data += "</episodedetails>\n";

        await this.stopWatching();

        fs.writeFileSync(this.path_kodinfo, data, { encoding: "utf8" });

        this.setPermissions();

        await this.startWatching();

        return fs.existsSync(this.path_kodinfo);
    }

    public getUniqueGames(): TwitchGame[] {
        const games: TwitchGame[] = [];
        this.chapters.forEach((chapter) => {
            if (chapter.game && !games.includes(chapter.game))
                games.push(chapter.game);
        });
        return games;
    }

    public async toAPI(): Promise<ApiTwitchVod> {
        if (!this.uuid) throw new Error(`No UUID set on VOD ${this.basename}`);
        if (!this.channel_uuid)
            throw new Error(`No channel UUID set on VOD ${this.basename}`);

        return {
            ...(await super.toAPI()),
            provider: "twitch",

            stream_resolution: this.stream_resolution,

            // twitch_vod_duration: this.twitch_vod_duration,
            twitch_vod_muted: this.twitch_vod_muted,
            // twitch_vod_status: this.twitch_vod_status,
            // twitch_vod_id: this.twitch_vod_id,
            // twitch_vod_date: this.twitch_vod_date,
            // twitch_vod_title: this.twitch_vod_title,
            twitch_vod_neversaved: this.twitch_vod_neversaved,
            // twitch_vod_exists: this.twitch_vod_exists,
            twitch_vod_attempted: this.twitch_vod_attempted,

            api_hasFavouriteGame: this.hasFavouriteGame(),
            api_getUniqueGames: this.getUniqueGames().map((g) => g.toAPI()),
            api_getWebhookDuration: this.getWebhookDuration(),
            // api_getDuration: this.duration, // this.getDuration(),
            api_getChatDumpStatus: await this.getChatDumpStatus(),

            chapters: this.chapters.map((c) => c.toAPI()),
            // chapters_raw: this.chapters_raw,

            // game_offset: this.game_offset || 0,
            // twitch_vod_url: this.twitch_vod_url,
            // twitch_vod_exists: this.twitch_vod_exists,
            // twitch_vod_attempted: this.twitch_vod_attempted,
            // twitch_vod_neversaved: this.twitch_vod_neversaved,
            // video_fail2: this.video_fail2,
            // json_hash: this.json_hash,
            // created: this.created,
            // force_record: this.force_record,
            // automator_fail: this.automator_fail,
            // dt_started_at: this.dt_started_at ? TwitchHelper.JSDateToPHPDate(this.dt_started_at) : null,
            // dt_ended_at: this.dt_ended_at ? TwitchHelper.JSDateToPHPDate(this.dt_ended_at) : null,
        };
    }

    public async getChatDumpStatus(): Promise<JobStatus> {
        const job = Job.findJob(`chatdump_${this.basename}`);
        return job ? await job.getStatus() : JobStatus.STOPPED;
    }

    public async toJSON(): Promise<TwitchVODJSON> {
        const generated = (await super.toJSON()) as TwitchVODJSON;

        generated.version = 2;
        generated.type = "twitch";

        generated.chapters = this.chapters.map((chapter) => chapter.toJSON());
        generated.segments = this.segments.map(
            (segment) => segment.filename || ""
        ); // hack?

        if (this.twitch_vod_id) {
            generated.twitch_vod_id = this.twitch_vod_id;
            // generated.twitch_vod_url = this.twitch_vod_url;
            generated.twitch_vod_duration =
                this.twitch_vod_duration ?? undefined;
            generated.twitch_vod_title = this.twitch_vod_title;
            generated.twitch_vod_date = this.twitch_vod_date;
        }

        generated.twitch_vod_exists = this.twitch_vod_exists;
        generated.twitch_vod_attempted = this.twitch_vod_attempted;
        generated.twitch_vod_neversaved = this.twitch_vod_neversaved;
        generated.twitch_vod_muted = this.twitch_vod_muted;

        return generated;
    }

    public async saveJSON(reason = ""): Promise<boolean> {
        if (!this.filename) {
            throw new Error("Filename not set.");
        }

        if (
            !this.not_started &&
            (!this.chapters || this.chapters.length == 0)
        ) {
            log(
                LOGLEVEL.WARNING,
                "vod.saveJSON",
                `Saving JSON of ${this.basename} with no chapters!!`
            );
        }

        if (!this.getChannel() && !this.created) {
            log(
                LOGLEVEL.FATAL,
                "vod.saveJSON",
                `Found no channel in class of ${this.basename}, not saving!`
            );
            return false;
        }

        const generated = await this.toJSON();

        log(
            LOGLEVEL.SUCCESS,
            "vod.saveJSON",
            `Saving JSON of ${this.basename} ${
                reason ? " (" + reason + ")" : ""
            }`
        );

        this.setPermissions();

        await this.stopWatching();

        this._writeJSON = true;

        try {
            fs.writeFileSync(this.filename, JSON.stringify(generated, null, 4));
        } catch (error) {
            log(
                LOGLEVEL.FATAL,
                "vod.saveJSON",
                `Failed to save JSON of ${this.basename}: ${
                    (error as Error).message
                }`
            );
            console.log(
                chalk.bgRedBright.whiteBright(
                    `Failed to save JSON of ${this.basename}: ${
                        (error as Error).message
                    }`
                )
            );
            return false;
        }

        this._writeJSON = false;

        await this.startWatching();

        this.broadcastUpdate(); // should this be here?

        return true;
    }

    /**
     * Checks all chapters for games with the favourite flag set
     */
    public hasFavouriteGame(): boolean {
        return this.chapters.some((chapter) => chapter.game?.isFavourite());
    }

    public move(newDirectory: string): void {
        if (!this.directory) throw new Error("No directory set for move");

        log(
            LOGLEVEL.INFO,
            "vod.move",
            `Move ${this.basename} to ${newDirectory}`
        );

        for (const file of this.associatedFiles) {
            const file_from = path.join(this.directory, file);
            const file_to = path.join(newDirectory, file);
            if (fs.existsSync(file_from)) {
                log(
                    LOGLEVEL.DEBUG,
                    "vod.move",
                    `Move ${file_from} to ${file_to}`
                );
                fs.renameSync(file_from, file_to);
            } else {
                log(
                    LOGLEVEL.ERROR,
                    "vod.move",
                    `File ${file_from} does not exist`
                );
            }
        }
    }

    public archive(): void {
        this.move(BaseConfigDataFolder.saved_vods);

        const channel = this.getChannel();
        if (channel) channel.removeVod(this.uuid);
    }

    public async checkValidVod(save = false): Promise<boolean | null> {
        const current_status = this.external_vod_exists;

        if (!this.is_finalized) {
            log(
                LOGLEVEL.INFO,
                "vod.checkValidVod",
                `Trying to check vod valid while not finalized on ${this.basename}`
            );
            return null;
        }

        if (this.external_vod_exists === undefined && !this.external_vod_id) {
            log(
                LOGLEVEL.INFO,
                "vod.checkValidVod",
                `First time check for vod valid on ${this.basename}`
            );
            try {
                await this.matchProviderVod();
            } catch (error) {
                log(
                    LOGLEVEL.ERROR,
                    "vod.checkValidVod",
                    `Failed to match provider vod for ${this.basename}: ${
                        (error as Error).message
                    }`
                );
                return null;
            }
        }

        if (!this.external_vod_id) {
            log(
                LOGLEVEL.ERROR,
                "vod.checkValidVod",
                `No twitch VOD id for valid checking on ${this.basename}`
            );
            if (this.twitch_vod_neversaved) {
                if (save && current_status !== false) {
                    this.external_vod_exists = false;
                    await this.saveJSON("vod check neversaved");
                }
            }
            return false;
        }

        log(
            LOGLEVEL.INFO,
            "vod.checkValidVod",
            `Check valid VOD for ${this.basename}`
        );

        let video;

        try {
            video = await TwitchVOD.getVideo(this.external_vod_id.toString());
        } catch (error) {
            log(
                LOGLEVEL.ERROR,
                "vod.checkValidVod",
                `Failed to check valid VOD for ${this.basename}: ${
                    (error as Error).message
                }`
            );
            return null;
        }

        if (video) {
            log(
                LOGLEVEL.SUCCESS,
                "vod.checkValidVod",
                `VOD exists for ${this.basename}`
            );
            this.external_vod_exists = true;
            if (save && current_status !== this.external_vod_exists) {
                await this.saveJSON("vod check true");
            }
            return true;
        }

        log(
            LOGLEVEL.WARNING,
            "vod.checkValidVod",
            `No VOD for ${this.basename}`
        );

        this.external_vod_exists = false;

        if (save && current_status !== this.external_vod_exists) {
            await this.saveJSON("vod check false");
        }

        return false;
    }

    public static async checkValidVods(
        ids: string[]
    ): Promise<Record<string, boolean>> {
        const results: Record<string, boolean> = {};

        const videos = await TwitchVOD.getVideosRecord(ids);

        if (!videos) throw new Error("No videos returned from Twitch");

        for (const id of ids) {
            results[id] = videos[id] !== false;
        }

        return results;
    }

    /**
     * Check vod for muted segments
     * @throws
     * @param save
     * @returns
     */
    public async checkMutedVod(save = false): Promise<MuteStatus> {
        if (!this.external_vod_id) {
            log(
                LOGLEVEL.ERROR,
                "vod.checkMutedVod",
                `VOD mute check for ${this.basename} canceled, no vod id!`
            );
            throw new Error("No VOD id");
        }

        if (!this.external_vod_exists) {
            log(
                LOGLEVEL.ERROR,
                "vod.checkMutedVod",
                `VOD mute check for ${this.basename} canceled, no vod!`
            );
            throw new Error("No VOD");
        }

        log(
            LOGLEVEL.INFO,
            "vod.checkMutedVod",
            `Check muted VOD for ${
                this.basename
            } using ${Config.getInstance().cfg("checkmute_method", "api")}`
        );

        // since the api doesn't return muted_segments if an app auth token is used,
        // streamlink is used instead, until this is fixed in the api

        // return TwitchConfig.getInstance().cfg("checkmute_method", "api") == "api" ? await this.checkMutedVodAPI(save, force) : await this.checkMutedVodStreamlink(save, force);
        if (TwitchHelper.accessTokenType === "user") {
            return await this.checkMutedVodAPI(save);
        } else {
            return await this.checkMutedVodStreamlink(save);
        }
    }

    private async checkMutedVodAPI(save = false): Promise<MuteStatus> {
        if (!this.external_vod_id) return MuteStatus.UNKNOWN;

        const previous = this.twitch_vod_muted;

        const data = await TwitchVOD.getVideo(this.external_vod_id.toString());

        if (!data) {
            log(
                LOGLEVEL.ERROR,
                "vod.checkMutedVodAPI",
                `VOD ${this.basename} is deleted!`
            );
            throw new Error("VOD is deleted!");
            // return null;
        } else {
            if (data.muted_segments && data.muted_segments.length > 0) {
                this.twitch_vod_muted = MuteStatus.MUTED;
                log(
                    LOGLEVEL.WARNING,
                    "vod.checkMutedVodAPI",
                    `VOD ${this.basename} is muted! (${data.muted_segments.length} segments)`
                );
                if (previous !== this.twitch_vod_muted && save) {
                    await this.saveJSON("vod mute true");
                }
                return MuteStatus.MUTED;
            } else {
                this.twitch_vod_muted = MuteStatus.UNMUTED;
                log(
                    LOGLEVEL.SUCCESS,
                    "vod.checkMutedVodAPI",
                    `VOD ${this.basename} is not muted!`,
                    data
                );
                if (previous !== this.twitch_vod_muted && save) {
                    await this.saveJSON("vod mute false");
                }
                return MuteStatus.UNMUTED;
            }
        }
    }

    private async checkMutedVodStreamlink(save = false): Promise<MuteStatus> {
        const previous = this.twitch_vod_muted;

        const slp = Helper.path_streamlink();
        if (!slp) throw new Error("Streamlink not found!");

        const ex = await execSimple(
            slp,
            [
                "--stream-url",
                `https://www.twitch.tv/videos/${this.external_vod_id}`,
                "best",
            ],
            "vod mute check"
        );

        if (!ex) {
            // TwitchlogAdvanced(LOGLEVEL.INFO, "vod", "VOD ${this.basename} could not be checked for mute status!", ['output' => $output]);
            throw new Error(
                "VOD could not be checked for mute status, no output."
            );
        }

        const output = ex.stdout.join("\n");

        if (output.includes("index-muted-")) {
            this.twitch_vod_muted = MuteStatus.MUTED;
            log(
                LOGLEVEL.WARNING,
                "vod.checkMutedStreamlink",
                `VOD ${this.basename} is muted!`
            );
            if (previous !== this.twitch_vod_muted && save) {
                await this.saveJSON("vod mute true");
            }
            return MuteStatus.MUTED;
        } else if (output.includes("Unable to find video")) {
            log(
                LOGLEVEL.ERROR,
                "vod.checkMutedStreamlink",
                `VOD ${this.basename} is deleted!`
            );
            throw new Error("VOD is deleted!");
        } else {
            this.twitch_vod_muted = MuteStatus.UNMUTED;
            log(
                LOGLEVEL.SUCCESS,
                "vod.checkMutedStreamlink",
                `VOD ${this.basename} is not muted!`
            );
            if (previous !== this.twitch_vod_muted && save) {
                await this.saveJSON("vod mute false");
            }
            return MuteStatus.UNMUTED;
        }
    }

    /**
     * Download the VOD from Twitch if vod id is set
     * @param quality
     * @returns
     * @throws
     */
    public async downloadVod(quality: VideoQuality = "best"): Promise<boolean> {
        if (!this.external_vod_id) throw new Error("No VOD id!");
        if (!this.directory) throw new Error("No directory!");

        let filename = "";
        try {
            filename = await TwitchVOD.downloadVideo(
                this.external_vod_id.toString(),
                quality,
                path.join(this.directory, `${this.basename}_vod.mp4`)
            );
        } catch (e) {
            log(
                LOGLEVEL.ERROR,
                "vod.downloadVod",
                `VOD ${this.basename} could not be downloaded: ${
                    (e as Error).message
                }`
            );
            return false;
        }

        return filename !== "";
    }

    public async getSync() {
        const files = {
            ref: this.segments[0].filename || "",
            act: this.path_downloaded_vod,
        };

        if (!files.ref || !files.act) return;

        for (const f of ["ref", "act"]) {
            if (
                !fs.existsSync(
                    path.join(BaseConfigCacheFolder.cache, `${f}.wav`)
                )
            ) {
                const wavconvert = await execSimple(
                    "ffmpeg",
                    [
                        "-i",
                        files[f as "act" | "ref"],
                        "-t",
                        "00:05:00",
                        "-vn",
                        path.join(BaseConfigCacheFolder.cache, `${f}.wav`),
                    ],
                    `${f} ffmpeg convert`
                );
            }
        }

        // somehow get the sync of the two audio files here
    }

    public getStartOffset(): number | false {
        if (!this.external_vod_duration) return false;
        // const dur = await this.getDuration();
        // if (!dur) return false;
        return this.external_vod_duration - this.duration;
    }

    /**
     * @test disable
     * @returns
     */
    public async startWatching(): Promise<boolean> {
        if (this.fileWatcher) await this.stopWatching();

        // no blocks in testing
        // if (process.env.NODE_ENV === "test") return false;

        const files = this.associatedFiles.map((f) =>
            path.join(this.directory, f)
        );

        this.fileWatcher = chokidar
            .watch(files, {
                ignoreInitial: true,
            })
            .on("all", (eventType, filename) => {
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

                if (Config.debug)
                    console.log(
                        `VOD file ${filename} changed (${
                            this._writeJSON ? "internal" : "external"
                        }/${eventType})!`
                    );

                // main json file changed
                if (filename === this.filename) {
                    if (!fs.existsSync(this.filename)) {
                        log(
                            LOGLEVEL.WARNING,
                            "vod.watch",
                            `VOD JSON ${this.basename} deleted (${eventType})!`
                        );
                        if (
                            LiveStreamDVR.getInstance().getVodByUUID(
                                this.uuid
                            ) !== false
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
                            channel.removeVod(this.uuid);
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
                    if (Config.debug)
                        console.debug(
                            `VOD segment ${filename} changed (${eventType})!`
                        );
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

                    if (eventType === "unlink" || eventType === "unlinkDir") {
                        if (Config.getInstance().cfg("storage.deleted_cloud")) {
                            this.cloud_storage = true;
                            if (fs.existsSync(this.filename))
                                this.saveJSON("cloud storage set"); // only save when file exists
                        } else {
                            const seg = this.segments.find(
                                (s) => s.filename === filename
                            );
                            if (seg && !fs.existsSync(filename)) {
                                seg.deleted = true;
                                // this.saveJSON("segment deleted");
                            }
                        }
                    } else if (eventType === "add") {
                        const seg = this.segments.find(
                            (s) => s.filename === filename
                        );
                        if (seg && fs.existsSync(filename)) {
                            seg.deleted = false;
                            this.getMediainfo();
                            // this.saveJSON("segment added");
                        }
                    }
                } else {
                    if (Config.debug)
                        console.debug(
                            `VOD file ${filename} changed (${eventType})!`
                        );
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

    /**
     * Get the channel of the vod
     *
     * @returns Channel
     */
    public getChannel(): TwitchChannel {
        if (!this.channel_uuid)
            throw new Error("No channel UUID set for getChannel");
        // return TwitchChannel.getChannelByLogin(this.streamer_login);
        const channel =
            LiveStreamDVR.getInstance().getChannelByUUID<TwitchChannel>(
                this.channel_uuid
            );
        if (!channel)
            throw new Error(
                `No channel found for getChannel (uuid: ${this.channel_uuid})`
            );
        return channel;
    }

    public async downloadChat(method: "td" | "tcd" = "td"): Promise<boolean> {
        // since tcd does not work anymore, twitchdownloadercli is used instead
        if (!this.external_vod_id) {
            throw new Error("No twitch_vod_id for chat download");
        }
        return await TwitchVOD.downloadChat(
            method,
            this.external_vod_id,
            this.path_chat
        );
    }

    public compareDumpedChatAndDownloadedChat(): void {
        if (!fs.existsSync(this.path_chat)) return;
        if (!fs.existsSync(this.path_chatdump)) return;

        const chat: TwitchCommentDump = JSON.parse(
            fs.readFileSync(this.path_chat, "utf8")
        );
        const chatdump: TwitchCommentDump = JSON.parse(
            fs.readFileSync(this.path_chatdump, "utf8")
        );

        const compareMessages = (
            message1: TwitchComment,
            message2: TwitchComment
        ) => {
            return (
                message1.message.body.trim() == message2.message.body.trim() &&
                message1.commenter.name == message2.commenter.name
            );
        };

        console.log("chat", this.path_chat);

        // compare chat and chatdump
        let not_found = 0;
        for (const i in chatdump.comments) {
            const comment = chatdump.comments[parseInt(i)];
            const findIndex = chat.comments.findIndex(
                (c) => compareMessages(c, comment) && !(c as any).found
            );
            if (findIndex !== -1) {
                (chat.comments[findIndex] as any).found = true;
                // if (parseInt(i) % 100 == 0) console.log(`found @ d${i}/c${findIndex}`, `${comment.commenter.name}: ${comment.message.body}`);
            } else {
                // console.log(chalk.red("not found", `${i}/${chatdump.comments.length}`, `${comment.commenter.name}: ${comment.message.body}`));
                not_found++;
            }
            // if (parseInt(i) > 1000) break;
        }

        console.log(chalk.red("not found amount", not_found));
        /*
        for (const i in chatdump.comments) {
            const comment = chatdump.comments[i];
            const idx = chat.comments.findIndex(c => c.message.body == comment.message.body && c.commenter.name == comment.commenter.name);
            if (idx == -1) {
                console.log(`Comment not found in chatdump: ${comment.message.body}`);
            } else {
                console.log(`${idx-parseInt(i)} comments mismatch`);
                console.log("first downloaded comment date:", chat.comments[0].created_at);
                console.log("first chatdump comment date:", chatdump.comments[0].created_at);
                console.log("difference:", (parseISO(chat.comments[0].created_at).getTime() - parseISO(chatdump.comments[0].created_at).getTime()) / 1000);

                console.log(comment.commenter.name, comment.message.body);
                console.log(chatdump.comments[idx].commenter.name, chatdump.comments[idx].message.body);
                console.log("");
            }
            return;
        }
        */
    }

    public setupStreamNumber(): void {
        let channel;

        try {
            channel = this.getChannel();
        } catch (error) {
            log(
                LOGLEVEL.ERROR,
                "vod.setupStreamNumber",
                `Error getting channel for setupStreamNumber: ${
                    (error as Error).message
                }`
            );
        }

        if (
            channel &&
            channel.current_stream_number !== undefined &&
            this.stream_number === undefined
        ) {
            const s = channel.incrementStreamNumber();
            this.stream_number = s.stream_number;
            // this.stream_season = s.season;
            // this.stream_number = channel.current_stream_number;
            // channel.current_stream_number++;
            this.saveJSON("default stream_number set");
            // KeyValue.getInstance().setInt(`${channel.login}.stream_number`, channel.current_stream_number);
        }
    }

    public postLoad(): void {
        this.setupStreamNumber();
        this.calculateBookmarks();
    }

    /**
     *
     * STATIC
     *
     */

    public static async load(
        filename: string,
        noFixIssues = false
    ): Promise<TwitchVOD> {
        log(
            LOGLEVEL.DEBUG,
            "vod.load",
            `Loading VOD ${filename}, noFixIssues: ${noFixIssues}`
        );

        const basename = path.basename(filename);

        // check if file exists
        if (!fs.existsSync(filename)) {
            throw new Error("VOD JSON does not exist: " + filename);
        }

        // load file
        const data = fs.readFileSync(filename, "utf8");
        if (data.length == 0) {
            throw new Error("File is empty: " + filename);
        }

        // parse file
        const json: TwitchVODJSON = JSON.parse(data);

        if (json.capture_id) {
            const cached_vod = this.getVodByCaptureId(json.capture_id);
            if (cached_vod) {
                console.log(`[TwitchVOD] Returning cached vod ${basename}`);
                return cached_vod;
            }
        }

        if (!("version" in json) || json.version < 2) {
            throw new Error(
                `Invalid VOD JSON version for ${filename}, older versions are no longer supported!`
            );
        }

        // create object
        const vod = new TwitchVOD();

        vod.uuid = json.uuid || "";
        vod.capture_id = json.capture_id || "";
        vod.filename = filename;
        vod.basename = path.basename(filename, ".json");
        vod.directory = path.dirname(filename);

        vod.json = json;

        vod.setupDates();
        await vod.setupUserData();
        vod.setupBasic();
        vod.setupProvider();
        await vod.setupAssoc();
        await vod.setupFiles();

        // add to cache
        this.addVod(vod);

        await vod.startWatching();

        if (Config.getInstance().cfg("contact_sheet.enable")) {
            await vod.createVideoContactSheet();
        }

        if (!noFixIssues) {
            log(LOGLEVEL.DEBUG, "vod.load", `Fixing issues for ${filename}`);
            let noIssues = false;
            do {
                noIssues = await vod.fixIssues("VOD load");
            } while (!noIssues);
        }

        if (!vod.not_started && !vod.is_finalized) {
            log(
                LOGLEVEL.WARNING,
                "vod.load",
                `Loaded VOD ${vod.basename} is not finalized!`
            );
        }

        // vod.compareDumpedChatAndDownloadedChat();
        // vod.getFFProbe();

        vod.loaded = true;

        log(LOGLEVEL.DEBUG, "vod.load", `Loaded VOD ${filename}`);

        return vod;
    }

    /**
     *
     * @param basename
     * @deprecated
     * @returns
     */
    public static getVod(basename: string): TwitchVOD | undefined {
        if (TwitchVOD.hasVod(basename)) {
            return LiveStreamDVR.getInstance()
                .getVods()
                .find<TwitchVOD>(
                    (vod): vod is TwitchVOD =>
                        isTwitchVOD(vod) && vod.basename == basename
                );
        }
    }

    public static getVodByCaptureId(capture_id: string): TwitchVOD | undefined {
        return LiveStreamDVR.getInstance()
            .getVods()
            .find<TwitchVOD>(
                (vod): vod is TwitchVOD =>
                    isTwitchVOD(vod) && vod.capture_id == capture_id
            );
    }

    public static getVodByUUID(uuid: string): TwitchVOD | undefined {
        return LiveStreamDVR.getInstance()
            .getVods()
            .find<TwitchVOD>(
                (vod): vod is TwitchVOD => isTwitchVOD(vod) && vod.uuid == uuid
            );
    }

    public static getVodByProviderId(
        provider_id: string
    ): TwitchVOD | undefined {
        return LiveStreamDVR.getInstance()
            .getVods()
            .find<TwitchVOD>(
                (vod): vod is TwitchVOD =>
                    isTwitchVOD(vod) && vod.external_vod_id == provider_id
            );
    }

    /**
     * Download a video from Twitch to a file
     *
     * @param video_id
     * @param quality
     * @param filename
     * @throws
     * @returns
     */
    public static async downloadVideo(
        video_id: string,
        quality: VideoQuality = "best",
        filename: string
    ): Promise<string> {
        log(
            LOGLEVEL.INFO,
            "tw.vod.downloadVideo",
            `Prepare to download VOD ${video_id}`
        );

        const video = await TwitchVOD.getVideo(video_id);

        if (!video) {
            log(
                LOGLEVEL.ERROR,
                "tw.vod.downloadVideo",
                `Failed to get video info about id ${video_id}`
            );
            throw new Error(`Failed to get video ${video_id}`);
        }

        const basename = path.basename(filename);

        const capture_filename = path.join(
            BaseConfigCacheFolder.cache,
            `${video_id}.ts`
        );
        const converted_filename = filename;

        // download vod
        if (
            !fs.existsSync(capture_filename) &&
            !fs.existsSync(converted_filename)
        ) {
            const video_url = `https://www.twitch.tv/videos/${video_id}`;

            const streamlink_bin = Helper.path_streamlink();
            const ffmpeg_bin = Helper.path_ffmpeg();

            if (!streamlink_bin) {
                log(
                    LOGLEVEL.ERROR,
                    "tw.vod.downloadVideo",
                    "Failed to find streamlink binary!"
                );
                throw new Error("Failed to find streamlink binary!");
            }

            if (!ffmpeg_bin) {
                log(
                    LOGLEVEL.ERROR,
                    "tw.vod.downloadVideo",
                    "Failed to find ffmpeg binary!"
                );
                throw new Error("Failed to find ffmpeg binary!");
            }

            const cmd = [];

            cmd.push("--ffmpeg-ffmpeg", ffmpeg_bin);

            cmd.push("-o", capture_filename); // output file

            cmd.push("--hls-segment-threads", "10");

            cmd.push("--url", video_url); // stream url

            cmd.push("--default-stream", quality); // twitch url and quality

            /**
             * Pass auth token to streamlink if it exists and the config option is enabled
             */
            if (Config.getInstance().cfg("twitch.voddownload.auth_enabled")) {
                if (
                    fs.existsSync(
                        path.join(
                            BaseConfigDataFolder.config,
                            "twitch_oauth.txt"
                        )
                    )
                ) {
                    const token = fs
                        .readFileSync(
                            path.join(
                                BaseConfigDataFolder.config,
                                "twitch_oauth.txt"
                            ),
                            "utf8"
                        )
                        .trim();
                    censoredLogWords.add(token.toString());
                    cmd.push(
                        `--twitch-api-header=Authorization=OAuth ${token}`
                    );
                } else {
                    throw new Error(
                        "Twitch OAuth token not found but auth_enabled is true!"
                    );
                }
            }

            // logging level
            if (Config.debug) {
                cmd.push("--loglevel", "debug");
            } else if (Config.getInstance().cfg("app_verbose", false)) {
                cmd.push("--loglevel", "info");
            }

            log(
                LOGLEVEL.INFO,
                "tw.vod.downloadVideo",
                `Downloading VOD ${video_id}...`
            );

            let totalSegments = 0;
            let currentSegment = 0;
            const ret = await execAdvanced(
                streamlink_bin,
                cmd,
                `download_vod_${video_id}`,
                (logOutput: string) => {
                    const totalSegmentMatch =
                        logOutput.match(/Last Sequence: (\d+)/);
                    if (totalSegmentMatch && !totalSegments) {
                        // console.debug(`Total segments: ${totalSegmentMatch[1]}`, totalSegmentMatch);
                        totalSegments = parseInt(totalSegmentMatch[1]);
                    }
                    const currentSegmentMatch = logOutput.match(
                        /Segment (\d+) complete/
                    );
                    if (currentSegmentMatch && totalSegments > 0) {
                        currentSegment = parseInt(currentSegmentMatch[1]);
                        // console.debug(`Current segment: ${currentSegment}`);
                        progressOutput(
                            `Downloading VOD ${video_id}: ${Math.round(
                                (currentSegment / totalSegments) * 100
                            )}%`
                        );
                        return currentSegment / totalSegments;
                    }

                    if (
                        logOutput.match(
                            /Error when reading from stream: Read timeout, exiting/
                        )
                    ) {
                        log(
                            LOGLEVEL.ERROR,
                            "tw.vod.downloadVideo",
                            logOutput.trim()
                        );
                    }

                    if (logOutput.match(/403 Client Error/)) {
                        log(
                            LOGLEVEL.ERROR,
                            "tw.vod.downloadVideo",
                            "Twitch returned 403, is the VOD deleted or subscriber only?"
                        );
                        throw new Error(
                            "Twitch returned 403, is the VOD deleted or subscriber only?"
                        );
                    }
                }
            );

            log(
                LOGLEVEL.INFO,
                "tw.vod.downloadVideo",
                `Downloaded VOD ${video_id}...}`
            );

            if (
                ret.stdout
                    .join("\n")
                    .includes("error: Unable to find video:") ||
                ret.stderr.join("\n").includes("error: Unable to find video:")
            ) {
                throw new Error("VOD on Twitch not found, is it deleted?");
            }
        }

        if (!fs.existsSync(capture_filename)) {
            log(
                LOGLEVEL.ERROR,
                "tw.vod.downloadVideo",
                `Failed to download ${basename}, no output file found!`
            );
            throw new Error(
                `Failed to download ${basename}, no output file found!`
            );
        }

        if (!fs.existsSync(converted_filename)) {
            log(
                LOGLEVEL.INFO,
                "tw.vod.downloadVideo",
                `Starting remux of ${basename}`
            );

            let chapters_file = "";
            if (Config.getInstance().cfg("create_video_chapters")) {
                chapters_file = path.join(
                    BaseConfigCacheFolder.cache,
                    `${video_id}.ffmpeg.txt`
                );
                const end = TwitchHelper.parseTwitchDuration(video.duration);
                const meta = new FFmpegMetadata()
                    .setArtist(video.user_name)
                    .setTitle(video.title);

                try {
                    meta.addChapter(0, end, video.title, "1/1000");
                } catch (e) {
                    log(
                        LOGLEVEL.ERROR,
                        "tw.vod.downloadVideo",
                        `Failed to add chapter to ${basename}: ${
                            (e as Error).message
                        }`
                    );
                }

                fs.writeFileSync(chapters_file, meta.getString());
            }

            let ret;
            try {
                ret = await remuxFile(
                    capture_filename,
                    converted_filename,
                    undefined,
                    chapters_file
                );
            } catch (error) {
                log(
                    LOGLEVEL.ERROR,
                    "tw.vod.downloadVideo",
                    `Failed to remux ${basename}: ${(error as Error).message}`
                );
                throw new Error(
                    `Failed to remux ${basename}: ${(error as Error).message}`
                );
            }

            if (chapters_file) {
                fs.unlinkSync(chapters_file);
            }

            LiveStreamDVR.getInstance().updateFreeStorageDiskSpace();

            if (ret.success) {
                log(
                    LOGLEVEL.INFO,
                    "tw.vod.downloadVideo",
                    `Successfully remuxed ${basename}, removing ${capture_filename}`
                );
                fs.unlinkSync(capture_filename);
            } else {
                log(
                    LOGLEVEL.INFO,
                    "tw.vod.downloadVideo",
                    `Failed to remux ${basename}`
                );
            }
        }

        const successful =
            fs.existsSync(converted_filename) &&
            fs.statSync(converted_filename).size > 0;

        if (!successful) {
            log(
                LOGLEVEL.ERROR,
                "tw.vod.downloadVideo",
                `Failed to download ${basename}, no file found!`
            );
            throw new Error(`Failed to download ${basename}, no file found!`);
        }

        log(
            LOGLEVEL.INFO,
            "tw.vod.downloadVideo",
            `Download of ${basename} successful`
        );

        Webhook.dispatchAll("video_download", {
            success: true,
            path: converted_filename,
        });

        return converted_filename;
    }

    public static getClipId(clip_url: string): string | false {
        const id_match1 = clip_url.match(/\/clip\/([0-9a-zA-Z_-]+)/);
        const id_match2 = clip_url.match(/clip=([0-9a-zA-Z_-]+)/);
        const id_match3 = clip_url.match(/clips\.twitch\.tv\/([0-9a-zA-Z_-]+)/);
        const id_match4 = clip_url.match(
            /clips\.twitch\.tv\/embed\/([0-9a-zA-Z_-]+)/
        );
        if (id_match1) return id_match1[1];
        if (id_match2) return id_match2[1];
        if (id_match3) return id_match3[1];
        if (id_match4) return id_match4[1];
        return false;
    }

    public static async downloadClip(
        clip_id: string,
        filename: string,
        quality: VideoQuality = "best"
    ): Promise<string> {
        log(LOGLEVEL.INFO, "vod.downloadClip", `Download clip ${clip_id}`);

        const clips = await TwitchVOD.getClips({ id: clip_id });

        if (!clips) {
            log(
                LOGLEVEL.ERROR,
                "vod.downloadClip",
                `Failed to get clip ${clip_id}`
            );
            throw new Error(`Failed to get clip ${clip_id}`);
        }

        const clip = clips[0];

        const basename = path.basename(filename);

        const capture_filename = path.join(
            BaseConfigCacheFolder.cache,
            `${clip_id}.ts`
        );
        const converted_filename = filename;

        // download vod
        if (
            !fs.existsSync(capture_filename) &&
            !fs.existsSync(converted_filename)
        ) {
            const video_url = clip.url;

            const streamlink_bin = Helper.path_streamlink();
            const ffmpeg_bin = Helper.path_ffmpeg();

            if (!streamlink_bin) {
                log(
                    LOGLEVEL.ERROR,
                    "vod.downloadClip",
                    "Failed to find streamlink binary!"
                );
                throw new Error("Failed to find streamlink binary!");
            }

            if (!ffmpeg_bin) {
                log(
                    LOGLEVEL.ERROR,
                    "vod.downloadClip",
                    "Failed to find ffmpeg binary!"
                );
                throw new Error("Failed to find ffmpeg binary!");
            }

            const cmd = [];

            cmd.push("--ffmpeg-ffmpeg", ffmpeg_bin);

            cmd.push("-o", capture_filename); // output file

            cmd.push("--hls-segment-threads", "10");

            cmd.push("--url", video_url); // stream url

            cmd.push("--default-stream", quality); // twitch url and quality

            // cmd.push("--force-progress");

            // logging level
            if (Config.debug) {
                cmd.push("--loglevel", "debug");
            } else if (Config.getInstance().cfg("app_verbose", false)) {
                cmd.push("--loglevel", "info");
            }

            log(
                LOGLEVEL.INFO,
                "vod.downloadClip",
                `Downloading clip ${clip_id}...`
            );

            let totalSegments = 0;
            let currentSegment = 0;
            const ret = await execAdvanced(
                streamlink_bin,
                cmd,
                `download_clip_${clip_id}`,
                (logOutput: string) => {
                    const totalSegmentMatch =
                        logOutput.match(/Last Sequence: (\d+)/);
                    if (totalSegmentMatch && !totalSegments) {
                        // console.debug(`Total segments: ${totalSegmentMatch[1]}`, totalSegmentMatch);
                        totalSegments = parseInt(totalSegmentMatch[1]);
                    }
                    const currentSegmentMatch = logOutput.match(
                        /Segment (\d+) complete/
                    );
                    if (currentSegmentMatch && totalSegments > 0) {
                        currentSegment = parseInt(currentSegmentMatch[1]);
                        // console.debug(`Current segment: ${currentSegment}`);
                        return currentSegment / totalSegments;
                    }

                    if (
                        logOutput.match(
                            /Error when reading from stream: Read timeout, exiting/
                        )
                    ) {
                        log(
                            LOGLEVEL.ERROR,
                            "vod.downloadClip",
                            logOutput.trim()
                        );
                    }
                }
            );

            log(
                LOGLEVEL.INFO,
                "vod.downloadClip",
                `Downloaded clip ${clip_id}...}`
            );

            if (
                ret.stdout
                    .join("\n")
                    .includes("error: Unable to find video:") ||
                ret.stderr.join("\n").includes("error: Unable to find video:")
            ) {
                throw new Error("Clip on Twitch not found, is it deleted?");
            }
        }

        if (!fs.existsSync(converted_filename)) {
            log(
                LOGLEVEL.INFO,
                "vod.downloadClip",
                `Starting remux of ${basename}`
            );

            const metadata = new FFmpegMetadata()
                .setAlbumArtist(clip.creator_name)
                .setArtist(clip.broadcaster_name)
                .setTitle(clip.title)
                .setComment(
                    `Clipped by ${clip.creator_name}.\nSource: ${clip.url}\nClip ID: ${clip.id}`
                )
                .setDate(parseJSON(clip.created_at))
                .writeToFile(
                    path.join(
                        BaseConfigCacheFolder.cache,
                        `${clip_id}.ffmpeg.txt`
                    )
                );

            let ret;
            try {
                ret = await remuxFile(
                    capture_filename,
                    converted_filename,
                    undefined,
                    metadata
                );
            } catch (error) {
                log(
                    LOGLEVEL.ERROR,
                    "vod.downloadClip",
                    `Failed to remux ${basename}: ${(error as Error).message}`
                );
                throw new Error(
                    `Failed to remux ${basename}: ${(error as Error).message}`
                );
            }

            if (ret.success) {
                log(
                    LOGLEVEL.INFO,
                    "vod.downloadClip",
                    `Successfully remuxed ${basename}, removing ${capture_filename}`
                );
                fs.unlinkSync(capture_filename);
            } else {
                log(
                    LOGLEVEL.INFO,
                    "vod.downloadClip",
                    `Failed to remux ${basename}`
                );
            }
        }

        const successful =
            fs.existsSync(converted_filename) &&
            fs.statSync(converted_filename).size > 0;

        if (!successful) {
            log(
                LOGLEVEL.ERROR,
                "vod.downloadClip",
                `Failed to download ${basename}, no file found!`
            );
            throw new Error(`Failed to download ${basename}, no file found!`);
        }

        log(
            LOGLEVEL.INFO,
            "vod.downloadClip",
            `Download of ${basename} successful`
        );

        Webhook.dispatchAll("video_download", {
            success: true,
            path: converted_filename,
        });

        return converted_filename;
    }

    /**
     * Get video information from Twitch
     * @param video_id
     * @throws
     * @returns
     */
    static async getVideo(video_id: string): Promise<false | Video> {
        if (!video_id) throw new Error("No video id");

        if (!TwitchHelper.hasAxios()) {
            throw new Error("Axios is not initialized");
        }

        let response;

        try {
            response = await TwitchHelper.getRequest<VideosResponse>(
                "/helix/videos/",
                {
                    params: {
                        id: video_id,
                    } as VideoRequestParams,
                }
            );
        } catch (err) {
            log(
                LOGLEVEL.ERROR,
                "vod.getVideo",
                `Tried to get video id ${video_id} but got error ${
                    (err as Error).message
                }`
            );
            if (axios.isAxiosError(err)) {
                if (err.response && err.response.status === 404) {
                    return false;
                }
                throw new Error(
                    `Tried to get video id ${video_id} but got error: ${
                        (err as Error).message
                    }`
                );
            }
            return false;
        }

        const json = response.data;

        if (json.data.length === 0) {
            log(
                LOGLEVEL.ERROR,
                "vod.getVideo",
                `Tried to get video id ${video_id} but got no data`
            );
            return false;
        }

        return json.data[0];
    }

    /**
     * Get information about multiple videos in a single request, returns an array of videos.
     * MAX 100 ids
     * @param ids
     * @returns
     */
    static async getVideos(ids: string[]): Promise<false | Video[]> {
        if (!ids || ids.length == 0) throw new Error("No video ids");

        if (!TwitchHelper.hasAxios()) {
            throw new Error("Axios is not initialized");
        }

        if (ids.length > 100) {
            throw new Error("Can only get 100 videos at a time");
        }

        log(
            LOGLEVEL.DEBUG,
            "vod.getVideos",
            `Getting videos ${ids.join(", ")}`
        );

        let response;

        try {
            response = await TwitchHelper.getRequest<VideosResponse>(
                "/helix/videos/",
                {
                    params: {
                        id: ids,
                    } as VideoRequestParams,
                }
            );
        } catch (err) {
            log(
                LOGLEVEL.ERROR,
                "vod.getVideos",
                `Tried to get videos ${ids.join(", ")} but got error ${
                    (err as Error).message
                }`
            );
            if (axios.isAxiosError(err)) {
                if (err.response && err.response.status === 404) {
                    return false;
                }
                throw new Error(
                    `Tried to get videos ${ids.join(", ")} but got error: ${
                        (err as Error).message
                    }`
                );
            }

            return false;
        }

        const json = response.data;

        if (json.data.length === 0) {
            log(
                LOGLEVEL.ERROR,
                "vod.getVideos",
                `Tried to get videos ${ids.join(", ")} but got no data`
            );
            return false;
        }

        return json.data;
    }

    /**
     * Get information about multiple videos in a single request, returns a record with the video id as key and the video as value
     * MAX 100 ids
     * @param ids
     * @returns
     */
    static async getVideosRecord(
        ids: string[]
    ): Promise<Record<string, Video | false> | false> {
        const videos = await TwitchVOD.getVideos(ids);

        if (!videos) return false;

        const ret: Record<string, Video | false> = {};

        for (const video of videos) {
            ret[video.id] = video;
        }

        return ret;
    }

    static async getLatestVideos(channel_id: string): Promise<false | Video[]> {
        if (!channel_id) throw new Error("No channel id");

        if (!TwitchHelper.hasAxios()) {
            throw new Error("Axios is not initialized");
        }

        let response;

        try {
            response = await TwitchHelper.getRequest<VideosResponse>(
                "/helix/videos/",
                {
                    params: {
                        user_id: channel_id,
                        first: 100,
                        // type: "archive",
                    } as VideoRequestParams,
                }
            );
        } catch (e) {
            log(
                LOGLEVEL.ERROR,
                "vod.getVideos",
                `Tried to get videos for channel id ${channel_id} but got error ${e}`
            );
            return false;
        }

        const json = response.data;

        if (json.data.length === 0) {
            log(
                LOGLEVEL.ERROR,
                "vod.getVideos",
                `Tried to get videos for channel id ${channel_id} but got no data`
            );
            return false;
        }

        return json.data;
    }

    static async getVideosProxy(
        channel_id: string
    ): Promise<false | ProxyVideo[]> {
        if (!channel_id) throw new Error("No channel id");

        if (!TwitchHelper.hasAxios()) {
            throw new Error("Axios is not initialized");
        }

        let response;

        try {
            response = await TwitchHelper.getRequest<VideosResponse>(
                "/helix/videos/",
                {
                    params: {
                        user_id: channel_id,
                        first: 100,
                        // type: "archive",
                    } as VideoRequestParams,
                }
            );
        } catch (e) {
            log(
                LOGLEVEL.ERROR,
                "vod.getVideosProxy",
                `Tried to get videos for channel id ${channel_id} but got error ${e}`
            );
            return false;
        }

        const json = response.data;

        if (json.data.length === 0) {
            log(
                LOGLEVEL.ERROR,
                "vod.getVideosProxy",
                `Tried to get videos for channel id ${channel_id} but got no data`
            );
            return false;
        }

        log(
            LOGLEVEL.DEBUG,
            "vod.getVideosProxy",
            `Got ${
                json.data.length
            } videos for channel id ${channel_id}: ${JSON.stringify(json.data)}`
        );

        return json.data.map((item) => {
            return {
                id: item.id,
                title: item.title,
                description: item.description,
                url: `https://www.twitch.tv/videos/${item.id}`,
                thumbnail: item.thumbnail_url,
                created_at: item.created_at,
                duration: TwitchHelper.parseTwitchDuration(item.duration),
                view_count: item.view_count,
                muted_segments: item.muted_segments,
                stream_id: item.stream_id,
                type: item.type,
            } as ProxyVideo;
        });
    }

    static async getVideoProxy(video_id: string): Promise<false | ProxyVideo> {
        if (!video_id) throw new Error("No video id");

        if (!TwitchHelper.hasAxios()) {
            throw new Error("Axios is not initialized");
        }

        let response;

        try {
            response = await TwitchHelper.getRequest<VideosResponse>(
                "/helix/videos/",
                {
                    params: {
                        id: video_id,
                    } as VideoRequestParams,
                }
            );
        } catch (err) {
            log(
                LOGLEVEL.ERROR,
                "vod.getVideoProxy",
                `Tried to get video id ${video_id} but got error ${
                    (err as Error).message
                }`
            );
            if (axios.isAxiosError(err)) {
                if (err.response && err.response.status === 404) {
                    return false;
                }
                throw new Error(
                    `Tried to get video id ${video_id} but got error: ${
                        (err as Error).message
                    }`
                );
            }
            return false;
        }

        const json = response.data;

        if (json.data.length === 0) {
            log(
                LOGLEVEL.ERROR,
                "vod.getVideoProxy",
                `Tried to get video id ${video_id} but got no data`
            );
            return false;
        }

        const item = json.data[0];

        return {
            id: item.id,
            title: item.title,
            description: item.description,
            url: `https://www.twitch.tv/videos/${item.id}`,
            thumbnail: item.thumbnail_url,
            created_at: item.created_at,
            duration: TwitchHelper.parseTwitchDuration(item.duration),
            view_count: item.view_count,
            muted_segments: item.muted_segments,
        } as ProxyVideo;
    }

    static async getClips(
        {
            broadcaster_id,
            game_id,
            id,
        }: {
            broadcaster_id?: string;
            game_id?: string;
            id?: string[] | string;
        },
        max_age?: number,
        limit = 20
    ): Promise<false | Clip[]> {
        if (!broadcaster_id && !game_id && !id)
            throw new Error("No broadcaster id, game id or id provided");

        if (!TwitchHelper.hasAxios()) {
            throw new Error("Axios is not initialized");
        }

        let response;
        const params = new URLSearchParams();
        if (broadcaster_id) params.append("broadcaster_id", broadcaster_id);
        if (game_id) params.append("game_id", game_id);
        if (id && typeof id === "string") params.append("id", id);
        if (id && Array.isArray(id) && id.length > 0) {
            id.forEach((id) => {
                params.append("id", id);
            });
        }

        if (max_age) {
            params.append(
                "started_at",
                new Date(Date.now() - max_age * 1000).toISOString()
            );
            params.append("ended_at", new Date().toISOString());
        }

        if (limit) {
            params.append("first", limit.toString());
        }

        let cursor = "";
        let page = 0;

        const clips: Clip[] = [];

        do {
            if (cursor) params.set("after", cursor);

            try {
                response = await TwitchHelper.getRequest<ClipsResponse>(
                    "/helix/clips",
                    {
                        params: params,
                    }
                );
            } catch (e) {
                log(
                    LOGLEVEL.ERROR,
                    "vod.getClips",
                    `Tried to get clips but got error: ${(e as Error).message}`
                );
                if (axios.isAxiosError(e) && e.response) {
                    console.debug("data", e.response.data);
                }
                // return false;
                break;
            }

            const json = response.data;

            if (json.pagination && json.pagination.cursor) {
                cursor = json.pagination.cursor;
            } else {
                cursor = "";
            }

            if (json.data.length === 0) {
                log(
                    LOGLEVEL.ERROR,
                    "vod.getClips",
                    "Tried to get clips but got no data"
                );
                break;
            }

            log(
                LOGLEVEL.DEBUG,
                "vod.getClips",
                `Got response for page ${page} with ${response.data.data.length} clips`
            );

            clips.push(...json.data);

            page++;
        } while (clips.length < limit && cursor);

        if (clips.length === 0) {
            return false;
        }

        return clips;
    }

    static async getGqlVideoChapters(
        video_id: string
    ): Promise<VideoMomentEdge[]> {
        // new StringContent("{\"extensions\":{\"persistedQuery\":{\"sha256Hash\":\"8d2793384aac3773beab5e59bd5d6f585aedb923d292800119e03d40cd0f9b41\",\"version\":1}},\"operationName\":\"VideoPlayer_ChapterSelectButtonVideo\",\"variables\":{\"videoID\":\"" + videoId + "\"}}", Encoding.UTF8, "application/json")
        const response = await TwitchHelper.gqlRequest<GqlVideoChapterResponse>(
            {
                operationName: "VideoPlayer_ChapterSelectButtonVideo",
                variables: {
                    videoID: video_id,
                },
                extensions: {
                    persistedQuery: {
                        version: 1,
                        sha256Hash:
                            "8d2793384aac3773beab5e59bd5d6f585aedb923d292800119e03d40cd0f9b41",
                    },
                },
            }
        );

        return response.data.video.moments.edges;
    }

    static async getGqlVideoInfo(video_id: string) {
        // new StringContent("{\"query\":\"query{video(id:\\\"" + videoId + "\\\"){title,thumbnailURLs(height:180,width:320),createdAt,lengthSeconds,owner{id,displayName},viewCount,game{id,displayName,boxArtURL},description}}\",\"variables\":{}}", Encoding.UTF8, "application/json")

        const response = await TwitchHelper.gqlRequest<GqlVideoInfoResponse>({
            query: `query{video(id:"${video_id}"){title,thumbnailURLs(height:180,width:320),createdAt,lengthSeconds,owner{id,displayName},viewCount,game{id,displayName,boxArtURL},description}}`,
            variables: {},
        });

        return response.data.video;
    }

    public static async downloadChat(
        method: "td" | "tcd" = "td",
        vod_id: string,
        output: string
    ): Promise<boolean> {
        return method == "td"
            ? await this.downloadChatTD(vod_id, output)
            : await this.downloadChatTCD(vod_id, output);
    }

    public static downloadChatTD(
        vod_id: string,
        output: string
    ): Promise<boolean> {
        return new Promise((resolve, reject) => {
            const bin = Helper.path_twitchdownloader();

            if (!bin || !fs.existsSync(bin)) {
                reject(new Error("twitchdownloadercli not found"));
                return;
            }

            if (!vod_id) {
                reject(new Error("No VOD ID"));
                return;
            }

            if (fs.existsSync(output)) {
                log(
                    LOGLEVEL.INFO,
                    "vod.downloadChatTD",
                    `Chat already exists for ${vod_id}`
                );
                resolve(true);
                return;
            }

            const args: string[] = [];
            args.push("--mode", "ChatDownload");
            args.push("--temp-path", BaseConfigCacheFolder.cache);
            // args.push("--ffmpeg-path", Helper.path_ffmpeg() || ""); // ffmpeg is not needed for chat download
            args.push("--id", vod_id);
            args.push("-o", output);

            const env = {
                DOTNET_BUNDLE_EXTRACT_BASE_DIR: BaseConfigCacheFolder.dotnet,
                TEMP: BaseConfigCacheFolder.cache,
                PWD: BaseConfigCacheFolder.dotnet,
            };

            log(
                LOGLEVEL.INFO,
                "vod.downloadChatTD",
                `Downloading chat for ${vod_id}`
            );

            const job = startJob(`chatdownload_${vod_id}`, bin, args, env);
            if (!job) {
                reject(new Error("Job failed"));
                return;
            }

            // let lastPercent = -1;
            // [STATUS] - Downloading 10%
            job.on("log", (stream: string, text: string) => {
                const match = text.match(/\[STATUS\] - Downloading (\d+)%/);
                if (match) {
                    const percent = parseInt(match[1]);
                    /*
                    if (percent != lastPercent && percent % 10 == 0) {
                        logAdvanced(LOGLEVEL.INFO, "vod", `Downloading chat for ${vod_id} (${percent}%)`);
                        lastPercent = percent;
                    }
                    */
                    job.setProgress(percent / 100);
                } else {
                    console.debug("chat download log text", text);
                }
            });

            job.on("close", (code) => {
                if (fs.existsSync(output) && fs.statSync(output).size > 0) {
                    log(
                        LOGLEVEL.INFO,
                        "vod.downloadChatTD",
                        `Chat downloaded for ${vod_id}`
                    );
                    resolve(true);
                } else {
                    log(
                        LOGLEVEL.ERROR,
                        "vod.downloadChatTD",
                        `Chat couldn't be downloaded for ${vod_id}`
                    );
                    reject(new Error("Chat couldn't be downloaded"));
                }
            });
        });
    }

    public static downloadChatTCD(
        vod_id: string,
        output: string
    ): Promise<boolean> {
        return new Promise((resolve, reject) => {
            const bin = Helper.path_tcd();

            if (!bin || !fs.existsSync(bin)) {
                reject(new Error("tcd not found"));
                return;
            }

            if (!vod_id) {
                reject(new Error("No VOD ID"));
                return;
            }

            if (fs.existsSync(output)) {
                log(
                    LOGLEVEL.INFO,
                    "vod.downloadChatTCD",
                    `Chat already exists for ${vod_id}`
                );
                resolve(true);
                return;
            }

            const temp_filepath = path.join(
                BaseConfigCacheFolder.cache,
                `${vod_id}.json`
            );

            if (fs.existsSync(temp_filepath)) {
                fs.renameSync(temp_filepath, output);
                log(
                    LOGLEVEL.INFO,
                    "vod.downloadChatTCD",
                    `Chat renamed for ${vod_id}`
                );
                resolve(true);
            }

            const args: string[] = [];
            args.push(
                "--settings-file",
                path.join(BaseConfigDataFolder.config, "tcd_settings.json")
            );
            args.push("--video", vod_id);
            args.push("--client-id", Config.getInstance().cfg("api_client_id"));
            args.push(
                "--client-secret",
                Config.getInstance().cfg("api_secret")
            );
            args.push("--format", "json");
            if (Config.debug || Config.getInstance().cfg("app_verbose")) {
                args.push("--verbose");
                args.push("--debug");
            }
            args.push("--output", BaseConfigCacheFolder.cache);

            log(
                LOGLEVEL.INFO,
                "vod.downloadChatTCD",
                `Downloading chat for ${vod_id}`
            );

            const job = startJob(`chatdownload_${vod_id}`, bin, args);
            if (!job) {
                reject(new Error("Job failed"));
                return;
            }

            job.on("close", (code) => {
                if (
                    fs.existsSync(temp_filepath) &&
                    fs.statSync(temp_filepath).size > 0
                ) {
                    log(
                        LOGLEVEL.INFO,
                        "vod.downloadChatTCD",
                        `Chat downloaded for ${vod_id}`
                    );
                    fs.renameSync(temp_filepath, output);
                    resolve(true);
                } else {
                    log(
                        LOGLEVEL.ERROR,
                        "vod.downloadChatTCD",
                        `Chat couldn't be downloaded for ${vod_id}`
                    );
                    reject(new Error("Chat couldn't be downloaded"));
                }
            });
        });
    }

    private watchViewerCountInterval?: NodeJS.Timeout;
    private watchViewerCountTimeBetweenChecks: number = 1000 * 60 * 5; // 5 minutes
    public startWatchingViewerCount() {
        if (this.watchViewerCountInterval) {
            throw new Error("Already watching");
        }
        log(
            LOGLEVEL.INFO,
            "vod.startWatchingViewerCount",
            `Watching viewer count for ${this.basename}`
        );
        this.watchViewerCountInterval = xInterval(() => {
            this.addViewerCount();
        }, this.watchViewerCountTimeBetweenChecks);
        this.addViewerCount();
    }

    public stopWatchingViewerCount() {
        if (this.watchViewerCountInterval) {
            xClearInterval(this.watchViewerCountInterval);
            this.watchViewerCountInterval = undefined;
        }
    }

    public async addViewerCount() {
        if (!LiveStreamDVR.getInstance().getVodByUUID(this.uuid)) {
            log(
                LOGLEVEL.WARNING,
                "vod.addViewerCount",
                `VOD ${this.basename} was removed without stopping watching viewer count`
            );
            this.stopWatchingViewerCount();
            return;
        }
        const streams = await TwitchChannel.getStreams(
            this.getChannel().internalId
        );
        if (!streams || streams.length == 0) {
            return;
        }
        const stream = streams[0];
        this.viewers.push({
            amount: stream.viewer_count,
            timestamp: new Date(),
        });
        log(
            LOGLEVEL.INFO,
            "vod.addViewerCount",
            `Added viewer count for ${this.basename} (${stream.viewer_count})`
        );
        this.saveJSON("add viewer count");
    }
}
