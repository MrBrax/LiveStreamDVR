import { spawn } from "node:child_process";
import { format, formatDistanceToNow, isValid, parseJSON } from "date-fns";
import fs from "node:fs";
import { IncomingHttpHeaders } from "node:http";
import path from "node:path";
import { TwitchVODChapterJSON } from "Storage/JSON";
import { VideoQuality } from "@common/Config";
import { ChannelUpdateEvent } from "@common/TwitchAPI/EventSub/ChannelUpdate";
import { BaseConfigDataFolder } from "../../BaseConfig";
import { KeyValue } from "../../KeyValue";
import { Job } from "../../Job";
import { TwitchChannel } from "../Twitch/TwitchChannel";
import { Config } from "../../Config";
import { RemuxReturn } from "../../../Providers/Twitch";
import {  Log } from "../../Log";
import { TwitchVOD } from "../Twitch/TwitchVOD";
import { Webhook } from "../../Webhook";
import { JobStatus, nonGameCategories, NotificationCategory } from "@common/Defs";
import chalk from "chalk";
import { Sleep } from "../../../Helpers/Sleep";
import { ClientBroker } from "../../ClientBroker";
import sanitize from "sanitize-filename";
import { formatString } from "@common/Format";
import { Exporter, GetExporter } from "../../../Controllers/Exporter";
import { VodBasenameTemplate } from "@common/Replacements";
import { ChannelTypes, VODTypes } from "../../LiveStreamDVR";
import { Helper } from "../../Helper";
import { ExporterOptions } from "@common/Exporter";
import {isTwitchVODChapter} from "../../../Helpers/Types";

// import { ChatDumper } from "../../../twitch-chat-dumper/ChatDumper";

export class BaseAutomator {

    vod: VODTypes | undefined;
    channel: ChannelTypes | undefined;

    realm = "base";

    public broadcaster_user_id = "";
    public broadcaster_user_login = "";
    public broadcaster_user_name = "";

    payload_headers: IncomingHttpHeaders | undefined;

    /** @deprecated */
    // data_cache: EventSubResponse | undefined;

    force_record = false;
    stream_resolution: VideoQuality | undefined;

    capture_filename = "";
    converted_filename = "";
    chat_filename = "";

    captureJob: Job | undefined;
    chatJob: Job | undefined;

    private vod_season?: string; // why is this a string
    private vod_absolute_season?: number;
    private vod_episode?: number;

    public basedir(): string {
        if (Config.getInstance().cfg<boolean>("vod_folders")) {
            return path.join(
                this.getLogin(),
                this.vodFolderTemplate()
            );
        } else {
            return this.getLogin();
        }
    }

    public vodFolderTemplate(): string {

        const date = parseJSON(this.getStartDate());

        if (!date || !isValid(date)) {
            Log.logAdvanced(Log.Level.ERROR, "automator.vodFolderTemplate", `Invalid start date: ${this.getStartDate()}`);
        }

        if (!this.channel) {
            throw new Error("No channel for template");
        }

        const variables: VodBasenameTemplate = {
            login: this.getLogin(),
            internalName: this.channel.internalName,
            displayName: this.channel.displayName,
            date: this.getStartDate().replaceAll(":", "_"),
            year: isValid(date) ? format(date, "yyyy") : "",
            year_short: isValid(date) ? format(date, "yy") : "",
            month: isValid(date) ? format(date, "MM") : "",
            day: isValid(date) ? format(date, "dd") : "",
            hour: isValid(date) ? format(date, "HH") : "",
            minute: isValid(date) ? format(date, "mm") : "",
            second: isValid(date) ? format(date, "ss") : "",
            id: this.getVodID().toString(),
            season: this.vod_season || "",
            absolute_season: this.vod_absolute_season ? this.vod_absolute_season.toString().padStart(2, "0") : "",
            episode: this.vod_episode ? this.vod_episode.toString().padStart(2, "0") : "",
        };

        return sanitize(formatString(Config.getInstance().cfg("filename_vod_folder"), variables));
    }

    public vodBasenameTemplate(): string {

        const date = parseJSON(this.getStartDate());

        if (!date || !isValid(date)) {
            Log.logAdvanced(Log.Level.ERROR, "automator.vodBasenameTemplate", `Invalid start date: ${this.getStartDate()}`);
        }

        if (!this.channel) {
            throw new Error("No channel for template");
        }

        const variables: VodBasenameTemplate = {
            login: this.getLogin(),
            internalName: this.channel.internalName,
            displayName: this.channel.displayName,
            date: this.getStartDate().replaceAll(":", "_"),
            year: isValid(date) ? format(date, "yyyy") : "",
            year_short: isValid(date) ? format(date, "yy") : "",
            month: isValid(date) ? format(date, "MM") : "",
            day: isValid(date) ? format(date, "dd") : "",
            hour: isValid(date) ? format(date, "HH") : "",
            minute: isValid(date) ? format(date, "mm") : "",
            second: isValid(date) ? format(date, "ss") : "",
            id: this.getVodID().toString(),
            season: this.vod_season || "",
            absolute_season: this.vod_absolute_season ? this.vod_absolute_season.toString().padStart(2, "0") : "",
            episode: this.vod_episode ? this.vod_episode.toString().padStart(2, "0") : "",
        };

        return sanitize(formatString(Config.getInstance().cfg("filename_vod"), variables));
    }

    public fulldir(): string {
        return path.join(BaseConfigDataFolder.vod, this.basedir());
    }

    public getVodID(): string | false {
        const id = KeyValue.getInstance().get(`${this.getLogin()}.vod.id`);
        if (id) {
            return id;
        } else {
            Log.logAdvanced(Log.Level.ERROR, "automator.getVodID", `No VOD ID for ${this.getLogin()}`);
            return false;
        }
        // return $this->payload['id'];
    }

