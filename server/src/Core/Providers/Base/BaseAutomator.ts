import type { Exporter } from "@/Controllers/Exporter";
import { GetExporter } from "@/Controllers/Exporter";
import { progressOutput } from "@/Helpers/Console";
import { execSimple, startJob } from "@/Helpers/Execute";
import { formatBytes } from "@/Helpers/Format";
import { Sleep } from "@/Helpers/Sleep";
import { xClearInterval, xInterval } from "@/Helpers/Timeout";
import { isTwitchVOD, isTwitchVODChapter } from "@/Helpers/Types";
import type { RemuxReturn } from "@/Helpers/Video";
import { remuxFile } from "@/Helpers/Video";
import type { TwitchVODChapterJSON } from "@/Storage/JSON";
import type { VideoQuality } from "@common/Config";
import type { NotificationCategory } from "@common/Defs";
import { JobStatus, nonGameCategories } from "@common/Defs";
import type { ExporterOptions } from "@common/Exporter";
import { formatString } from "@common/Format";
import type { VodBasenameTemplate } from "@common/Replacements";
import type { ChannelUpdateEvent } from "@common/TwitchAPI/EventSub/ChannelUpdate";
import type { StreamPause } from "@common/Vod";
import type {
    EndCaptureData,
    EndConvertData,
    StartDownloadData,
    VodUpdated,
} from "@common/Webhook";
import chalk from "chalk";
import { format, formatDistanceToNow, isValid, parseJSON } from "date-fns";
import { t } from "i18next";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import sanitize from "sanitize-filename";
import { BaseConfigCacheFolder, BaseConfigDataFolder } from "../../BaseConfig";
import { ClientBroker } from "../../ClientBroker";
import { Config } from "../../Config";
import { Helper } from "../../Helper";
import { Job } from "../../Job";
import { KeyValue } from "../../KeyValue";
import type { ChannelTypes, VODTypes } from "../../LiveStreamDVR";
import { LiveStreamDVR } from "../../LiveStreamDVR";
import { LOGLEVEL, log } from "../../Log";
import { Webhook } from "../../Webhook";
import { TwitchChannel } from "../Twitch/TwitchChannel";
import { TwitchVOD } from "../Twitch/TwitchVOD";

// import { ChatDumper } from "../../../twitch-chat-dumper/ChatDumper";

export class BaseAutomator {
    public vod: VODTypes | undefined;
    public channel: ChannelTypes | undefined;

    public realm = "base";

    public broadcaster_user_id = "";
    public broadcaster_user_login = "";
    public broadcaster_user_name = "";

    public force_record = false;
    public stream_resolution: VideoQuality | undefined;

    public capture_filename = "";
    public converted_filename = "";
    public chat_filename = "";

    public captureJob: Job | undefined;
    public chatJob: Job | undefined;

    private vod_season?: string; // why is this a string
    private vod_absolute_season?: number;
    private vod_episode?: number;
    private vod_absolute_episode?: number;

    private is24HourStream = false;

    private chunks_missing = 0;
    private stream_pause?: Partial<StreamPause>;

    private vod_id = "";

    public basedir(): string {
        if (Config.getInstance().cfg<boolean>("vod_folders")) {
            return path.join(this.getLogin(), this.vodFolderTemplate());
        } else {
            return this.getLogin();
        }
    }

    public vodFolderTemplate(): string {
        const date = parseJSON(this.getStartDate());

        if (!date || !isValid(date)) {
            log(
                LOGLEVEL.ERROR,
                "automator.vodFolderTemplate",
                `Invalid start date: ${this.getStartDate()}`
            );
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
            absolute_season: this.vod_absolute_season
                ? this.vod_absolute_season.toString().padStart(2, "0")
                : "",
            episode: this.vod_episode
                ? this.vod_episode.toString().padStart(2, "0")
                : "",
            absolute_episode: this.vod_absolute_episode
                ? this.vod_absolute_episode.toString().padStart(2, "0")
                : "",
            title: this.getTitle(),
            game_name: this.getGameName(),
            game_id: this.getGameID(),
        };

        return sanitize(
            formatString(
                Config.getInstance().cfg("filename_vod_folder"),
                variables
            )
        );
    }

    public vodBasenameTemplate(): string {
        const date = parseJSON(this.getStartDate());

        if (!date || !isValid(date)) {
            log(
                LOGLEVEL.ERROR,
                "automator.vodBasenameTemplate",
                `Invalid start date: ${this.getStartDate()}`
            );
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
            absolute_season: this.vod_absolute_season
                ? this.vod_absolute_season.toString().padStart(2, "0")
                : "",
            episode: this.vod_episode
                ? this.vod_episode.toString().padStart(2, "0")
                : "",
            absolute_episode: this.vod_absolute_episode
                ? this.vod_absolute_episode.toString().padStart(2, "0")
                : "",
            title: this.getTitle(),
            game_name: this.getGameName(),
            game_id: this.getGameID(),
        };

        return sanitize(
            formatString(Config.getInstance().cfg("filename_vod"), variables)
        );
    }

    public fulldir(): string {
        return path.join(BaseConfigDataFolder.vod, this.basedir());
    }

    public getVodID(): string | false {
        if (!KeyValue.getInstance().has(`${this.getLogin()}.vod.id`)) {
            log(
                LOGLEVEL.ERROR,
                "automator.getVodID",
                `No VOD ID for ${this.getLogin()}`
            );
            return false;
        }

        return KeyValue.getInstance().get(`${this.getLogin()}.vod.id`)!;
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
        if (!KeyValue.getInstance().has(`${this.getLogin()}.vod.started_at`)) {
            log(
                LOGLEVEL.ERROR,
                "automator.getStartDate",
                `No start date for ${this.getLogin()}`
            );
            return "";
        }
        return KeyValue.getInstance().get(`${this.getLogin()}.vod.started_at`)!;
    }

    public getTitle(): string {
        if (KeyValue.getInstance().has(`${this.getLogin()}.chapterdata`)) {
            const data = KeyValue.getInstance().getObject<TwitchVODChapterJSON>(
                `${this.getLogin()}.chapterdata`
            );
            if (data && data.title) {
                return data.title || "";
            }
        }
        return "";
    }

    public getGameName(): string {
        if (KeyValue.getInstance().has(`${this.getLogin()}.chapterdata`)) {
            const data = KeyValue.getInstance().getObject<TwitchVODChapterJSON>(
                `${this.getLogin()}.chapterdata`
            );
            if (data && data.game_name) {
                return data.game_name || "";
            }
        }
        return "";
    }

    public getGameID(): string {
        if (KeyValue.getInstance().has(`${this.getLogin()}.chapterdata`)) {
            const data = KeyValue.getInstance().getObject<TwitchVODChapterJSON>(
                `${this.getLogin()}.chapterdata`
            );
            if (data && data.game_id) {
                return data.game_id || "";
            }
        }
        return "";
    }

    public streamURL(): string {
        // return `twitch.tv/${this.broadcaster_user_login}`;
        if (!this.channel) {
            throw new Error("No channel for stream url");
        }
        return this.channel.livestreamUrl;
    }

    public async updateGame(from_cache = false, no_run_check = false) {
        return await Promise.resolve(false);
    }

