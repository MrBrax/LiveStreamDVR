import { debugLog } from "@/Helpers/Console";
import { Sleep } from "@/Helpers/Sleep";
import { TwitchHelper } from "@/Providers/Twitch";
import { formatString } from "@common/Format";
import type { ClipBasenameTemplate } from "@common/Replacements";
import cron from "cron";
import { format, parseJSON } from "date-fns";
import fs from "node:fs";
import path from "node:path";
import sanitize from "sanitize-filename";
import * as CronController from "../Controllers/Cron";
import { BaseConfigCacheFolder, BaseConfigDataFolder } from "./BaseConfig";
import { Config } from "./Config";
import { LiveStreamDVR } from "./LiveStreamDVR";
import { LOGLEVEL, log } from "./Log";
import { TwitchChannel } from "./Providers/Twitch/TwitchChannel";
import { TwitchVOD } from "./Providers/Twitch/TwitchVOD";

export class Scheduler {
    public static jobs: Record<string, cron.CronJob> = {};

    public static schedule(
        name: string,
        cronTime: string | (() => string),
        callback: () => void
    ): cron.CronJob {
        if (this.hasJob(name)) {
            this.removeJob(name);
        }
        const job = new cron.CronJob(
            typeof cronTime === "string" ? cronTime : cronTime(),
            callback,
            undefined,
            false
        );
        this.jobs[name] = job;
        job.start();
        log(
            LOGLEVEL.INFO,
            "scheduler.schedule",
            `Scheduled job '${name}' with cronTime '${cronTime}'`
        );
        return job;
    }

    /**
     * @test disable
     */
    public static defaultJobs() {
        // # 0 5 * * 1 curl http://localhost:8080/api/v0/cron/sub
        // 0 */12 * * * curl http://localhost:8080/api/v0/cron/check_muted_vods
        // 10 */12 * * * curl http://localhost:8080/api/v0/cron/check_deleted_vods

        // no blocks in testing
        // if (process.env.NODE_ENV === "test") return;

        log(LOGLEVEL.INFO, "scheduler.defaultJobs", "Set up default jobs");

        this.schedule("check_muted_vods", "0 */12 * * *", () => {
            if (!Config.getInstance().cfg<boolean>("schedule_muted_vods")) {
                log(
                    LOGLEVEL.INFO,
                    "scheduler.defaultJobs",
                    "Scheduler: check_muted_vods - disabled"
                );
                return;
            }
            void CronController.fCheckMutedVods();
        });

        this.schedule("check_deleted_vods", "10 */12 * * *", () => {
            if (!Config.getInstance().cfg<boolean>("schedule_deleted_vods")) {
                log(
                    LOGLEVEL.INFO,
                    "scheduler.defaultJobs",
                    "Scheduler: check_deleted_vods - disabled"
                );
                return;
            }
            void CronController.fCheckDeletedVods();
        });

        this.schedule("match_vods", "30 */12 * * *", () => {
            if (!Config.getInstance().cfg<boolean>("schedule_match_vods")) {
                log(
                    LOGLEVEL.INFO,
                    "scheduler.defaultJobs",
                    "Scheduler: match_vods - disabled"
                );
                return;
            }
            void CronController.fMatchVods();
        });

        // once a day
        this.schedule("clipdownload", "0 0 * * *", this.scheduleClipDownload);

        // this.schedule("* * * * *", () => {
        //     console.log("Cronjob ran", new Date().toISOString());
        // });

        // validate oauth token every hour
        this.schedule("validate_oauth", "0 */1 * * *", () => {
            // if (Config.getInstance().cfg("twitchapi.auth_type") == "app") return;
            if (
                TwitchHelper.accessToken &&
                TwitchHelper.accessTokenType !== "user"
            ) {
                return;
            }
            void TwitchHelper.validateOAuth();
        });

        // refresh oauth token every 29 days
        // this.schedule("refresh_oauth", "0 0 */29 * *", () => {
        //     // if (Config.getInstance().cfg("twitchapi.auth_type") == "app") return;
        //     if (TwitchHelper.accessToken && TwitchHelper.accessTokenType !== "user") {
        //         return;
        //     }
        //     TwitchHelper.refreshUserAccessToken();
        // });

        // export vods at 01:00 pacific time relative to the server
        // TODO actually use the timezone, most people will probably not be in pacific time
        this.schedule("export_vods", "0 1 * * *", () => {
            if (!Config.getInstance().cfg<boolean>("schedule.export_vods")) {
                log(
                    LOGLEVEL.INFO,
                    "scheduler.defaultJobs",
                    "Scheduler: export_vods - disabled"
                );
                return;
            }
            void Scheduler.scheduleAllChannelVodExport();
        });

        log(
            LOGLEVEL.INFO,
            "scheduler.defaultJobs",
            `Default job 'check_muted_vods' ${
                Config.getInstance().cfg<boolean>("schedule_muted_vods")
                    ? "enabled"
                    : "disabled"
            }`
        );
        log(
            LOGLEVEL.INFO,
            "scheduler.defaultJobs",
            `Default job 'check_deleted_vods' ${
                Config.getInstance().cfg<boolean>("schedule_deleted_vods")
                    ? "enabled"
                    : "disabled"
            }`
        );
        log(
            LOGLEVEL.INFO,
            "scheduler.defaultJobs",
            `Default job 'match_vods' ${
                Config.getInstance().cfg<boolean>("schedule_match_vods")
                    ? "enabled"
                    : "disabled"
            }`
        );
        log(
            LOGLEVEL.INFO,
            "scheduler.defaultJobs",
            `Default job 'clipdownload' ${
                Config.getInstance().cfg<boolean>(
                    "scheduler.clipdownload.enabled"
                )
                    ? "enabled"
                    : "disabled"
            }`
        );
        log(
            LOGLEVEL.INFO,
            "scheduler.defaultJobs",
            `Default job 'export_vods' ${
                Config.getInstance().cfg<boolean>("schedule.export_vods")
                    ? "enabled"
                    : "disabled"
            }`
        );
    }

