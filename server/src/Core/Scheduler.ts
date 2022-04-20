import cron from "cron";
import * as CronController from "../Controllers/Cron";
import { TwitchConfig } from "./TwitchConfig";

export class Scheduler {

    public static jobs: cron.CronJob[] = [];

    public static schedule(cronTime: string, callback: () => void): cron.CronJob {
        const job = new cron.CronJob(cronTime, callback);
        Scheduler.jobs.push(job);
        job.start();
        return job;
    }

    public static defaultJobs() {
        // # 0 5 * * 1 curl http://localhost:8080/api/v0/cron/sub
        // 0 */12 * * * curl http://localhost:8080/api/v0/cron/check_muted_vods
        // 10 */12 * * * curl http://localhost:8080/api/v0/cron/check_deleted_vods

        this.schedule("0 */12 * * *", () => {
            if (!TwitchConfig.cfg<boolean>("schedule_muted_vods")) return;
            CronController.fCheckMutedVods();
        });

        this.schedule("10 */12 * * *", () => {
            if (!TwitchConfig.cfg<boolean>("schedule_deleted_vods")) return;
            CronController.fCheckDeletedVods();
        });

        // this.schedule("* * * * *", () => {
        //     console.log("Cronjob ran", new Date().toISOString());
        // });

    }

}