    /**
     * Notifies the chapter change to the providers.
     *
     * @param channel - The Twitch channel.
     */
    public notifyChapterChange(channel: TwitchChannel) {
        const vod = channel.latest_vod;
        if (!vod) return;

        if (!vod.chapters || vod.chapters.length == 0) return;

        const currentChapter = vod.chapters[vod.chapters.length - 1];
        const previousChapter =
            vod.chapters.length > 2
                ? vod.chapters[vod.chapters.length - 2]
                : null;

        let title = "";
        const body = currentChapter.title;
        const icon = channel.profilePictureUrl;

        if (currentChapter && !isTwitchVODChapter(currentChapter)) return;
        if (previousChapter && !isTwitchVODChapter(previousChapter)) return;

        let category: NotificationCategory = "streamStatusChange";
        if (
            (!previousChapter?.game_id && currentChapter.game_id) || // game changed from null to something
            (previousChapter?.game_id &&
                currentChapter.game_id &&
                previousChapter.game_id !== currentChapter.game_id) // game changed
        ) {
            if (nonGameCategories.includes(currentChapter.game_name)) {
                if (currentChapter.game?.isFavourite()) {
                    title = t(
                        "notify.channel-displayname-is-online-with-one-of-your-favourite-categories-current_chapter-game_name",
                        [channel.displayName, currentChapter.game_name]
                    );
                    category = "streamStatusChangeFavourite";
                } else if (currentChapter.game_name) {
                    title = t(
                        "notify.channel-displayname-is-now-streaming-current_chapter-game_name",
                        [channel.displayName, currentChapter.game_name]
                    );
                } else {
                    title = t(
                        "notify.channel-displayname-is-now-streaming-without-a-category",
                        [channel.displayName]
                    );
                }
            } else {
                if (currentChapter.game?.isFavourite()) {
                    title = t(
                        "notify.channel-displayname-is-now-playing-one-of-your-favourite-games-current_chapter-game_name",
                        [channel.displayName, currentChapter.game_name]
                    );
                    category = "streamStatusChangeFavourite";
                } else if (currentChapter.game_name) {
                    title = t(
                        "notify.channel-displayname-is-now-playing-current_chapter-game_name",
                        [channel.displayName, currentChapter.game_name]
                    );
                } else {
                    title = t(
                        "notify.channel-displayname-is-now-streaming-without-a-game",
                        [channel.displayName]
                    );
                }
            }
        } else if (previousChapter?.game_id && !currentChapter.game_id) {
            title = t(
                "notify.channel-displayname-is-now-streaming-without-a-game",
                [channel.displayName]
            );
        } else if (!previousChapter?.game_id && !currentChapter.game_id) {
            title = t(
                "notify.channel-displayname-is-still-streaming-without-a-game",
                [channel.displayName]
            );
        } else if (previousChapter?.title !== currentChapter.title) {
            title = t(
                "notify.channel-displayname-changed-title-still-playing-streaming-current_chapter-game_name",
                [channel.displayName, currentChapter.game_name]
            );
        }

        if (!title) {
            log(
                LOGLEVEL.WARNING,
                "automator.notifyChapterChange",
                `No title generated for ${channel.displayName} chapter change.`,
                {
                    previous_chapter: previousChapter,
                    current_chapter: currentChapter,
                    body,
                    icon,
                    category,
                }
            );
        }

        ClientBroker.notify(
            title,
            body,
            icon,
            category,
            this.channel?.livestreamUrl
        );
    }