    public static hasJob(name: string) {
        return this.jobs[name] !== undefined;
    }

    public static removeJob(name: string) {
        if (this.hasJob(name)) {
            debugLog(`Scheduler: remove job '${name}'`);
            this.jobs[name].stop();
            delete this.jobs[name];
        }
    }

    public static removeAllJobs() {
        for (const job in this.jobs) {
            this.removeJob(job);
        }
    }

    public static restartScheduler() {
        this.removeAllJobs();
        this.defaultJobs();
    }

    public static runJob(name: string) {
        if (this.hasJob(name)) {
            this.jobs[name].fireOnTick();
            // this.jobs[name].start();
        } else {
            throw new Error(`Scheduler: Job '${name}' not found`);
        }
    }

    public static async scheduleClipDownload() {
        debugLog("Scheduler: scheduleClipDownload");

        if (
            !Config.getInstance().cfg<boolean>("scheduler.clipdownload.enabled")
        ) {
            log(
                LOGLEVEL.INFO,
                "Scheduler.scheduleClipDownload",
                "Scheduler: scheduleClipDownload - disabled"
            );
            return;
        }

        log(
            LOGLEVEL.INFO,
            "Scheduler.scheduleClipDownload",
            "Scheduler: scheduleClipDownload - start"
        );

        const amount = Config.getInstance().cfg<number>(
            "scheduler.clipdownload.amount"
        );
        const age = Config.getInstance().cfg<number>(
            "scheduler.clipdownload.age"
        );
        const logins = Config.getInstance()
            .cfg<string>("scheduler.clipdownload.channels")
            .split(",")
            .map((s) => s.trim());

        const clipsDatabase = path.join(
            BaseConfigCacheFolder.cache,
            "downloaded_clips.json"
        );
        const downloadedClips: string[] = fs.existsSync(clipsDatabase)
            ? (JSON.parse(fs.readFileSync(clipsDatabase, "utf-8")) as string[])
            : [];

        for (const login of logins) {
            const channel = TwitchChannel.getChannelByLogin(login);
            const clips = await channel?.getClips(age, amount);
            let skipped = 0;
            if (clips) {
                for (
                    let i = 0;
                    i < Math.min(amount, clips.length) + skipped;
                    i++
                ) {
                    if (!clips[i]) continue;
                    const clip = clips[i];

                    if (downloadedClips.includes(clip.id)) {
                        log(
                            LOGLEVEL.INFO,
                            "Scheduler.scheduleClipDownload",
                            `Scheduler: scheduleClipDownload - clip ${clip.id} already downloaded`
                        );
                        skipped++;
                        continue;
                    }

                    const basefolder = path.join(
                        BaseConfigDataFolder.saved_clips,
                        "scheduler",
                        login
                    );
                    if (!fs.existsSync(basefolder)) {
                        fs.mkdirSync(basefolder, { recursive: true });
                    }

                    const clipDate = parseJSON(clip.created_at);

                    const variables: ClipBasenameTemplate = {
                        id: clip.id,
                        quality: "best", // TODO: get quality somehow
                        clip_date: format(
                            clipDate,
                            Config.getInstance().dateFormat
                        ),
                        title: clip.title,
                        creator: clip.creator_name,
                        broadcaster: clip.broadcaster_name,
                    };

                    const basename = sanitize(
                        formatString(
                            Config.getInstance().cfg(
                                "filename_clip",
                                "{broadcaster} - {title} [{id}] [{quality}]"
                            ),
                            variables
                        )
                    );

                    const outPath = path.join(basefolder, basename);

                    if (fs.existsSync(`${outPath}.mp4`)) {
                        log(
                            LOGLEVEL.WARNING,
                            "scheduler.scheduleClipDownload",
                            `Clip ${clip.id} already exists`
                        );
                        downloadedClips.push(clip.id); // already passed the first check
                        skipped++;
                        continue;
                    }

                    try {
                        await TwitchVOD.downloadClip(
                            clip.id,
                            `${outPath}.mp4`,
                            "best"
                        );
                    } catch (error) {
                        log(
                            LOGLEVEL.ERROR,
                            "scheduler.scheduleClipDownload",
                            `Failed to download clip ${clip.id}: ${
                                (error as Error).message
                            }`
                        );
                        return;
                    }

                    try {
                        await TwitchVOD.downloadChatTD(
                            clip.id,
                            `${outPath}.chat.json`
                        );
                    } catch (error) {
                        log(
                            LOGLEVEL.ERROR,
                            "scheduler.scheduleClipDownload",
                            `Failed to download chat for clip ${clip.id}: ${
                                (error as Error).message
                            }`
                        );
                        return;
                    }

                    fs.writeFileSync(
                        `${outPath}.info.json`,
                        JSON.stringify(clip, null, 4)
                    );

                    log(
                        LOGLEVEL.INFO,
                        "scheduler.scheduleClipDownload",
                        `Downloaded clip ${clip.id}`
                    );

                    downloadedClips.push(clip.id);

                    await Sleep(5000); // hehe
                }

                await channel?.findClips();
            }
        }

        fs.writeFileSync(
            clipsDatabase,
            JSON.stringify(downloadedClips, null, 4)
        );

        log(
            LOGLEVEL.INFO,
            "Scheduler.scheduleClipDownload",
            "Scheduler: scheduleClipDownload - end"
        );
    }

    public static async scheduleAllChannelVodExport() {
        log(
            LOGLEVEL.INFO,
            "Scheduler.scheduleAllChannelVodExport",
            "Scheduler: scheduleAllChannelVodExport - start"
        );

        for (const channel of LiveStreamDVR.getInstance().getChannels()) {
            const [completedVods, failedVods] = await channel.exportAllVods();
            log(
                LOGLEVEL.INFO,
                "Scheduler.scheduleAllChannelVodExport",
                `Scheduler: scheduleAllChannelVodExport - ${channel.displayName} - completed: ${completedVods} - failed: ${failedVods}`
            );
        }

        log(
            LOGLEVEL.INFO,
            "Scheduler.scheduleAllChannelVodExport",
            "Scheduler: scheduleAllChannelVodExport - end"
        );
    }
}