    public getUserID(): string {
        return this.broadcaster_user_id;
    }

    public getUsername(): string {
        return this.broadcaster_user_name;
    }

    public getLogin(): string {
        return this.broadcaster_user_login;
    }

    public getStartDate(): string {
        return KeyValue.getInstance().get(`${this.getLogin()}.vod.started_at`) || "";
    }

    public streamURL(): string {
        // return `twitch.tv/${this.broadcaster_user_login}`;
        if (!this.channel) {
            throw new Error("No channel for stream url");
        }
        return this.channel.livestreamUrl;
    }

    // public async handle(data: EventSubResponse, request: express.Request): Promise<boolean> {
    //     return false;
    // }

    public async updateGame(from_cache = false, no_run_check = false) {
        return false;
    }

    notifyChapterChange(channel: TwitchChannel) {

        const vod = channel.latest_vod;
        if (!vod) return;

        if (!vod.chapters || vod.chapters.length == 0) return;

        const current_chapter = vod.chapters[vod.chapters.length - 1];
        const previous_chapter = vod.chapters.length > 2 ? vod.chapters[vod.chapters.length - 2] : null;

        let title = "";
        const body = current_chapter.title;
        const icon = channel.profilePictureUrl;

        if (current_chapter && !isTwitchVODChapter(current_chapter)) return;
        if (previous_chapter && !isTwitchVODChapter(previous_chapter)) return;

        let category: NotificationCategory = "streamStatusChange";
        if (
            (!previous_chapter?.game_id && current_chapter.game_id) || // game changed from null to something
            (previous_chapter?.game_id && current_chapter.game_id && previous_chapter.game_id !== current_chapter.game_id) // game changed
        ) {
            if (nonGameCategories.includes(current_chapter.game_name)) {
                if (current_chapter.game?.isFavourite()) {
                    title = `${channel.displayName} is online with one of your favourite categories: ${current_chapter.game_name}!`;
                    category = "streamStatusChangeFavourite";
                } else if (current_chapter.game_name) {
                    title = `${channel.displayName} is now streaming ${current_chapter.game_name}!`;
                } else {
                    title = `${channel.displayName} is now streaming without a category!`;
                }
            } else {
                if (current_chapter.game?.isFavourite()) {
                    title = `${channel.displayName} is now playing one of your favourite games: ${current_chapter.game_name}!`;
                    category = "streamStatusChangeFavourite";
                } else if (current_chapter.game_name) {
                    title = `${channel.displayName} is now playing ${current_chapter.game_name}!`;
                } else {
                    title = `${channel.displayName} is now streaming without a game!`;
                }

            }

        } else if (previous_chapter?.title !== current_chapter.title) {
            title = `${channel.displayName} changed title, still playing/streaming ${current_chapter.game_name}!`;
        }

        ClientBroker.notify(title, body, icon, category, this.channel?.livestreamUrl);

    }

    public async getChapterData(event: ChannelUpdateEvent): Promise<TwitchVODChapterJSON> {

        const chapter_data = {
            started_at: new Date().toISOString(),
            game_id: event.category_id,
            game_name: event.category_name,
            // 'viewer_count' 	: $data_viewer_count,
            title: event.title,
            is_mature: event.is_mature,
            online: true,
        } as TwitchVODChapterJSON;

        // extra metadata with a separate api request
        if (Config.getInstance().cfg("api_metadata")) {

            const streams = await TwitchChannel.getStreams(this.getUserID());

            if (streams && streams.length > 0) {

                if (!KeyValue.getInstance().getBool(`${this.broadcaster_user_login}.online`)) {
                    Log.logAdvanced(Log.Level.INFO, "automator.getChapterData", `Get chapter data: Channel ${this.broadcaster_user_login} is offline but we managed to get stream data, so it's online? 🤔`);
                }

                KeyValue.getInstance().setBool(`${this.broadcaster_user_login}.online`, true); // if status has somehow been set to false, set it back to true

                const stream = streams[0];

                if (stream.viewer_count !== undefined) {

                    chapter_data.viewer_count = stream.viewer_count;

                } else {

                    Log.logAdvanced(Log.Level.ERROR, "automator.getChapterData", "Get chapter data: No viewer count in metadata request.");

                }

            } else {

                Log.logAdvanced(Log.Level.ERROR, "automator.getChapterData", "Get chapter data: No streams in metadata request.");

            }
        }

        return chapter_data;

    }

    private async cleanup() {
        // const vods = fs.readdirSync(TwitchHelper.vodFolder(this.getLogin())).filter(f => f.startsWith(`${this.getLogin()}_`) && f.endsWith(".json"));

        if (!this.channel) {
            Log.logAdvanced(Log.Level.ERROR, "automator.cleanup", `Tried to cleanup ${this.broadcaster_user_login} but channel was not available.`);
            return;
        }

        await this.channel.cleanupVods(this.vod?.uuid);

    }