    public async getChapterData(
        event: ChannelUpdateEvent
    ): Promise<TwitchVODChapterJSON> {
        const chapterData = {
            started_at: new Date().toISOString(),
            game_id: event.category_id,
            game_name: event.category_name,
            // 'viewer_count' 	: $data_viewer_count,
            title: event.title,
            is_mature: event.content_classification_labels
                ? event.content_classification_labels.length > 0
                : false, // right now it seems like all classifications are mature, so if there are any, it's mature
            online: true,
        } as TwitchVODChapterJSON;

        // extra metadata with a separate api request
        if (Config.getInstance().cfg("api_metadata")) {
            const streams = await TwitchChannel.getStreams(this.getUserID());

            if (streams && streams.length > 0) {
                if (
                    !KeyValue.getInstance().getBool(
                        `${this.broadcaster_user_login}.online`
                    )
                ) {
                    log(
                        LOGLEVEL.INFO,
                        "automator.getChapterData",
                        `Get chapter data: Channel ${this.broadcaster_user_login} is offline but we managed to get stream data, so it's online? 🤔`
                    );
                }

                KeyValue.getInstance().setBool(
                    `${this.broadcaster_user_login}.online`,
                    true
                ); // if status has somehow been set to false, set it back to true

                const stream = streams[0];

                if (stream.viewer_count !== undefined) {
                    chapterData.viewer_count = stream.viewer_count;

                    if (this.vod) {
                        this.vod.viewers.push({
                            amount: stream.viewer_count,
                            timestamp: new Date(),
                        }); // add viewer count to vod, good if user doesn't have continuous viewer logging
                    }
                } else {
                    log(
                        LOGLEVEL.ERROR,
                        "automator.getChapterData",
                        "Get chapter data: No viewer count in metadata request."
                    );
                }
            } else {
                log(
                    LOGLEVEL.ERROR,
                    "automator.getChapterData",
                    "Get chapter data: No streams in metadata request."
                );
            }
        }

        return chapterData;
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
        log(LOGLEVEL.INFO, "automator.end", "Stream end");

        KeyValue.getInstance().set(
            `${this.broadcaster_user_login}.last.offline`,
            new Date().toISOString()
        );

        log(
            LOGLEVEL.INFO,
            "automator.end",
            `Stream offline for ${this.broadcaster_user_login}`
        );

        // const channel = TwitchChannel.getChannelByLogin(this.broadcaster_user_login);

        // channel offline notification
        if (this.channel) {
            ClientBroker.notify(
                t("notify.this-broadcaster_user_login-has-gone-offline", [
                    this.broadcaster_user_login,
                ]),
                this.channel &&
                    this.channel.latest_vod &&
                    this.channel.latest_vod.started_at
                    ? t(
                          "notify.was-streaming-for-formatdistancetonow-this-channel-latest_vod-started_at",
                          [
                              formatDistanceToNow(
                                  this.channel.latest_vod.started_at
                              ),
                          ]
                      ).toString()
                    : "",
                this.channel.profilePictureUrl,
                "streamOffline",
                this.channel.livestreamUrl
            );

            if (!this.channel.is_capturing) {
                log(
                    LOGLEVEL.WARNING,
                    "automator.end",
                    `Stream offline notification for ${this.broadcaster_user_login} but channel is not capturing.`
                );
            }
        }

        // KeyValue.getInstance().set("${this.broadcaster_user_login}.online", "0");

        // write to history
        fs.writeFileSync(
            path.join(
                BaseConfigCacheFolder.history,
                `${this.broadcaster_user_login}.jsonline`
            ),
            JSON.stringify({ time: new Date(), action: "offline" }) + "\n",
            { flag: "a" }
        );

        // download latest vod from channel. is the end hook late enough for it to be available?
        if (this.channel && this.channel.download_vod_at_end) {
            let downloadSuccess = "";
            try {
                downloadSuccess = await this.channel.downloadLatestVod(
                    this.channel.download_vod_at_end_quality
                );
            } catch (err) {
                log(
                    LOGLEVEL.ERROR,
                    "automator.end",
                    `Error downloading VOD at end: ${this.vodBasenameTemplate()} (${
                        (err as Error).message
                    })`,
                    err
                );
            }
            if (downloadSuccess !== "") {
                log(
                    LOGLEVEL.INFO,
                    "automator.end",
                    `Downloaded VOD at end: ${this.vodBasenameTemplate()}`
                );
                if (!this.vod && this.channel.latest_vod !== undefined) {
                    this.vod = this.channel.latest_vod;
                }
            }
        }

        KeyValue.getInstance().delete(`${this.broadcaster_user_login}.online`);
        KeyValue.getInstance().delete(`${this.broadcaster_user_login}.vod.id`);
        KeyValue.getInstance().delete(
            `${this.broadcaster_user_login}.vod.started_at`
        );

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
            // download chat
            if (
                this.vod instanceof TwitchVOD &&
                this.channel.download_chat &&
                this.vod.external_vod_id
            ) {
                log(
                    LOGLEVEL.INFO,
                    "automator.onEndDownload",
                    `Auto download chat on ${this.vod.basename}`
                );

                try {
                    await this.vod.downloadChat();
                } catch (error) {
                    log(
                        LOGLEVEL.ERROR,
                        "automator.onEndDownload",
                        `Failed to download chat for ${this.vod.basename}: ${
                            (error as Error).message
                        }`
                    );
                }

                if (this.channel.burn_chat) {
                    // logAdvanced(LOGLEVEL.ERROR, "automator.onEndDownload", "Automatic chat burning has been disabled until settings have been implemented.");
                    await this.burnChat(); // TODO: should this await?
                }
            }

            // run auto exporter
            if (Config.getInstance().cfg("exporter.auto.enabled")) {
                const options: ExporterOptions = {
                    vod: this.vod.uuid,
                    directory: Config.getInstance().cfg(
                        "exporter.default.directory"
                    ),
                    host: Config.getInstance().cfg("exporter.default.host"),
                    username: Config.getInstance().cfg(
                        "exporter.default.username"
                    ),
                    password: Config.getInstance().cfg(
                        "exporter.default.password"
                    ),
                    description: Config.getInstance().cfg(
                        "exporter.default.description"
                    ),
                    tags: Config.getInstance().cfg("exporter.default.tags"),
                    category: Config.getInstance().cfg(
                        "exporter.default.category"
                    ),
                    remote: Config.getInstance().cfg("exporter.default.remote"),
                    title_template: Config.getInstance().cfg(
                        "exporter.default.title_template"
                    ),
                    privacy: Config.getInstance().cfg(
                        "exporter.default.privacy"
                    ),
                };

                let exporter: Exporter | undefined;
                try {
                    exporter = GetExporter(
                        Config.getInstance().cfg("exporter.default.exporter"),
                        "vod",
                        options
                    );
                } catch (error) {
                    log(
                        LOGLEVEL.ERROR,
                        "automator.onEndDownload",
                        `Auto exporter error: ${(error as Error).message}`
                    );
                }

                if (exporter) {
                    exporter
                        .export()
                        .then((out_path) => {
                            if (!exporter) return;
                            if (out_path) {
                                exporter
                                    .verify()
                                    .then((status) => {
                                        log(
                                            LOGLEVEL.SUCCESS,
                                            "automator.onEndDownload",
                                            `Exporter finished for ${this.vodBasenameTemplate()}`
                                        );
                                        if (
                                            exporter &&
                                            exporter.vod &&
                                            status
                                        ) {
                                            exporter.vod.exportData.exported_at =
                                                new Date().toISOString();
                                            void exporter.vod.saveJSON(
                                                "export successful"
                                            );
                                        }
                                    })
                                    .catch((error) => {
                                        log(
                                            LOGLEVEL.ERROR,
                                            "automator.onEndDownload",
                                            (error as Error).message
                                                ? `Verify error: ${
                                                      (error as Error).message
                                                  }`
                                                : "Unknown error occurred while verifying export"
                                        );
                                    });
                            } else {
                                log(
                                    LOGLEVEL.ERROR,
                                    "automator.onEndDownload",
                                    "Exporter finished but no path output."
                                );
                            }
                        })
                        .catch((error) => {
                            log(
                                LOGLEVEL.ERROR,
                                "automator.onEndDownload",
                                (error as Error).message
                                    ? `Export error: ${
                                          (error as Error).message
                                      }`
                                    : "Unknown error occurred while exporting export"
                            );
                        });
                }
            }

            // this is a slow solution since we already remux the vod to mp4, and here we reencode that file
            if (Config.getInstance().cfg("reencoder.enabled")) {
                log(
                    LOGLEVEL.INFO,
                    "automator.onEndDownload",
                    `Auto reencoding on ${this.vod.basename}`
                );
                try {
                    await this.vod.reencodeSegments(
                        true,
                        Config.getInstance().cfg(
                            "reencoder.delete_source",
                            false
                        ) // o_o
                    );
                } catch (error) {
                    log(
                        LOGLEVEL.ERROR,
                        "automator.onEndDownload",
                        `Failed to reencode ${this.vod.basename}: ${
                            (error as Error).message
                        }`
                    );
                }
            }

            // run auto splitter
            if (
                isTwitchVOD(this.vod) &&
                Config.getInstance().cfg("capture.autosplit-enabled")
            ) {
                try {
                    await this.vod.splitSegmentVideoByChapters();
                } catch (error) {
                    log(
                        LOGLEVEL.ERROR,
                        "automator.onEndDownload",
                        `Failed to split ${this.vod.basename}: ${
                            (error as Error).message
                        }`
                    );
                }
            }

            // if there's no eventsub hook the stream will never actually end
            if (Config.getInstance().cfg<boolean>("isolated_mode")) {
                await this.end();
            }
        }

        KeyValue.getInstance().delete(`${this.broadcaster_user_login}.offline`);

        return true;
    }

    public applySeasonEpisode() {
        if (!this.channel) throw new Error("No channel");
        const s = this.channel.incrementStreamNumber();
        this.vod_season = s.season;
        this.vod_absolute_season = s.absolute_season;
        this.vod_episode = s.stream_number;
        this.vod_absolute_episode = s.absolute_stream_number;
    }

    /**
     * Starts the capture of the stream.
     * @param tries The number of download attempts made (optional, default is 0).
     * @returns A Promise that resolves to a boolean indicating whether the download was successful.
     * @throws An error if the channel is not found, no VOD ID is supplied, or if the download fails.
     */
    public async download(tries = 0): Promise<boolean> {
        // const data_title = this.getTitle();
        const dataStarted = this.getStartDate();
        const dataId = this.getVodID();
        const dataUsername = this.getUsername();

        // const channel = TwitchChannel.getChannelByLogin(this.getLogin());

        if (!this.channel) {
            throw new Error(`Channel ${this.getLogin()} not found, weird.`);
        }

        if (!dataId) {
            log(
                LOGLEVEL.ERROR,
                "automator.download",
                `No VOD ID supplied for download (${this.getLogin()}) (try #${tries})`
            );
            throw new Error("No vod id supplied");
        }

        if (KeyValue.getInstance().has(`${this.getLogin()}.vod.id`)) {
            log(
                LOGLEVEL.ERROR,
                "automator.download",
                `VOD ID already exists for ${this.getLogin()}`
            );
        }

        const tempBasename = this.vodBasenameTemplate();

        // if running
        const job = Job.findJob(
            `capture_${this.getLogin()}_${this.getVodID()}`
        );
        if (job && (await job.getStatus()) === JobStatus.RUNNING) {
            const meta = job.metadata as {
                login: string;
                basename: string;
                capture_filename: string;
                stream_id: string;
            };
            log(
                LOGLEVEL.FATAL,
                "automator.download",
                `Stream already capturing to ${meta.basename} from ${dataUsername}, but reached download function regardless!`
            );
            this.fallbackCapture()
                .then(() => {
                    log(
                        LOGLEVEL.INFO,
                        "automator.download",
                        `Fallback capture finished for ${this.getLogin()}`
                    );
                })
                .catch((error) => {
                    log(
                        LOGLEVEL.ERROR,
                        "automator.download",
                        `Fallback capture failed for ${this.getLogin()}: ${
                            (error as Error).message
                        }`
                    );
                    console.error(error);
                });
            return false;
        }

        // check matched title
        if (
            this.channel &&
            this.channel.match &&
            this.channel.match.length > 0
        ) {
            let match = false;

            log(
                LOGLEVEL.INFO,
                "automator.download",
                `Check keyword matches for ${tempBasename}`
            );

            for (const m of this.channel.match) {
                if (this.channel.getChapterData()?.title.includes(m)) {
                    match = true;
                    break;
                }
            }

            if (!match) {
                log(
                    LOGLEVEL.WARNING,
                    "automator.download",
                    `Cancel download of ${tempBasename} due to missing keywords`
                );
                return false;
            }
        }

        // pre-calculate season and episode
        this.applySeasonEpisode();

        const basename = this.vodBasenameTemplate();

        // folder base depends on vod season/episode now
        const folderBase = this.fulldir();
        if (!fs.existsSync(folderBase)) {
            log(
                LOGLEVEL.DEBUG,
                "automator.download",
                `Making folder for ${tempBasename}.`
            );
            fs.mkdirSync(folderBase, { recursive: true });
        }

        if (TwitchVOD.hasVod(basename) || TwitchVOD.getVodByCaptureId(dataId)) {
            log(
                LOGLEVEL.ERROR,
                "automator.download",
                `Cancel download of ${basename}, vod already exists`
            );
            this.fallbackCapture()
                .then(() => {
                    log(
                        LOGLEVEL.INFO,
                        "automator.download",
                        `Fallback capture finished for ${this.getLogin()}`
                    );
                })
                .catch((error) => {
                    log(
                        LOGLEVEL.ERROR,
                        "automator.download",
                        `Fallback capture failed for ${this.getLogin()}: ${
                            (error as Error).message
                        }`
                    );
                    console.error(error);
                });
            return false;
        }

        // create the vod and put it inside this class
        try {
            this.vod = await this.channel.createVOD(
                path.join(folderBase, `${basename}.json`),
                dataId
            );
        } catch (error) {
            log(
                LOGLEVEL.ERROR,
                "automator.download",
                `Failed to create vod for ${basename}: ${
                    (error as Error).message
                }`
            );
            return false;
        }

        this.vod.channel_uuid = this.channel.uuid; // to be sure

        // if (this.vod instanceof TwitchChannel) {
        //     this.vod.meta = this.payload_eventsub;
        // }

        // this.vod.json.meta = $this.payload_eventsub; // what
        this.vod.capture_id = dataId || "1";
        this.vod.started_at = parseJSON(dataStarted);

        // this.vod.stream_number = this.channel.incrementStreamNumber();
        // this.vod.stream_season = this.channel.current_season; /** @TODO: field? **/
        // this.vod.stream_absolute_season = this.channel.current_absolute_season;
        this.vod.stream_number = this.vod_episode;
        // this.vod.stream_season = this.vod_season;
        this.vod.stream_absolute_season = this.vod_absolute_season;

        if (this.force_record) this.vod.force_record = true;

        this.vod.not_started = false;

        // this.vod.saveJSON("stream download");

        Webhook.dispatchAll("start_download", {
            vod: await this.vod.toAPI(),
        } as StartDownloadData);

        this.vod.is_capturing = true;
        await this.vod.saveJSON("is_capturing set");

        // update the game + title if it wasn't updated already
        log(LOGLEVEL.INFO, "automator.download", `Update game for ${basename}`);
        if (KeyValue.getInstance().has(`${this.getLogin()}.chapterdata`)) {
            await this.updateGame(true, true);
            // KeyValue.delete(`${this.getLogin()}.channeldata`);
        }

        const containerExtension =
            this.channel.quality && this.channel.quality[0] === "audio_only"
                ? Config.AudioContainer
                : Config.getInstance().cfg("vod_container", "mp4");

        // decide on the capture filename
        if (Config.getInstance().cfg("capture.use_cache", false)) {
            this.capture_filename = path.join(
                BaseConfigCacheFolder.capture,
                `${this.getLogin()}_${this.getVodID()}_${format(
                    new Date(),
                    "yyyy-MM-dd_HH-mm-ss"
                )}.ts`
            );
        } else {
            this.capture_filename = path.join(folderBase, `${basename}.ts`);
        }

        this.vod.capturingFilename = this.capture_filename;

        this.converted_filename = path.join(
            folderBase,
            `${basename}.${containerExtension}`
        );
        this.chat_filename = path.join(folderBase, `${basename}.chatdump`);

        // capture with streamlink, this is the crucial point in this entire program
        this.startCaptureChat();

        // capture viewer count if enabled
        if (
            this.vod &&
            isTwitchVOD(this.vod) &&
            Config.getInstance().cfg("capture.viewercount", false)
        ) {
            this.vod.startWatchingViewerCount();
        }

        this.vod.not_started = false;

        // fingers crossed, this is where the capture happens
        try {
            await this.captureVideo();
        } catch (error) {
            log(
                LOGLEVEL.FATAL,
                "automator.download",
                `Failed to capture video: ${(error as Error).message}`,
                error
            );
            void this.endCaptureChat();
            // capture viewer count if enabled
            if (this.vod && isTwitchVOD(this.vod))
                this.vod.stopWatchingViewerCount();
            this.vod.is_capturing = false;
            this.vod.failed = true;
            await this.vod.saveJSON("capture fail");
            // this.vod.delete();
            return false;
        }

        void this.endCaptureChat();

        if (this.vod && isTwitchVOD(this.vod))
            this.vod.stopWatchingViewerCount();

        const captureSuccess =
            fs.existsSync(this.capture_filename) &&
            fs.statSync(this.capture_filename).size > 0;

        // send internal webhook for capture start
        Webhook.dispatchAll("end_capture", {
            vod: await this.vod.toAPI(),
            success: captureSuccess,
        } as EndCaptureData);

        // error handling if nothing got downloaded
        if (!captureSuccess) {
            log(
                LOGLEVEL.WARNING,
                "automator.download",
                `Panic handler for ${basename}, no captured file!`
            );

            if (tries >= Config.getInstance().cfg<number>("download_retries")) {
                log(
                    LOGLEVEL.ERROR,
                    "automator.download",
                    `Giving up on downloading, too many tries for ${basename}`
                );
                fs.renameSync(
                    path.join(folderBase, `${basename}.json`),
                    path.join(folderBase, `${basename}.json.broken`)
                );
                throw new Error("Too many tries");
                // TODO: fatal error
            }

            log(
                LOGLEVEL.ERROR,
                "automator.download",
                `Error when downloading, retrying ${basename}`
            );

            // sleep(15);
            await Sleep(15 * 1000);

            return this.download(tries + 1);
        }

        // end timestamp
        log(
            LOGLEVEL.INFO,
            "automator.download",
            `Add end timestamp for ${basename}`
        );

        this.vod.ended_at = new Date();
        this.vod.is_capturing = false;
        if (this.stream_resolution)
            this.vod.stream_resolution = this.stream_resolution;
        await this.vod.saveJSON("stream capture end");

        const duration = this.vod.getDurationLive();
        if (duration && duration > 86400 - 60 * 20) {
            // 24 hours - 20 minutes
            this.is24HourStream = true;
            log(
                LOGLEVEL.WARNING,
                "automator.download",
                `The stream ${basename} is 24 hours, this might cause issues.`
            );
            // https://github.com/streamlink/streamlink/issues/1058
            // streamlink currently does not refresh the stream if it is 24 hours or longer
            // it doesn't seem to get fixed, so we'll just warn the user

            // just as a last resort, capture again
            this.fallbackCapture()
                .then(() => {
                    log(
                        LOGLEVEL.INFO,
                        "automator.download",
                        `Fallback capture finished for ${this.getLogin()}`
                    );
                })
                .catch((error) => {
                    log(
                        LOGLEVEL.ERROR,
                        "automator.download",
                        `Fallback capture failed for ${this.getLogin()}: ${
                            (error as Error).message
                        }`
                    );
                    console.error(error);
                });
        }

        this.vod.calculateChapters();

        await this.vod.removeShortChapters();

        // wait for 30 seconds in case something didn't finish
        await Sleep(30 * 1000);

        if (!Config.getInstance().cfg("no_vod_convert", false)) {
            // check for free space
            await LiveStreamDVR.getInstance().updateFreeStorageDiskSpace();

            // check if we have enough space, ts is about the same size as the mp4
            if (
                LiveStreamDVR.getInstance().freeStorageDiskSpace <
                fs.statSync(this.capture_filename).size
            ) {
                log(
                    LOGLEVEL.ERROR,
                    "automator.download",
                    `Not enough free space for remuxing ${basename}, skipping...`
                );
            } else {
                this.vod.is_converting = true;
                await this.vod.saveJSON("is_converting set");

                // convert with ffmpeg
                await this.convertVideo();

                // sleep(10);
                await Sleep(10 * 1000);

                const convertSuccess =
                    fs.existsSync(this.capture_filename) &&
                    fs.existsSync(this.converted_filename) &&
                    fs.statSync(this.converted_filename).size > 0;
                // send internal webhook for convert start
                Webhook.dispatchAll("end_convert", {
                    vod: await this.vod.toAPI(),
                    success: convertSuccess,
                } as EndConvertData);

                // remove ts if both files exist
                if (convertSuccess) {
                    log(
                        LOGLEVEL.DEBUG,
                        "automator.download",
                        `Remove ts file for ${basename}`
                    );
                    fs.unlinkSync(this.capture_filename);
                } else {
                    log(
                        LOGLEVEL.FATAL,
                        "automator.download",
                        `Missing conversion files for ${basename}`
                    );
                    // this.vod.automator_fail = true;
                    this.vod.is_converting = false;
                    await this.vod.saveJSON("automator fail");
                    return false;
                }

                // add the captured segment to the vod info
                log(
                    LOGLEVEL.INFO,
                    "automator.download",
                    `Conversion done, add segment '${this.converted_filename}' to '${basename}'`
                );

                this.vod.is_converting = false;
                await this.vod.addSegment(
                    path.basename(this.converted_filename)
                );

                if (this.vod.segments.length > 1) {
                    log(
                        LOGLEVEL.WARNING,
                        "automator.download",
                        `More than one segment (${this.vod.segments.length}) for ${basename}, this should not happen!`
                    );
                    ClientBroker.notify(
                        "Segment error",
                        `More than one segment (${this.vod.segments.length}) for ${basename}, this should not happen!`,
                        "",
                        "system"
                    );
                }

                await this.vod.saveJSON("add segment");
            }
        } else {
            log(
                LOGLEVEL.INFO,
                "automator.download",
                `No conversion for ${basename}, just add segments`
            );
            await this.vod.addSegment(path.basename(this.capture_filename));
            await this.vod.saveJSON("add segment");
        }

        // finalize
        log(
            LOGLEVEL.INFO,
            "automator.download",
            `Sleep 30 seconds for ${basename}`
        );
        await Sleep(30 * 1000);

        log(LOGLEVEL.INFO, "automator.download", `Do metadata on ${basename}`);

        let finalized = false;
        try {
            finalized = await this.vod.finalize();
        } catch (error) {
            log(
                LOGLEVEL.FATAL,
                "automator.download",
                `Failed to finalize ${basename}: ${(error as Error).message}`,
                error
            );
            await this.vod.saveJSON("failed to finalize");
        }

        if (finalized) {
            await this.vod.saveJSON("finalized");
        }

        // remove old vods for the streamer
        log(
            LOGLEVEL.INFO,
            "automator.download",
            `Cleanup old VODs for ${dataUsername}`
        );
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

        log(LOGLEVEL.SUCCESS, "automator.download", `All done for ${basename}`);

        // finally send internal webhook for capture finish
        Webhook.dispatchAll("end_download", {
            vod: await this.vod.toAPI(),
        } as VodUpdated);

        await this.onEndDownload();

        return true;
    }

    /**
     * Returns an array of provider arguments.
     * Override this method to add custom arguments.
     *
     * @returns {string[]} The provider arguments.
     */
    public providerArgs(): string[] {
        return [];
    }

    /**
     * A function to do things with the incoming log data from streamlink.
     * For example, check for errors or ad-breaks.
     *
     * @param source - The source of the data, either "stdout" or "stderr".
     * @param data - The ticker data received from the streamlink.
     */
    public captureTicker(source: "stdout" | "stderr", data: string) {
        if (data == null || data == undefined || typeof data !== "string") {
            log(
                LOGLEVEL.ERROR,
                "automator.captureTicker",
                "Invalid data received from streamlink",
                {
                    source,
                    data,
                }
            );
            return;
        }

        const basename = this.vod
            ? this.vod.basename
            : this.vodBasenameTemplate();

        if (data.includes("bad interpreter: No such file or directory")) {
            log(
                LOGLEVEL.ERROR,
                "automator.captureTicker",
                "Fatal error with streamlink, please check logs"
            );
        }

        if (data.includes("already exists, use --force to overwrite")) {
            log(
                LOGLEVEL.FATAL,
                "automator.captureTicker",
                `File already exists for ${basename}!`
            );
        }

        // get stream resolution
        const resolutionMatch = data.match(/stream:\s([0-9_a-z]+)\s/);
        if (resolutionMatch) {
            this.stream_resolution = resolutionMatch[1] as VideoQuality;
            if (this.vod) this.vod.stream_resolution = this.stream_resolution;
            log(
                LOGLEVEL.INFO,
                "automator.captureTicker",
                `Stream resolution for ${basename}: ${this.stream_resolution}`
            );

            if (this.channel && this.channel.quality) {
                if (this.channel.quality.includes("best")) {
                    if (this.stream_resolution !== "1080p60") {
                        // considered best as of 2022
                        log(
                            LOGLEVEL.WARNING,
                            "automator.captureTicker",
                            `Stream resolution ${this.stream_resolution} assumed to not be in channel quality list`
                        );
                    }
                } else if (this.channel.quality.includes("worst")) {
                    if (this.stream_resolution !== "140p") {
                        // considered worst
                        log(
                            LOGLEVEL.WARNING,
                            "automator.captureTicker",
                            `Stream resolution ${this.stream_resolution} assumed to not be in channel quality list`
                        );
                    }
                } else {
                    if (
                        !this.channel.quality.includes(this.stream_resolution)
                    ) {
                        log(
                            LOGLEVEL.WARNING,
                            "automator.captureTicker",
                            `Stream resolution ${this.stream_resolution} not in channel quality list`
                        );
                    }
                }
            }
        }

        // stream stop
        if (data.includes("404 Client Error")) {
            log(
                LOGLEVEL.WARNING,
                "automator.captureTicker",
                `Chunk 404'd for ${basename} (${this.chunks_missing}/100)!`
            );
            this.chunks_missing++;
            if (this.chunks_missing >= 100) {
                log(
                    LOGLEVEL.WARNING,
                    "automator.captureTicker",
                    `Too many 404'd chunks for ${basename}, stopping!`
                );
                this.captureJob?.kill();
            }

            if (
                KeyValue.getInstance().getBool(
                    `${this.broadcaster_user_login}.offline`
                ) &&
                Config.getInstance().cfg("capture.killendedstream")
            ) {
                log(
                    LOGLEVEL.INFO,
                    "automator.captureTicker",
                    `Stream offline for ${basename}, stopping instead of waiting for 404s!`
                );
                this.captureJob?.kill();
            }
        }

        if (data.includes("Failed to reload playlist")) {
            log(
                LOGLEVEL.ERROR,
                "automator.captureTicker",
                `Failed to reload playlist for ${basename}!`
            );
        }

        if (data.includes("Failed to fetch segment")) {
            log(
                LOGLEVEL.ERROR,
                "automator.captureTicker",
                `Failed to fetch segment for ${basename}!`
            );
        }

        if (data.includes("Waiting for streams")) {
            log(
                LOGLEVEL.WARNING,
                "automator.captureTicker",
                `No streams found for ${basename}, retrying...`
            );
        }

        // stream error
        if (data.includes("403 Client Error")) {
            log(
                LOGLEVEL.ERROR,
                "automator.captureTicker",
                `Chunk 403'd for ${basename}! Private stream?`
            );
        }

        // ad removal
        if (data.includes("Will skip ad segments")) {
            log(
                LOGLEVEL.INFO,
                "automator.captureTicker",
                `Capturing of ${basename}, will try to remove ads!`
            );
            // current_ad_start = new Date();
        }

        if (data.includes("Writing output to")) {
            log(
                LOGLEVEL.INFO,
                "automator.captureTicker",
                "Streamlink now writing output to container."
            );
            if (this.vod) {
                this.vod.capture_started2 = new Date();
                this.vod.broadcastUpdate();
            }
        }

        if (data.includes("Waiting for pre-roll ads to finish")) {
            log(
                LOGLEVEL.INFO,
                "automator.captureTicker",
                "Streamlink waiting for pre-roll ads to finish."
            );
        }

        if (data.includes("Filtering out segments and pausing stream output")) {
            log(
                LOGLEVEL.INFO,
                "automator.captureTicker",
                "Streamlink filtering out segments and pausing stream output."
            );
            // create ad object
            this.stream_pause = { start: new Date() };
            if (this.vod) {
                this.vod.is_capture_paused = true;
                this.vod.broadcastUpdate();
            }
        }

        if (data.includes("Resuming stream output")) {
            log(
                LOGLEVEL.INFO,
                "automator.captureTicker",
                "Streamlink resuming stream output."
            );
            // end ad object
            if (this.stream_pause && this.stream_pause.start) {
                this.stream_pause.end = new Date();
                if (this.vod) {
                    const duration = Math.round(
                        (this.stream_pause.end.getTime() -
                            this.stream_pause.start.getTime()) /
                            1000
                    );
                    log(
                        LOGLEVEL.INFO,
                        "automator.captureTicker",
                        `Pause detected for ${basename}, ${duration}s long.`
                    );
                    this.vod.stream_pauses.push(
                        this.stream_pause as StreamPause
                    ); // cool hack
                    this.vod.is_capture_paused = false;
                    this.vod.broadcastUpdate();
                }
                this.stream_pause = undefined;
            }
        }

        if (data.includes("Read timeout, exiting")) {
            log(
                LOGLEVEL.ERROR,
                "automator.captureTicker",
                `Read timeout, exiting for ${basename}!`
            );
            if (
                KeyValue.getInstance().getBool(
                    `${this.broadcaster_user_login}.online`
                )
            ) {
                this.fallbackCapture()
                    .then(() => {
                        log(
                            LOGLEVEL.INFO,
                            "automator.captureTicker",
                            `Fallback capture finished for ${this.getLogin()}`
                        );
                    })
                    .catch((error) => {
                        log(
                            LOGLEVEL.ERROR,
                            "automator.captureTicker",
                            `Fallback capture failed for ${this.getLogin()}: ${
                                (error as Error).message
                            }`
                        );
                        console.error(error);
                    });
            }
        }

        if (data.includes("Stream ended")) {
            log(
                LOGLEVEL.INFO,
                "automator.captureTicker",
                `Stream ended for ${basename}!`
            );
        }

        if (data.includes("Closing currently open stream...")) {
            log(
                LOGLEVEL.INFO,
                "automator.captureTicker",
                `Closing currently open stream for ${basename}!`
            );
        }

        if (data.includes("error: The specified stream(s)")) {
            log(
                LOGLEVEL.ERROR,
                "automator.captureTicker",
                `Capturing of ${basename} failed, selected quality not available!`
            );
        }

        if (data.includes("error: No playable streams found on this URL:")) {
            log(
                LOGLEVEL.ERROR,
                "automator.captureTicker",
                `Capturing of ${basename} failed, no streams available!`
            );
            ClientBroker.notify(
                "Streamlink error",
                t(
                    "notify.capturing-of-basename-failed-no-streams-available-nis-there-a-configuration-error",
                    [basename]
                ).toString(),
                "",
                "system"
            );
        }

        if (data.includes("error: Encountered a stream discontinuity")) {
            log(
                LOGLEVEL.WARNING,
                "automator.captureTicker",
                `Encountered a stream discontinuity for ${basename}!`
            );
        }
    }

    public captureStreamlinkArguments(stream_url: string): string[] {
        const cmd = [];

        // How many segments from the end to start live HLS streams on.
        cmd.push("--hls-live-edge", "99999");

        // timeout due to ads
        cmd.push(
            "--hls-timeout",
            Config.getInstance().cfg("hls_timeout", 120).toString()
        );

        // timeout due to ads
        cmd.push(
            "--hls-segment-timeout",
            Config.getInstance().cfg("hls_timeout", 120).toString()
        );

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

        return cmd;
    }

    /**
     * Create process and capture video
     * @throws
     * @returns
     */
    public captureVideo(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            if (!this.vod) {
                log(
                    LOGLEVEL.ERROR,
                    "automator.captureVideo",
                    `No VOD for ${this.vodBasenameTemplate()}, this should not happen`
                );
                reject(false);
                return;
            }

            const basename = this.vodBasenameTemplate();

            const streamUrl = this.streamURL();

            const bin = Helper.path_streamlink();

            if (!bin) {
                log(
                    LOGLEVEL.ERROR,
                    "automator.captureVideo",
                    "Streamlink not found"
                );
                reject(false);
                return;
            }

            const cmd = this.captureStreamlinkArguments(streamUrl);

            this.vod.capture_started = new Date();
            this.vod.saveJSON("dt_capture_started set");

            log(
                LOGLEVEL.INFO,
                "automator.captureVideo",
                `Starting capture with filename ${path.basename(
                    this.capture_filename
                )}`
            );

            // TODO: use TwitchHelper.startJob instead

            // spawn process
            // const capture_process = spawn(bin, cmd, {
            //     cwd: path.dirname(this.capture_filename),
            //     windowsHide: true,
            // });

            // make job for capture
            const jobName = `capture_${this.getLogin()}_${this.getVodID()}`;

            this.captureJob = startJob(jobName, bin, cmd) || undefined;

            if (this.captureJob) {
                log(
                    LOGLEVEL.SUCCESS,
                    "automator.captureVideo",
                    `Spawned process ${this.captureJob.pid} for ${jobName}`
                );
                this.captureJob.addMetadata({
                    login: this.getLogin(), // TODO: username?
                    basename: this.vodBasenameTemplate(),
                    capture_filename: this.capture_filename,
                    stream_id: this.getVodID(),
                });
                // if (!this.captureJob.save()) {
                //     log(LOGLEVEL.ERROR, "automator.captureVideo", `Failed to save job ${jobName}`);
                // }
            } else {
                log(
                    LOGLEVEL.FATAL,
                    "automator.captureVideo",
                    `Failed to spawn capture process for ${jobName}`
                );
                reject(false);
                return;
            }

            let lastSize = 0;
            const keepaliveAlert = () => {
                if (this.stream_pause !== undefined && this.stream_pause) {
                    let size;
                    try {
                        size = fs.statSync(this.capture_filename).size;
                    } catch (error) {
                        log(
                            LOGLEVEL.ERROR,
                            "automator.captureVideo",
                            `Failed to get size of ${this.capture_filename}: ${
                                (error as Error).message
                            }`
                        );
                        return;
                    }
                    progressOutput(
                        `⏸ ${basename} ${this.stream_resolution} ` +
                            `${formatBytes(size)} / ${Math.round(
                                (0 * 8) / 1000
                            )} kbps`
                    );
                } else if (fs.existsSync(this.capture_filename)) {
                    const size = fs.statSync(this.capture_filename).size;
                    const bitRate = (size - lastSize) / 120;
                    lastSize = size;
                    progressOutput(
                        `🎥 ${basename} ${this.stream_resolution} ` +
                            `${formatBytes(size)} / ${Math.round(
                                (bitRate * 8) / 1000
                            )} kbps`
                    );
                } else {
                    console.log(
                        chalk.bgRed.whiteBright(
                            `🎥 ${new Date().toISOString()} ${basename} missing`
                        )
                    );
                }
            };

            const keepalive = xInterval(keepaliveAlert, 120 * 1000);

            // critical end
            this.captureJob.on("process_close", (code, signal) => {
                if (code === 0) {
                    log(
                        LOGLEVEL.SUCCESS,
                        "automator.captureVideo",
                        `Job ${jobName} exited with code 0, signal ${signal}`
                    );
                } else {
                    log(
                        LOGLEVEL.ERROR,
                        "automator.captureVideo",
                        `Job ${jobName} exited with code ${code}, signal ${signal}`
                    );
                }

                xClearInterval(keepalive);

                if (this.captureJob) {
                    this.captureJob.clear();
                }

                if (
                    fs.existsSync(this.capture_filename) &&
                    fs.statSync(this.capture_filename).size > 0
                ) {
                    // const stream_resolution = capture_job.stdout.join("\n").match(/stream:\s([0-9_a-z]+)\s/);
                    // if (stream_resolution && this.vod) {
                    //     this.vod.stream_resolution = stream_resolution[1] as VideoQuality;
                    // }

                    resolve(true);
                } else {
                    log(
                        LOGLEVEL.ERROR,
                        "automator.captureVideo",
                        `Capture ${basename} failed`
                    );
                    reject(false);
                }
            });

            this.chunks_missing = 0;

            // attach output to parsing
            this.captureJob.on("stdout", (data) => {
                this.captureTicker("stdout", data);
            });
            this.captureJob.on("stderr", (data) => {
                this.captureTicker("stderr", data);
            });

            // check for errors
            this.captureJob.on("process_error", (err) => {
                xClearInterval(keepalive);
                log(
                    LOGLEVEL.ERROR,
                    "automator.captureVideo",
                    `Error with streamlink for ${basename}: ${err.message}`,
                    err
                );
                reject(false);
            });

            // process.on("exit", (code, signal) => {
            //     clearInterval(keepalive);
            //     TwitchlogAdvanced(LOGLEVEL.ERROR, "automator.captureVideo", `Streamlink exited with code ${code} for ${basename}`);
            // });

            // this.vod.generatePlaylistFile();

            // send internal webhook for capture start
            void this.vod.toAPI().then((vod) => {
                Webhook.dispatchAll("start_capture", {
                    vod: vod,
                } as VodUpdated);
            });
        });
    }

    public async burnChat(): Promise<void> {
        if (!this.vod) {
            log(
                LOGLEVEL.ERROR,
                "automator.burnChat",
                "No VOD for burning chat"
            );
            return;
        }

        const chatHeight: number =
            this.vod.video_metadata &&
            this.vod.video_metadata.type !== "audio" &&
            Config.getInstance().cfg<boolean>(
                "chatburn.default.auto_chat_height"
            )
                ? this.vod.video_metadata.height
                : Config.getInstance().cfg<number>(
                      "chatburn.default.chat_height"
                  );
        const settings = {
            vodSource: "captured",
            chatSource: "captured",
            chatWidth: Config.getInstance().cfg<number>(
                "chatburn.default.chat_width"
            ),
            chatHeight: chatHeight,
            chatFont: Config.getInstance().cfg<string>(
                "chatburn.default.chat_font"
            ),
            chatFontSize: Config.getInstance().cfg<number>(
                "chatburn.default.chat_font_size"
            ),
            burnHorizontal: Config.getInstance().cfg<string>(
                "chatburn.default.horizontal"
            ),
            burnVertical: Config.getInstance().cfg<string>(
                "chatburn.default.vertical"
            ),
            ffmpegPreset: Config.getInstance().cfg<string>(
                "chatburn.default.preset"
            ),
            ffmpegCrf: Config.getInstance().cfg<number>("chatburn.default.crf"),
            burnOffset: 0,
        };

        let statusRenderchat, statusBurnchat;

        try {
            statusRenderchat = await this.vod.renderChat(
                settings.chatWidth,
                settings.chatHeight,
                settings.chatFont,
                settings.chatFontSize,
                settings.chatSource == "downloaded",
                true
            );
        } catch (error) {
            log(LOGLEVEL.ERROR, "automator.burnChat", (error as Error).message);
            return;
        }

        try {
            statusBurnchat = await this.vod.burnChat(
                settings.burnHorizontal,
                settings.burnVertical,
                settings.ffmpegPreset,
                settings.ffmpegCrf,
                settings.vodSource == "downloaded",
                true,
                settings.burnOffset
            );
        } catch (error) {
            log(LOGLEVEL.ERROR, "automator.burnChat", (error as Error).message);
            return;
        }

        log(
            LOGLEVEL.INFO,
            "automator.burnChat",
            `Render: ${statusRenderchat}, Burn: ${statusBurnchat}`
        );
    }

    /**
     * Fallback capture for when you really really want to capture a VOD even if it's a duplicate or whatever
     */
    public fallbackCapture(): Promise<boolean> {
        if (
            !Config.getInstance().cfg("capture.fallbackcapture") &&
            !this.is24HourStream
        ) {
            return Promise.reject(new Error("Fallback capture disabled"));
        }

        return new Promise((resolve, reject) => {
            const basename = `${this.getVodID()}_${format(
                new Date(),
                "yyyy-MM-dd_HH-mm-ss"
            )}`;

            const streamUrl = this.streamURL();

            const bin = Helper.path_streamlink();

            const captureFilename = path.join(
                BaseConfigDataFolder.saved_vods,
                `${basename}.mp4`
            );

            if (!bin) {
                log(
                    LOGLEVEL.ERROR,
                    "automator.fallbackCapture",
                    "Streamlink not found"
                );
                reject(false);
                return;
            }

            const cmd = this.captureStreamlinkArguments(streamUrl);

            log(
                LOGLEVEL.INFO,
                "automator.fallbackCapture",
                `Starting fallback capture with filename ${path.basename(
                    captureFilename
                )}`
            );

            // TODO: use TwitchHelper.startJob instead

            // spawn process
            const captureProcess = spawn(bin, cmd, {
                cwd: path.dirname(captureFilename),
                windowsHide: true,
            });

            // make job for capture
            let captureJob: Job;
            const jobName = `fbcapture_${this.getLogin()}_${this.getVodID()}`;

            if (captureProcess.pid) {
                log(
                    LOGLEVEL.SUCCESS,
                    "automator.fallbackCapture",
                    `Spawned process ${captureProcess.pid} for ${jobName}`
                );
                captureJob = Job.create(jobName);
                captureJob.setPid(captureProcess.pid);
                captureJob.setExec(bin, cmd);
                captureJob.setProcess(captureProcess);
                captureJob.startLog(jobName, `$ ${bin} ${cmd.join(" ")}\n`);
                captureJob.addMetadata({
                    login: this.getLogin(), // TODO: username?
                    capture_filename: captureFilename,
                    stream_id: this.getVodID(),
                });
                if (!captureJob.save()) {
                    log(
                        LOGLEVEL.ERROR,
                        "automator.fallbackCapture",
                        `Failed to save job ${jobName}`
                    );
                }
            } else {
                log(
                    LOGLEVEL.FATAL,
                    "automator.fallbackCapture",
                    `Failed to spawn capture process for ${jobName}`
                );
                reject(false);
                return;
            }

            let lastSize = 0;
            const keepaliveAlert = () => {
                if (fs.existsSync(captureFilename)) {
                    const size = fs.statSync(captureFilename).size;
                    const bitRate = (size - lastSize) / 120;
                    lastSize = size;
                    console.log(
                        chalk.bgGreen.whiteBright(
                            `🎥 ${new Date().toISOString()} ${basename} ${
                                this.stream_resolution
                            } ` +
                                `${formatBytes(size)} / ${Math.round(
                                    (bitRate * 8) / 1000
                                )} kbps`
                        )
                    );
                } else {
                    console.log(
                        chalk.bgRed.whiteBright(
                            `🎥 ${new Date().toISOString()} ${basename} missing`
                        )
                    );
                }
            };

            const keepalive = xInterval(keepaliveAlert, 120 * 1000);

            // critical end
            captureProcess.on("close", (code, signal) => {
                if (code === 0) {
                    log(
                        LOGLEVEL.SUCCESS,
                        "automator.fallbackCapture",
                        `Job ${jobName} exited with code 0, signal ${signal}`
                    );
                } else {
                    log(
                        LOGLEVEL.ERROR,
                        "automator.fallbackCapture",
                        `Job ${jobName} exited with code ${code}, signal ${signal}`
                    );
                }

                xClearInterval(keepalive);

                if (captureJob) {
                    captureJob.clear();
                }

                if (
                    fs.existsSync(captureFilename) &&
                    fs.statSync(captureFilename).size > 0
                ) {
                    resolve(true);
                } else {
                    log(
                        LOGLEVEL.ERROR,
                        "automator.fallbackCapture",
                        `Capture ${basename} failed`
                    );
                    reject(false);
                }
            });

            this.chunks_missing = 0;

            // attach output to parsing
            captureProcess.stdout.on("data", (data) => {
                this.captureTicker("stdout", data);
            });
            captureProcess.stderr.on("data", (data) => {
                this.captureTicker("stderr", data);
            });

            // check for errors
            captureProcess.on("error", (err) => {
                xClearInterval(keepalive);
                log(
                    LOGLEVEL.ERROR,
                    "automator.fallbackCapture",
                    `Error with streamlink for ${basename}: ${err.message}`,
                    err
                );
                reject(false);
            });
        });
    }

    /**
     * Capture chat in a "detached" process
     */
    private startCaptureChat(): boolean {
        // const channel = TwitchChannel.getChannelByLogin(this.broadcaster_user_login);

        // chat capture
        if (this.channel && this.channel.live_chat && this.realm == "twitch") {
            const dataStarted = this.getStartDate();
            // const data_id = this.getVodID();
            const dataLogin = this.getLogin();
            // const data_username = this.getUsername();
            const dataUserId = this.getUserID();

            /*
            const chat_bin = "node";
            const chat_cmd: string[] = [];

            // todo: execute directly in node?
            chat_cmd.push(path.join(AppRoot, "twitch-chat-dumper", "build", "index.js"));
            chat_cmd.push("--channel", data_login);
            chat_cmd.push("--userid", data_userid);
            chat_cmd.push("--date", data_started);
            chat_cmd.push("--output", this.chat_filename);

            logAdvanced(LOGLEVEL.INFO, "automator", `Starting chat dump with filename ${path.basename(this.chat_filename)}`);

            const chat_job = Helper.startJob(`chatdump_${this.basename()}`, chat_bin, chat_cmd);
            */

            const chatJob = TwitchChannel.startChatDump(
                `${this.getLogin()}_${this.getVodID()}`,
                dataLogin,
                dataUserId,
                parseJSON(dataStarted),
                this.chat_filename
            );

            if (chatJob && chatJob.pid) {
                this.chatJob = chatJob;
                this.chatJob.addMetadata({
                    username: dataLogin,
                    basename: this.vodBasenameTemplate(),
                    chat_filename: this.chat_filename,
                });
            } else {
                log(
                    LOGLEVEL.ERROR,
                    "automator.captureChat",
                    `Failed to start chat dump job with filename ${path.basename(
                        this.chat_filename
                    )}`
                );
                return false;
            }

            return true;
        }

        return false;
    }

    /**
     * Kill the process, stopping chat capture
     */
    private async endCaptureChat(): Promise<void> {
        if (this.chatJob) {
            log(
                LOGLEVEL.INFO,
                "automator.endCaptureChat",
                `Ending chat dump with filename ${path.basename(
                    this.chat_filename
                )}`
            );
            await this.chatJob.kill();
        }
    }

    // maybe use this?
    private async compressChat(): Promise<boolean> {
        if (fs.existsSync(this.chat_filename)) {
            await execSimple("gzip", [this.chat_filename], "compress chat");
            return fs.existsSync(`${this.chat_filename}.gz`);
        }
        return false;
    }

    private async convertVideo(): Promise<boolean> {
        if (!this.vod) throw new Error("VOD not set");

        Webhook.dispatchAll("start_convert", {
            vod: await this.vod.toAPI(),
        } as VodUpdated);

        let mf;
        if (
            Config.getInstance().cfg("create_video_chapters") &&
            (await this.vod.saveFFMPEGChapters())
        ) {
            mf = this.vod.path_ffmpegchapters;
        }

        let result: RemuxReturn;

        try {
            result = await remuxFile(
                this.capture_filename,
                this.converted_filename,
                false,
                mf
            );
        } catch (err) {
            log(
                LOGLEVEL.ERROR,
                "automator.convertVideo",
                `Failed to convert video: ${(err as Error).message}`,
                err
            );
            return false;
        }

        if (result && result.success) {
            log(
                LOGLEVEL.SUCCESS,
                "automator.convertVideo",
                `Converted video ${this.capture_filename} to ${this.converted_filename}`
            );
        } else {
            log(
                LOGLEVEL.ERROR,
                "automator.convertVideo",
                `Failed to convert video ${this.capture_filename} to ${this.converted_filename}`
            );
        }

        Webhook.dispatchAll("end_convert", {
            vod: await this.vod.toAPI(),
            success: result && result.success,
        } as EndConvertData);

        return result && result.success;
    }

    private async cleanup() {
        // const vods = fs.readdirSync(TwitchHelper.vodFolder(this.getLogin())).filter(f => f.startsWith(`${this.getLogin()}_`) && f.endsWith(".json"));

        if (!this.channel) {
            log(
                LOGLEVEL.ERROR,
                "automator.cleanup",
                `Tried to cleanup ${this.broadcaster_user_login} but channel was not available.`
            );
            return;
        }

        await this.channel.cleanupVods(this.vod?.uuid);
    }
}