    /**
     * End of stream
     *
     * This is called when the stream goes offline via eventsub, NOT when the stream stops capturing by streamlink
     * 
     * Available fields:
     * - channel
     */
    public async end(): Promise<boolean> {

        Log.logAdvanced(Log.Level.INFO, "automator.end", "Stream end");

        KeyValue.getInstance().set(`${this.broadcaster_user_login}.last.offline`, new Date().toISOString());
        Log.logAdvanced(Log.Level.INFO, "automator.end", `Stream offline for ${this.broadcaster_user_login}`);

        // const channel = TwitchChannel.getChannelByLogin(this.broadcaster_user_login);

        // channel offline notification
        if (this.channel) {
            ClientBroker.notify(
                `${this.broadcaster_user_login} has gone offline!`,
                this.channel && this.channel.latest_vod && this.channel.latest_vod.started_at ? `Was streaming for ${formatDistanceToNow(this.channel.latest_vod.started_at)}.` : "",
                this.channel.profilePictureUrl,
                "streamOffline",
                this.channel.livestreamUrl
            );
        }

        // KeyValue.getInstance().set("${this.broadcaster_user_login}.online", "0");

        // write to history
        fs.writeFileSync(path.join(BaseConfigDataFolder.history, `${this.broadcaster_user_login}.jsonline`), JSON.stringify({ time: new Date(), action: "offline" }) + "\n", { flag: "a" });


        // download latest vod from channel. is the end hook late enough for it to be available?
        if (this.channel && this.channel.download_vod_at_end) {
            let download_success = "";
            try {
                download_success = await this.channel.downloadLatestVod(this.channel.download_vod_at_end_quality);
            } catch (err) {
                Log.logAdvanced(Log.Level.ERROR, "automator.end", `Error downloading VOD at end: ${this.vodBasenameTemplate()} (${(err as Error).message})`, err);
            }
            if (download_success !== "") {
                Log.logAdvanced(Log.Level.INFO, "automator.end", `Downloaded VOD at end: ${this.vodBasenameTemplate()}`);
                if (!this.vod && this.channel.latest_vod !== undefined) {
                    this.vod = this.channel.latest_vod;
                }
            }
        }

        KeyValue.getInstance().delete(`${this.broadcaster_user_login}.online`);
        KeyValue.getInstance().delete(`${this.broadcaster_user_login}.vod.id`);
        KeyValue.getInstance().delete(`${this.broadcaster_user_login}.vod.started_at`);

        return true;

    }

    /**
     * End of download
     * 
     * This is called when the stream has been downloaded via streamlink, NOT when the stream goes offline via eventsub
     * 
     * Available fields:
     * - channel
     * - vod
     * - basename
     */
    public async onEndDownload(): Promise<boolean> {
        // download chat and optionally burn it
        // TODO: call this when a non-captured stream ends too
        if (this.channel && this.vod) {
            if (this.vod instanceof TwitchVOD && this.channel.download_chat && this.vod.twitch_vod_id) {
                Log.logAdvanced(Log.Level.INFO, "automator.onEndDownload", `Auto download chat on ${this.vod.basename}`);

                try {
                    await this.vod.downloadChat();
                } catch (error) {
                    Log.logAdvanced(Log.Level.ERROR, "automator.onEndDownload", `Failed to download chat for ${this.vod.basename}: ${(error as Error).message}`);
                }

                if (this.channel.burn_chat) {
                    // Log.logAdvanced(Log.Level.ERROR, "automator.onEndDownload", "Automatic chat burning has been disabled until settings have been implemented.");
                    await this.burnChat(); // TODO: should this await?
                }
            }

            if (Config.getInstance().cfg("exporter.auto.enabled")) {

                const options: ExporterOptions = {
                    vod: this.vod.uuid,
                    directory: Config.getInstance().cfg("exporter.default.directory"),
                    host: Config.getInstance().cfg("exporter.default.host"),
                    username: Config.getInstance().cfg("exporter.default.username"),
                    password: Config.getInstance().cfg("exporter.default.password"),
                    description: Config.getInstance().cfg("exporter.default.description"),
                    tags: Config.getInstance().cfg("exporter.default.tags"),
                    category: Config.getInstance().cfg("exporter.default.category"),
                    remote: Config.getInstance().cfg("exporter.default.remote"),
                    title_template: Config.getInstance().cfg("exporter.default.title_template"),
                    privacy: Config.getInstance().cfg("exporter.default.privacy"),
                };

                let exporter: Exporter | undefined;
                try {
                    exporter = GetExporter(
                        Config.getInstance().cfg("exporter.default.exporter"),
                        "vod",
                        options
                    );
                } catch (error) {
                    Log.logAdvanced(Log.Level.ERROR, "automator.onEndDownload", `Auto exporter error: ${(error as Error).message}`);
                }

                if (exporter) {

                    exporter.export().then((out_path) => {
                        if (!exporter) return;
                        if (out_path) {
                            exporter.verify().then(status => {
                                Log.logAdvanced(Log.Level.SUCCESS, "automator.onEndDownload", "Exporter finished for " + this.vodBasenameTemplate);
                                if (exporter && exporter.vod && status) {
                                    exporter.vod.exportData.exported_at = new Date().toISOString();
                                    exporter.vod.saveJSON("export successful");
                                }
                            }).catch(error => {
                                Log.logAdvanced(Log.Level.ERROR, "automator.onEndDownload", (error as Error).message ? `Verify error: ${(error as Error).message}` : "Unknown error occurred while verifying export");
                            });

                        } else {
                            Log.logAdvanced(Log.Level.ERROR, "automator.onEndDownload", "Exporter finished but no path output.");
                        }
                    }).catch(error => {
                        Log.logAdvanced(Log.Level.ERROR, "automator.onEndDownload", (error as Error).message ? `Export error: ${(error as Error).message}` : "Unknown error occurred while exporting export");
                    });

                }

            }


            // this is a slow solution since we already remux the vod to mp4, and here we reencode that file
            if (Config.getInstance().cfg("reencoder.enabled")) {
                Log.logAdvanced(Log.Level.INFO, "automator.onEndDownload", `Auto reencoding on ${this.vod.basename}`);
                try {
                    await this.vod.reencodeSegments(
                        true,
                        Config.getInstance().cfg("reencoder.delete_source", false) // o_o
                    );
                } catch (error) {
                    Log.logAdvanced(Log.Level.ERROR, "automator.onEndDownload", `Failed to reencode ${this.vod.basename}: ${(error as Error).message}`);
                }
            }

            // if there's no eventsub hook the stream will never actually end
            if (Config.getInstance().cfg<boolean>("isolated_mode")) {
                await this.end();
            }

        }

        return true;
    }

    public applySeasonEpisode() {
        if (!this.channel) throw new Error("No channel");
        this.vod_season = this.channel.current_season;
        this.vod_absolute_season = this.channel.current_absolute_season;
        this.vod_episode = this.channel.incrementStreamNumber();
    }

    public async download(tries = 0): Promise<boolean> {

        // const data_title = this.getTitle();
        const data_started = this.getStartDate();
        const data_id = this.getVodID();
        const data_username = this.getUsername();

        // const channel = TwitchChannel.getChannelByLogin(this.getLogin());

        if (!this.channel) {
            throw new Error(`Channel ${this.getLogin()} not found, weird.`);
        }

        if (!data_id) {
            Log.logAdvanced(Log.Level.ERROR, "automator.download", `No VOD ID supplied for download (${this.getLogin()}) (try #${tries})`);
            throw new Error("No vod id supplied");
        }

        if (KeyValue.getInstance().has(`${this.getLogin()}.vod.id`)) {
            Log.logAdvanced(Log.Level.ERROR, "automator.download", `VOD ID already exists for ${this.getLogin()}`);
        }

        const temp_basename = this.vodBasenameTemplate();

        // if running
        const job = Job.findJob(`capture_${this.getLogin()}_${this.getVodID()}`);
        if (job && await job.getStatus() === JobStatus.RUNNING) {
            const meta = job.metadata as {
                login: string;
                basename: string;
                capture_filename: string;
                stream_id: string;
            };
            Log.logAdvanced(
                Log.Level.FATAL,
                "automator.download",
                `Stream already capturing to ${meta.basename} from ${data_username}, but reached download function regardless!`
            );
            return false;
        }

        // check matched title
        if (this.channel && this.channel.match && this.channel.match.length > 0) {

            let match = false;

            Log.logAdvanced(Log.Level.INFO, "automator.download", `Check keyword matches for ${temp_basename}`);

            for (const m of this.channel.match) {
                if (this.channel.getChapterData()?.title.includes(m)) {
                    match = true;
                    break;
                }
            }

            if (!match) {
                Log.logAdvanced(Log.Level.WARNING, "automator.download", `Cancel download of ${temp_basename} due to missing keywords`);
                return false;
            }
        }

        // pre-calculate season and episode
        this.applySeasonEpisode();

        const basename = this.vodBasenameTemplate();

        // folder base depends on vod season/episode now
        const folder_base = this.fulldir();
        if (!fs.existsSync(folder_base)) {
            Log.logAdvanced(Log.Level.DEBUG, "automator.download", `Making folder for ${temp_basename}.`);
            fs.mkdirSync(folder_base, { recursive: true });
        }

        if (TwitchVOD.hasVod(basename)) {
            Log.logAdvanced(Log.Level.ERROR, "automator.download", `Cancel download of ${basename}, vod already exists`);
            return false;
        }

        // create the vod and put it inside this class
        try {
            this.vod = await this.channel.createVOD(path.join(folder_base, `${basename}.json`));
        } catch (error) {
            Log.logAdvanced(Log.Level.ERROR, "automator.download", `Failed to create vod for ${basename}: ${(error as Error).message}`);
            return false;
        }
        

        this.vod.channel_uuid = this.channel.uuid; // to be sure

        // if (this.vod instanceof TwitchChannel) {
        //     this.vod.meta = this.payload_eventsub;
        // }

        // this.vod.json.meta = $this.payload_eventsub; // what
        this.vod.capture_id = this.getVodID() || "1";
        this.vod.started_at = parseJSON(data_started);

        // this.vod.stream_number = this.channel.incrementStreamNumber();
        // this.vod.stream_season = this.channel.current_season; /** @TODO: field? **/ 
        // this.vod.stream_absolute_season = this.channel.current_absolute_season;
        this.vod.stream_number = this.vod_episode;
        // this.vod.stream_season = this.vod_season;
        this.vod.stream_absolute_season = this.vod_absolute_season;

        if (this.force_record) this.vod.force_record = true;

        this.vod.not_started = false;

        // this.vod.saveJSON("stream download");

        Webhook.dispatch("start_download", {
            "vod": await this.vod.toAPI(),
        });

        this.vod.is_capturing = true;
        await this.vod.saveJSON("is_capturing set");

        // update the game + title if it wasn't updated already
        Log.logAdvanced(Log.Level.INFO, "automator.download", `Update game for ${basename}`);
        if (KeyValue.getInstance().has(`${this.getLogin()}.chapterdata`)) {
            await this.updateGame(true, true);
            // KeyValue.delete(`${this.getLogin()}.channeldata`);
        }

        const container_ext =
            this.channel.quality && this.channel.quality[0] === "audio_only" ?
                Config.AudioContainer :
                Config.getInstance().cfg("vod_container", "mp4");


        if (Config.getInstance().cfg("capture.use_cache", false)) {
            this.capture_filename = path.join(BaseConfigDataFolder.capture, `${basename}.ts`);
        } else {
            this.capture_filename = path.join(folder_base, `${basename}.ts`);
        }

        this.vod.capturingFilename = this.capture_filename;

        this.converted_filename = path.join(folder_base, `${basename}.${container_ext}`);
        this.chat_filename = path.join(folder_base, `${basename}.chatdump`);


        // capture with streamlink, this is the crucial point in this entire program
        this.startCaptureChat();

        try {
            await this.captureVideo();
        } catch (error) {
            Log.logAdvanced(Log.Level.FATAL, "automator.download", `Failed to capture video: ${error}`);
            this.endCaptureChat();
            this.vod.is_capturing = false;
            this.vod.failed = true;
            await this.vod.saveJSON("capture fail");
            // this.vod.delete();
            return false;
        }

        this.endCaptureChat();

        const capture_success = fs.existsSync(this.capture_filename) && fs.statSync(this.capture_filename).size > 0;

        // send internal webhook for capture start
        Webhook.dispatch("end_capture", {
            "vod": await this.vod.toAPI(),
            "success": capture_success,
        });

        // error handling if nothing got downloaded
        if (!capture_success) {

            Log.logAdvanced(Log.Level.WARNING, "automator.download", `Panic handler for ${basename}, no captured file!`);

            if (tries >= Config.getInstance().cfg<number>("download_retries")) {
                Log.logAdvanced(Log.Level.ERROR, "automator.download", `Giving up on downloading, too many tries for ${basename}`);
                fs.renameSync(path.join(folder_base, `${basename}.json`), path.join(folder_base, `${basename}.json.broken`));
                throw new Error("Too many tries");
                // TODO: fatal error
            }

            Log.logAdvanced(Log.Level.ERROR, "automator.download", `Error when downloading, retrying ${basename}`);

            // sleep(15);
            await Sleep(15 * 1000);

            return this.download(tries + 1);
        }

        // end timestamp
        Log.logAdvanced(Log.Level.INFO, "automator.download", `Add end timestamp for ${basename}`);

        this.vod.ended_at = new Date();
        this.vod.is_capturing = false;
        if (this.stream_resolution) this.vod.stream_resolution = this.stream_resolution;
        await this.vod.saveJSON("stream capture end");

        const duration = this.vod.getDurationLive();
        if (duration && duration > (86400 - (60 * 10))) { // 24 hours - 10 minutes
            Log.logAdvanced(Log.Level.WARNING, "automator.download", `The stream ${basename} is 24 hours, this might cause issues.`);
            // https://github.com/streamlink/streamlink/issues/1058
            // streamlink currently does not refresh the stream if it is 24 hours or longer
            // it doesn't seem to get fixed, so we'll just warn the user
        }

        this.vod.calculateChapters();

        await this.vod.removeShortChapters();

        // wait for 30 seconds in case something didn't finish
        await Sleep(30 * 1000);

        if (!Config.getInstance().cfg("no_vod_convert", false)) {

            this.vod.is_converting = true;
            await this.vod.saveJSON("is_converting set");

            // convert with ffmpeg
            await this.convertVideo();

            // sleep(10);
            await Sleep(10 * 1000);

            const convert_success =
                fs.existsSync(this.capture_filename) &&
                fs.existsSync(this.converted_filename) &&
                fs.statSync(this.converted_filename).size > 0
                ;

            // send internal webhook for convert start
            Webhook.dispatch("end_convert", {
                "vod": await this.vod.toAPI(),
                "success": convert_success,
            });

            // remove ts if both files exist
            if (convert_success) {
                Log.logAdvanced(Log.Level.DEBUG, "automator.download", `Remove ts file for ${basename}`);
                fs.unlinkSync(this.capture_filename);
            } else {
                Log.logAdvanced(Log.Level.FATAL, "automator.download", `Missing conversion files for ${basename}`);
                // this.vod.automator_fail = true;
                this.vod.is_converting = false;
                await this.vod.saveJSON("automator fail");
                return false;
            }

            // add the captured segment to the vod info
            Log.logAdvanced(Log.Level.INFO, "automator.download", `Conversion done, add segment '${this.converted_filename}' to '${basename}'`);

            this.vod.is_converting = false;
            this.vod.addSegment(path.basename(this.converted_filename));

            if (this.vod.segments.length > 1) {
                Log.logAdvanced(Log.Level.WARNING, "automator.download", `More than one segment (${this.vod.segments.length}) for ${basename}, this should not happen!`);
                ClientBroker.notify("Segment error", `More than one segment (${this.vod.segments.length}) for ${basename}, this should not happen!`, "", "system");
            }

            await this.vod.saveJSON("add segment");

        } else {
            Log.logAdvanced(Log.Level.INFO, "automator.download", `No conversion for ${basename}, just add segments`);
            this.vod.addSegment(path.basename(this.capture_filename));
            await this.vod.saveJSON("add segment");
        }

        // finalize
        Log.logAdvanced(Log.Level.INFO, "automator.download", `Sleep 30 seconds for ${basename}`);
        await Sleep(30 * 1000);

        Log.logAdvanced(Log.Level.INFO, "automator.download", `Do metadata on ${basename}`);

        let finalized = false;
        try {
            finalized = await this.vod.finalize();
        } catch (error) {
            Log.logAdvanced(Log.Level.FATAL, "automator.download", `Failed to finalize ${basename}: ${error}`);
            await this.vod.saveJSON("failed to finalize");
        }

        if (finalized) {
            await this.vod.saveJSON("finalized");
        }

        // remove old vods for the streamer
        Log.logAdvanced(Log.Level.INFO, "automator.download", `Cleanup old VODs for ${data_username}`);
        await this.cleanup();

        // add to history, testing
        /*
        $history = file_exists(TwitchConfig::$historyPath) ? json_decode(file_get_contents(TwitchConfig::$historyPath), true) : [];
        $history[] = [
            'streamer_name' => $this->vod->streamer_name,
            'started_at' => $this->vod->dt_started_at,
            'ended_at' => $this->vod->dt_ended_at,
            'title' => $data_title
        ];
        file_put_contents(TwitchConfig::$historyPath, json_encode($history));
        */

        Log.logAdvanced(Log.Level.SUCCESS, "automator.download", `All done for ${basename}`);

        // finally send internal webhook for capture finish
        Webhook.dispatch("end_download", {
            "vod": await this.vod.toAPI(),
        });

        this.onEndDownload();

        return true;

    }

    public providerArgs(): string[] {
        return [];
    }

    /**
     * Create process and capture video
     * @throws
     * @returns 
     */
    public captureVideo(): Promise<boolean> {

        return new Promise((resolve, reject) => {

            if (!this.vod) {
                Log.logAdvanced(Log.Level.ERROR, "automator.captureVideo", `No VOD for ${this.vodBasenameTemplate()}, this should not happen`);
                reject(false);
                return;
            }

            const basename = this.vodBasenameTemplate();

            const stream_url = this.streamURL();

            const bin = Helper.path_streamlink();

            if (!bin) {
                Log.logAdvanced(Log.Level.ERROR, "automator.captureVideo", "Streamlink not found");
                reject(false);
                return;
            }

            const cmd: string[] = [];

            // How many segments from the end to start live HLS streams on.
            cmd.push("--hls-live-edge", "99999");

            // timeout due to ads
            cmd.push("--hls-timeout", Config.getInstance().cfg("hls_timeout", 120).toString());

            // timeout due to ads
            cmd.push("--hls-segment-timeout", Config.getInstance().cfg("hls_timeout", 120).toString());

            // The size of the thread pool used to download HLS segments.
            cmd.push("--hls-segment-threads", "5");

            // Output container format
            cmd.push("--ffmpeg-fout", "mpegts"); // default is apparently matroska?

            cmd.push(...this.providerArgs());

            // Retry fetching the list of available streams until streams are found 
            cmd.push("--retry-streams", "10");

            // stop retrying the fetch after COUNT retry attempt(s).
            cmd.push("--retry-max", "5");

            // logging level
            if (Config.debug) {
                cmd.push("--loglevel", "debug");
            } else if (Config.getInstance().cfg("app_verbose", false)) {
                cmd.push("--loglevel", "info");
            }

            // output file
            cmd.push("-o", this.capture_filename);

            // twitch url
            cmd.push("--url", stream_url);

            // twitch quality
            cmd.push("--default-stream");
            if (this.channel && this.channel.quality) {
                cmd.push(this.channel.quality.join(","));
            } else {
                cmd.push("best");
            }

            this.vod.capture_started = new Date();
            this.vod.saveJSON("dt_capture_started set");

            Log.logAdvanced(Log.Level.INFO, "automator.captureVideo", `Starting capture with filename ${path.basename(this.capture_filename)}`);

            // TODO: use TwitchHelper.startJob instead

            // spawn process
            const capture_process = spawn(bin, cmd, {
                cwd: path.dirname(this.capture_filename),
                windowsHide: true,
            });

            // make job for capture
            let capture_job: Job;
            const jobName = `capture_${this.getLogin()}_${this.getVodID()}`;

            if (capture_process.pid) {
                Log.logAdvanced(Log.Level.SUCCESS, "automator.captureVideo", `Spawned process ${capture_process.pid} for ${jobName}`);
                capture_job = Job.create(jobName);
                capture_job.setPid(capture_process.pid);
                capture_job.setExec(bin, cmd);
                capture_job.setProcess(capture_process);
                capture_job.startLog(jobName, `$ ${bin} ${cmd.join(" ")}\n`);
                capture_job.addMetadata({
                    "login": this.getLogin(), // TODO: username?
                    "basename": this.vodBasenameTemplate(),
                    "capture_filename": this.capture_filename,
                    "stream_id": this.getVodID(),
                });
                if (!capture_job.save()) {
                    Log.logAdvanced(Log.Level.ERROR, "automator.captureVideo", `Failed to save job ${jobName}`);
                }
            } else {
                Log.logAdvanced(Log.Level.FATAL, "automator.captureVideo", `Failed to spawn capture process for ${jobName}`);
                reject(false);
                return;
            }

            let lastSize = 0;
            const keepaliveAlert = () => {
                if (fs.existsSync(this.capture_filename)) {
                    const size = fs.statSync(this.capture_filename).size;
                    const bitRate = (size - lastSize) / 120;
                    lastSize = size;
                    console.log(
                        chalk.bgGreen.whiteBright(
                            `🎥 ${new Date().toISOString()} ${basename} ${this.stream_resolution} ` +
                            `${Helper.formatBytes(size)} / ${Math.round((bitRate * 8) / 1000)} kbps`
                        )
                    );
                } else {
                    console.log(chalk.bgRed.whiteBright(`🎥 ${new Date().toISOString()} ${basename} missing`));
                }

            };

            const keepalive = setInterval(keepaliveAlert, 120 * 1000);

            // critical end
            capture_process.on("close", (code, signal) => {

                if (code === 0) {
                    Log.logAdvanced(Log.Level.SUCCESS, "automator.captureVideo", `Job ${jobName} exited with code 0, signal ${signal}`);
                } else {
                    Log.logAdvanced(Log.Level.ERROR, "automator.captureVideo", `Job ${jobName} exited with code ${code}, signal ${signal}`);
                }

                clearInterval(keepalive);

                if (capture_job) {
                    capture_job.clear();
                }

                if (fs.existsSync(this.capture_filename) && fs.statSync(this.capture_filename).size > 0) {

                    const stream_resolution = capture_job.stdout.join("\n").match(/stream:\s([0-9_a-z]+)\s/);
                    if (stream_resolution && this.vod) {
                        this.vod.stream_resolution = stream_resolution[1] as VideoQuality;
                    }

                    resolve(true);
                } else {
                    Log.logAdvanced(Log.Level.ERROR, "automator.captureVideo", `Capture ${basename} failed`);
                    reject(false);
                }

            });

            let chunks_missing = 0;
            // let current_ad_start = null;

            const ticker = (source: "stdout" | "stderr", raw_data: Buffer) => {

                const data = raw_data.toString();

                if (data.includes("bad interpreter: No such file or directory")) {
                    Log.logAdvanced(Log.Level.ERROR, "automator.captureVideo", "Fatal error with streamlink, please check logs");
                }

                // get stream resolution
                const res_match = data.match(/stream:\s([0-9_a-z]+)\s/);
                if (res_match) {
                    this.stream_resolution = res_match[1] as VideoQuality;
                    if (this.vod) this.vod.stream_resolution = this.stream_resolution;
                    Log.logAdvanced(Log.Level.INFO, "automator.captureVideo", `Stream resolution for ${basename}: ${this.stream_resolution}`);

                    if (this.channel && this.channel.quality) {
                        if (this.channel.quality.includes("best")) {
                            if (this.stream_resolution !== "1080p60") { // considered best as of 2022
                                Log.logAdvanced(Log.Level.WARNING, "automator.captureVideo", `Stream resolution ${this.stream_resolution} assumed to not be in channel quality list`);
                            }
                        } else if (this.channel.quality.includes("worst")) {
                            if (this.stream_resolution !== "140p") { // considered worst
                                Log.logAdvanced(Log.Level.WARNING, "automator.captureVideo", `Stream resolution ${this.stream_resolution} assumed to not be in channel quality list`);
                            }
                        } else {
                            if (!this.channel.quality.includes(this.stream_resolution)) {
                                Log.logAdvanced(Log.Level.WARNING, "automator.captureVideo", `Stream resolution ${this.stream_resolution} not in channel quality list`);
                            }
                        }
                    }

                }

                // stream stop
                if (data.includes("404 Client Error")) {
                    Log.logAdvanced(Log.Level.WARNING, "automator.captureVideo", `Chunk 404'd for ${basename} (${chunks_missing}/100)!`);
                    chunks_missing++;
                    if (chunks_missing >= 100) {
                        Log.logAdvanced(Log.Level.WARNING, "automator.captureVideo", `Too many 404'd chunks for ${basename}, stopping!`);
                        this.captureJob?.kill();
                    }
                }

                if (data.includes("Failed to reload playlist")) {
                    Log.logAdvanced(Log.Level.ERROR, "automator.captureVideo", `Failed to reload playlist for ${basename}!`);
                }

                if (data.includes("Failed to fetch segment")) {
                    Log.logAdvanced(Log.Level.ERROR, "automator.captureVideo", `Failed to fetch segment for ${basename}!`);
                }

                if (data.includes("Waiting for streams")) {
                    Log.logAdvanced(Log.Level.WARNING, "automator.captureVideo", `No streams found for ${basename}, retrying...`);
                }

                // stream error
                if (data.includes("403 Client Error")) {
                    Log.logAdvanced(Log.Level.ERROR, "automator.captureVideo", `Chunk 403'd for ${basename}! Private stream?`);
                }

                // ad removal
                if (data.includes("Will skip ad segments")) {
                    Log.logAdvanced(Log.Level.INFO, "automator.captureVideo", `Capturing of ${basename}, will try to remove ads!`);
                    // current_ad_start = new Date();
                }

                if (data.includes("Writing output to")) {
                    Log.logAdvanced(Log.Level.INFO, "automator.captureVideo", "Streamlink now writing output to container.");
                    if (this.vod) {
                        this.vod.capture_started2 = new Date();
                        this.vod.broadcastUpdate();
                    }
                }

                if (data.includes("Read timeout, exiting")) {
                    Log.logAdvanced(Log.Level.ERROR, "automator.captureVideo", `Read timeout, exiting for ${basename}!`);
                }

                if (data.includes("Stream ended")) {
                    Log.logAdvanced(Log.Level.INFO, "automator.captureVideo", `Stream ended for ${basename}!`);
                }

                if (data.includes("Closing currently open stream...")) {
                    Log.logAdvanced(Log.Level.INFO, "automator.captureVideo", `Closing currently open stream for ${basename}!`);
                }

                if (data.includes("error: The specified stream(s)")) {
                    Log.logAdvanced(Log.Level.ERROR, "automator.captureVideo", `Capturing of ${basename} failed, selected quality not available!`);
                }

                if (data.includes("error: No playable streams found on this URL:")) {
                    Log.logAdvanced(Log.Level.ERROR, "automator.captureVideo", `Capturing of ${basename} failed, no streams available!`);
                }

            };

            // attach output to parsing
            capture_process.stdout.on("data", (data) => { ticker("stdout", data); });
            capture_process.stderr.on("data", (data) => { ticker("stderr", data); });

            // check for errors
            capture_process.on("error", (err) => {
                clearInterval(keepalive);
                Log.logAdvanced(Log.Level.ERROR, "automator.captureVideo", `Error with streamlink for ${basename}: ${err}`);
                reject(false);
            });

            // process.on("exit", (code, signal) => {
            //     clearInterval(keepalive);
            //     TwitchLog.logAdvanced(Log.Level.ERROR, "automator.captureVideo", `Streamlink exited with code ${code} for ${basename}`);
            // });

            // this.vod.generatePlaylistFile();

            // send internal webhook for capture start
            this.vod.toAPI().then(vod => {
                Webhook.dispatch("start_capture", {
                    "vod": vod,
                });
            });

        });

    }

    /**
     * Capture chat in a "detached" process
     */
    startCaptureChat(): boolean {

        // const channel = TwitchChannel.getChannelByLogin(this.broadcaster_user_login);

        // chat capture
        if (this.channel && this.channel.live_chat && this.realm == "twitch") {

            const data_started = this.getStartDate();
            // const data_id = this.getVodID();
            const data_login = this.getLogin();
            // const data_username = this.getUsername();
            const data_userid = this.getUserID();

            /*
            const chat_bin = "node";
            const chat_cmd: string[] = [];

            // todo: execute directly in node?
            chat_cmd.push(path.join(AppRoot, "twitch-chat-dumper", "build", "index.js"));
            chat_cmd.push("--channel", data_login);
            chat_cmd.push("--userid", data_userid);
            chat_cmd.push("--date", data_started);
            chat_cmd.push("--output", this.chat_filename);

            Log.logAdvanced(Log.Level.INFO, "automator", `Starting chat dump with filename ${path.basename(this.chat_filename)}`);

            const chat_job = Helper.startJob(`chatdump_${this.basename()}`, chat_bin, chat_cmd);
            */

            const chat_job = TwitchChannel.startChatDump(`${this.getLogin()}_${this.getVodID()}`, data_login, data_userid, parseJSON(data_started), this.chat_filename);

            if (chat_job && chat_job.pid) {
                this.chatJob = chat_job;
                this.chatJob.addMetadata({
                    "username": data_login,
                    "basename": this.vodBasenameTemplate(),
                    "chat_filename": this.chat_filename,
                });
            } else {
                Log.logAdvanced(Log.Level.ERROR, "automator.captureChat", `Failed to start chat dump job with filename ${path.basename(this.chat_filename)}`);
                return false;
            }

            return true;
        }

        return false;

    }

    /**
     * Kill the process, stopping chat capture
     */
    async endCaptureChat(): Promise<void> {

        if (this.chatJob) {
            Log.logAdvanced(Log.Level.INFO, "automator.endCaptureChat", `Ending chat dump with filename ${path.basename(this.chat_filename)}`);
            await this.chatJob.kill();
        }

    }

    // maybe use this?
    async compressChat(): Promise<boolean> {
        if (fs.existsSync(this.chat_filename)) {
            await Helper.execSimple("gzip", [this.chat_filename], "compress chat");
            return fs.existsSync(`${this.chat_filename}.gz`);
        }
        return false;
    }

    async convertVideo(): Promise<boolean> {

        if (!this.vod) throw new Error("VOD not set");

        Webhook.dispatch("start_convert", {
            vod: await this.vod.toAPI(),
        });

        let mf;
        if (Config.getInstance().cfg("create_video_chapters") && await this.vod.saveFFMPEGChapters()) {
            mf = this.vod.path_ffmpegchapters;
        }

        let result: RemuxReturn;

        try {
            result = await Helper.remuxFile(this.capture_filename, this.converted_filename, false, mf);
        } catch (err) {
            Log.logAdvanced(Log.Level.ERROR, "automator.convertVideo", `Failed to convert video: ${err}`);
            return false;
        }

        if (result && result.success) {
            Log.logAdvanced(Log.Level.SUCCESS, "automator.convertVideo", `Converted video ${this.capture_filename} to ${this.converted_filename}`);
        } else {
            Log.logAdvanced(Log.Level.ERROR, "automator.convertVideo", `Failed to convert video ${this.capture_filename} to ${this.converted_filename}`);
        }

        Webhook.dispatch("end_convert", {
            vod: await this.vod.toAPI(),
            success: result && result.success,
        });

        return result && result.success;

    }

    public async burnChat(): Promise<void> {

        if (!this.vod) {
            Log.logAdvanced(Log.Level.ERROR, "automator.burnChat", "No VOD for burning chat");
            return;
        }

        const chatHeight: number =
            this.vod.video_metadata &&
                this.vod.video_metadata.type !== "audio" &&
                Config.getInstance().cfg<boolean>("chatburn.default.auto_chat_height")
                ?
                this.vod.video_metadata.height
                :
                Config.getInstance().cfg<number>("chatburn.default.chat_height")
            ;

        const settings = {
            vodSource: "captured",
            chatSource: "captured",
            chatWidth: Config.getInstance().cfg<number>("chatburn.default.chat_width"),
            chatHeight: chatHeight,
            chatFont: Config.getInstance().cfg<string>("chatburn.default.chat_font"),
            chatFontSize: Config.getInstance().cfg<number>("chatburn.default.chat_font_size"),
            burnHorizontal: Config.getInstance().cfg<string>("chatburn.default.horizontal"),
            burnVertical: Config.getInstance().cfg<string>("chatburn.default.vertical"),
            ffmpegPreset: Config.getInstance().cfg<string>("chatburn.default.preset"),
            ffmpegCrf: Config.getInstance().cfg<number>("chatburn.default.crf"),
            burnOffset: 0,
        };

        let status_renderchat, status_burnchat;

        try {
            status_renderchat = await this.vod.renderChat(settings.chatWidth, settings.chatHeight, settings.chatFont, settings.chatFontSize, settings.chatSource == "downloaded", true);
        } catch (error) {
            Log.logAdvanced(Log.Level.ERROR, "automator.burnChat", (error as Error).message);
            return;
        }

        try {
            status_burnchat = await this.vod.burnChat(settings.burnHorizontal, settings.burnVertical, settings.ffmpegPreset, settings.ffmpegCrf, settings.vodSource == "downloaded", true, settings.burnOffset);
        } catch (error) {
            Log.logAdvanced(Log.Level.ERROR, "automator.burnChat", (error as Error).message);
            return;
        }

        Log.logAdvanced(Log.Level.INFO, "automator.burnChat", `Render: ${status_renderchat}, Burn: ${status_burnchat}`);

    }

}