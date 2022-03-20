import axios, { Axios } from "axios";
import chalk from "chalk";
import { spawn } from "child_process";
import { format } from "date-fns";
import fs from "fs";
import path from "path";
import { Stream } from "stream";
import { MediaInfoJSONOutput } from "../../../common/MediaInfo";
import { MediaInfo } from "../../../common/mediainfofield";
import { EventSubTypes } from "../../../common/TwitchAPI/Shared";
import { Subscriptions } from "../../../common/TwitchAPI/Subscriptions";
import { BaseConfigFolder } from "./BaseConfig";
import { TwitchAutomatorJob } from "./TwitchAutomatorJob";
import { TwitchConfig } from "./TwitchConfig";
import { LOGLEVEL, TwitchLog } from "./TwitchLog";

export interface ExecReturn {
    stdout: string[];
    stderr: string[];
    code: number;
}

export interface RemuxReturn {
    stdout: string[];
    stderr: string[];
    code: number;
    success: boolean;
}

export class TwitchHelper {

    static axios: Axios;

    static accessToken = "";

    static readonly accessTokenFile = path.join(BaseConfigFolder.cache, "oauth.bin");

    static readonly accessTokenExpire = 60 * 60 * 24 * 60 * 1000; // 60 days
    static readonly accessTokenRefresh = 60 * 60 * 24 * 30 * 1000; // 30 days

    static readonly PHP_DATE_FORMAT = "yyyy-MM-dd HH:mm:ss.SSSSSS";
    static readonly TWITCH_DATE_FORMAT = "yyyy-MM-dd'T'HH:mm:ss'Z'";
    static readonly TWITCH_DATE_FORMAT_MS = "yyyy-MM-dd'T'HH:mm:ss'.'SSS'Z'";

    /*
    static readonly SUBSTATUS = {
        NONE: "0",
        WAITING: "1",
        SUBSCRIBED: "2",
        FAILED: "3",
    };
    */

    static readonly CHANNEL_SUB_TYPES: EventSubTypes[] = ["stream.online", "stream.offline", "channel.update"];

    static async getAccessToken(force = false): Promise<string> {
        // token should last 60 days, delete it after 30 just to be sure
        if (fs.existsSync(this.accessTokenFile)) {

            if (Date.now() > fs.statSync(this.accessTokenFile).mtimeMs + this.accessTokenRefresh) {
                TwitchLog.logAdvanced(LOGLEVEL.INFO, "helper", `Deleting old access token, too old: ${format(fs.statSync(this.accessTokenFile).mtimeMs, this.PHP_DATE_FORMAT)}`);
                fs.unlinkSync(this.accessTokenFile);
            }

            if (!force) {
                TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "helper", "Fetched access token from cache");
                return fs.readFileSync(this.accessTokenFile, "utf8");
            }

        }

        if (!TwitchConfig.cfg("api_secret") || !TwitchConfig.cfg("api_client_id")) {
            TwitchLog.logAdvanced(LOGLEVEL.ERROR, "helper", "Missing either api secret or client id, aborting fetching of access token!");
            throw new Error("Missing either api secret or client id, aborting fetching of access token!");
        }


        // oauth2
        const oauth_url = "https://id.twitch.tv/oauth2/token";

        /*
        try {
            $response = $client->post($oauth_url, [
                'query' => [
                    'client_id' => TwitchConfig::cfg('api_client_id'),
                    'client_secret' => TwitchConfig::cfg('api_secret'),
                    'grant_type' => 'client_credentials'
                ],
                'headers' => [
                    'Client-ID: ' . TwitchConfig::cfg('api_client_id')
                ]
            ]);
        } catch (\Throwable $th) {
            TwitchLog.logAdvanced(LOGLEVEL.FATAL, "helper", "Tried to get oauth token but server returned: " . $th->getMessage());
            sleep(5);
            return false;
        }
        */

        const response = await axios.post(oauth_url, {
            "client_id": TwitchConfig.cfg("api_client_id"),
            "client_secret": TwitchConfig.cfg("api_secret"),
            "grant_type": "client_credentials",
        }, {
            headers: {
                "Client-ID": TwitchConfig.cfg("api_client_id"),
            },
        });

        if (response.status != 200) {
            TwitchLog.logAdvanced(LOGLEVEL.FATAL, "helper", "Tried to get oauth token but server returned: " + response.statusText);
            throw new Error("Tried to get oauth token but server returned: " + response.statusText);
        }

        const json = response.data;

        if (!json || !json.access_token) {
            TwitchLog.logAdvanced(LOGLEVEL.ERROR, "helper", `Failed to fetch access token: ${json}`);
            throw new Error(`Failed to fetch access token: ${json}`);
        }

        const access_token = json.access_token;

        this.accessToken = access_token;

        fs.writeFileSync(this.accessTokenFile, access_token);

        TwitchLog.logAdvanced(LOGLEVEL.INFO, "helper", "Fetched new access token");

        return access_token;
    }

    public static vodFolder(username = "") {
        return BaseConfigFolder.vod + (TwitchConfig.cfg("channel_folders") && username !== "" ? path.sep + username : "");
    }

    public static JSDateToPHPDate(date: Date) {
        return {
            date: format(date, this.PHP_DATE_FORMAT),
            timezone_type: 3,
            timezone: "UTC",
        };
    }

    /**
     * For some reason, twitch uses "1h1m1s" for durations, not seconds
     * thanks copilot
     * 
     * @param duration 
     */
    public static parseTwitchDuration(duration: string) {
        const regex = /(\d+)([a-z]+)/g;
        let match;
        let seconds = 0;
        while ((match = regex.exec(duration)) !== null) {
            const num = parseInt(match[1]);
            const unit = match[2];
            switch (unit) {
            case "h":
                seconds += num * 3600;
                break;
            case "m":
                seconds += num * 60;
                break;
            case "s":
                seconds += num;
                break;
            }
        }
        return seconds;
    }




    public static getNiceDuration(duration: number) {
        // format 1d 2h 3m 4s

        const days = Math.floor(duration / (60 * 60 * 24));
        const hours = Math.floor((duration - (days * 60 * 60 * 24)) / (60 * 60));
        const minutes = Math.floor((duration - (days * 60 * 60 * 24) - (hours * 60 * 60)) / 60);
        const seconds = duration - (days * 60 * 60 * 24) - (hours * 60 * 60) - (minutes * 60);

        let str = "";

        if (days > 0) str += days + "d ";
        if (hours > 0) str += hours + "h ";
        if (minutes > 0) str += minutes + "m ";
        if (seconds > 0) str += seconds + "s";

        return str.trim();

    }

    public static is_windows() {
        return process.platform === "win32";
    }

    public static path_mediainfo(): string | false {

        if (TwitchConfig.cfg("mediainfo_path")) return TwitchConfig.cfg<string>("mediainfo_path");

        // const path = this.whereis("mediainfo", "mediainfo.exe");
        // if (path) {
        // 	TwitchConfig.setConfig('mediainfo_path', path);
        // 	TwitchConfig.saveConfig("path resolver");
        // 	return path;
        // }

        return false;
    }

    public static path_ffmpeg(): string | false {
        if (TwitchConfig.cfg("ffmpeg_path")) return TwitchConfig.cfg<string>("ffmpeg_path");

        // const path = this.whereis("ffmpeg", "ffmpeg.exe");
        // if (path) {
        // 	TwitchConfig.setConfig('ffmpeg_path', path);
        // 	TwitchConfig.saveConfig("path resolver");
        // 	return path;
        // }

        return false;
    }

    public static path_streamlink(): string | false {
        // $path = TwitchConfig::cfg('bin_dir') . DIRECTORY_SEPARATOR . "streamlink" . (self::is_windows() ? '.exe' : '');
        // return file_exists($path) ? $path : false;
        const full_path = path.join(TwitchConfig.cfg("bin_dir"), `streamlink${this.is_windows() ? ".exe" : ""}`);
        const exists = fs.existsSync(full_path);

        if (!exists) {
            TwitchLog.logAdvanced(LOGLEVEL.ERROR, "helper", `Streamlink binary not found at: ${full_path}`);
            return false;
        }

        return exists ? full_path : false;
    }

    public static path_youtubedl(): string | false {
        // $path = TwitchConfig::cfg('bin_dir') . DIRECTORY_SEPARATOR . "youtube-dl" . (self::is_windows() ? '.exe' : '');
        // return file_exists($path) ? $path : false;
        const full_path = path.join(TwitchConfig.cfg("bin_dir"), `yt-dlp${this.is_windows() ? ".exe" : ""}`);
        const exists = fs.existsSync(full_path);

        if (!exists) {
            TwitchLog.logAdvanced(LOGLEVEL.ERROR, "helper", `yt-dlp binary not found at: ${full_path}`);
            return false;
        }

        return exists ? full_path : false;
    }

    public static path_tcd(): string | false {
        // $path = TwitchConfig::cfg('bin_dir') . DIRECTORY_SEPARATOR . "tcd" . (self::is_windows() ? '.exe' : '');
        // return file_exists($path) ? $path : false;
        const full_path = path.join(TwitchConfig.cfg("bin_dir"), `tcd${this.is_windows() ? ".exe" : ""}`);
        const exists = fs.existsSync(full_path);

        if (!exists) {
            TwitchLog.logAdvanced(LOGLEVEL.ERROR, "helper", `tcd binary not found at: ${full_path}`);
            return false;
        }

        return exists ? full_path : false;
    }

    public static path_pipenv(): string | false {
        // $path = TwitchConfig::cfg('bin_dir') . DIRECTORY_SEPARATOR . "pipenv" . (self::is_windows() ? '.exe' : '');
        // return file_exists($path) ? $path : false;
        const full_path = path.join(TwitchConfig.cfg("bin_dir"), `pipenv${this.is_windows() ? ".exe" : ""}`);
        const exists = fs.existsSync(full_path);

        if (!exists) {
            TwitchLog.logAdvanced(LOGLEVEL.ERROR, "helper", `pipenv binary not found at: ${full_path}`);
            return false;
        }

        return exists ? full_path : false;
    }

    public static path_twitchdownloader(): string | false {
        if (TwitchConfig.cfg("twitchdownloader_path")) return TwitchConfig.cfg<string>("twitchdownloader_path");

        return false;
    }

    public static async eventSubUnsubscribe(subscription_id: string) {

        TwitchLog.logAdvanced(LOGLEVEL.INFO, "helper", "Unsubscribing from eventsub id {$subscription_id}");

        let response;

        try {
            // $response = $this->$guzzler->request("DELETE", "/helix/eventsub/subscriptions?id={$subscription_id}");
            response = await this.axios.delete(`/helix/eventsub/subscriptions?id=${subscription_id}`);
        } catch (th) {
            TwitchLog.logAdvanced(LOGLEVEL.FATAL, "helper", `Unsubscribe from eventsub ${subscription_id} error: ${th}`);
            return false;
        }

        if (response.status > 299) {
            TwitchLog.logAdvanced(LOGLEVEL.FATAL, "helper", `Unsubscribe from eventsub ${subscription_id} error: ${response.statusText}`);
            return false;
        }

        TwitchLog.logAdvanced(LOGLEVEL.SUCCESS, "helper", `Unsubscribed from eventsub ${subscription_id} successfully`);

        return true;

    }

    /**
     * Execute a command and return the output
     * 
     * @param bin 
     * @param args 
     * @throws Exception
     * @returns 
     */
    static execSimple(bin: string, args: string[], what: string): Promise<ExecReturn> {

        return new Promise((resolve, reject) => {

            const process = spawn(bin, args || [], {
                // detached: true,
                windowsHide: true,
            });

            TwitchLog.logAdvanced(LOGLEVEL.INFO, "exec", `Executing ${what}: ${bin} ${args.join(" ")}`);

            const stdout: string[] = [];
            const stderr: string[] = [];

            process.stdout.on("data", (data: Stream) => {
                if (TwitchConfig.cfg("debug")) console.debug(chalk.green(`$ ${bin} ${args.join(" ")}\n`, chalk.green(`> ${data.toString().trim()}`)));
                stdout.push(data.toString());
            });

            process.stderr.on("data", (data: Stream) => {
                if (TwitchConfig.cfg("debug")) console.error(chalk.red(`$ ${bin} ${args.join(" ")}\n`, chalk.red(`> ${data.toString().trim()}`)));
                stderr.push(data.toString());
            });

            process.on("close", (code) => {
                TwitchLog.logAdvanced(LOGLEVEL.INFO, "helper", `Process ${process.pid} for ${what} exited with code ${code}`);

                if (code == 0) {
                    resolve({ code, stdout, stderr });
                } else {
                    reject({ code, stdout, stderr });
                }
            });

            process.on("error", (err) => {
                TwitchLog.logAdvanced(LOGLEVEL.ERROR, "helper", `Process ${process.pid} for ${what} error: ${err}`);
                reject({ code: -1, stdout, stderr });
            });

        });

    }


    /**
     * Execute a command, make a job, and when it's done, return the output
     * 
     * @param bin 
     * @param args 
     * @param jobName 
     * @returns 
     */
    static execAdvanced(bin: string, args: string[], jobName: string): Promise<ExecReturn> {
        return new Promise((resolve, reject) => {

            const process = spawn(bin, args || [], {
                // detached: true,
                windowsHide: true,
            });

            TwitchLog.logAdvanced(LOGLEVEL.INFO, jobName, `Executing ${bin} ${args.join(" ")}`);

            let job: TwitchAutomatorJob;

            if (process.pid) {
                TwitchLog.logAdvanced(LOGLEVEL.SUCCESS, "helper", `Spawned process ${process.pid} for ${jobName}`);
                job = TwitchAutomatorJob.create(jobName);
                job.setPid(process.pid);
                job.setProcess(process);
                job.startLog(jobName, `$ ${bin} ${args.join(" ")}\n`);
                if (!job.save()) {
                    TwitchLog.logAdvanced(LOGLEVEL.ERROR, "helper", `Failed to save job ${jobName}`);
                }
            } else {
                TwitchLog.logAdvanced(LOGLEVEL.ERROR, "helper", `Failed to spawn process for ${jobName}`);
                // reject(new Error(`Failed to spawn process for ${jobName}`));
            }

            const stdout: string[] = [];
            const stderr: string[] = [];

            process.stdout.on("data", (data: Stream) => {
                stdout.push(data.toString());
            });

            process.stderr.on("data", (data: Stream) => {
                stderr.push(data.toString());
            });

            process.on("close", (code) => {
                TwitchLog.logAdvanced(LOGLEVEL.INFO, "helper", `Process ${process.pid} for ${jobName} exited with code ${code}`);
                if (job) {
                    job.clear();
                }
                // const out_log = ffmpeg.stdout.read();
                // const success = fs.existsSync(output) && fs.statSync(output).size > 0;
                if (code == 0) {
                    resolve({ code, stdout, stderr });
                } else {
                    reject({ code, stdout, stderr });
                }
            });

            process.on("error", (err) => {
                TwitchLog.logAdvanced(LOGLEVEL.ERROR, "helper", `Process ${process.pid} error: ${err}`);
                reject({ code: -1, stdout, stderr });
            });

            TwitchLog.logAdvanced(LOGLEVEL.INFO, "helper", `Attached to all streams for process ${process.pid} for ${jobName}`);

        });
    }

    static startJob(bin: string, args: string[], jobName: string): TwitchAutomatorJob | false {

        const process = spawn(bin, args || [], {
            // detached: true,
            windowsHide: true,
        });

        TwitchLog.logAdvanced(LOGLEVEL.INFO, jobName, `Executing ${bin} ${args.join(" ")}`);

        let job: TwitchAutomatorJob | false = false;

        if (process.pid) {
            TwitchLog.logAdvanced(LOGLEVEL.SUCCESS, "helper", `Spawned process ${process.pid} for ${jobName}`);
            job = TwitchAutomatorJob.create(jobName);
            job.setPid(process.pid);
            job.setProcess(process);
            job.startLog(jobName, `$ ${bin} ${args.join(" ")}\n`);
            if (!job.save()) {
                TwitchLog.logAdvanced(LOGLEVEL.ERROR, "helper", `Failed to save job ${jobName}`);
            }
        } else {
            TwitchLog.logAdvanced(LOGLEVEL.ERROR, "helper", `Failed to spawn process for ${jobName}`);
            // reject(new Error(`Failed to spawn process for ${jobName}`));
        }

        const stdout: string[] = [];
        const stderr: string[] = [];

        process.stdout.on("data", (data: Stream) => {
            stdout.push(data.toString());
        });

        process.stderr.on("data", (data: Stream) => {
            stderr.push(data.toString());
        });

        process.on("close", (code) => {
            TwitchLog.logAdvanced(LOGLEVEL.INFO, "helper", `Process ${process.pid} for ${jobName} exited with code ${code}`);

            if (typeof job !== "boolean") {
                job.onClose(code);
                job.clear(); // ?
            }

            // const out_log = ffmpeg.stdout.read();
            // const success = fs.existsSync(output) && fs.statSync(output).size > 0;
            /*
            if (code == 0) {
                resolve({ code, stdout, stderr });
            } else {
                reject({ code, stdout, stderr });
            }
            */
        });

        process.on("error", (err) => {
            TwitchLog.logAdvanced(LOGLEVEL.ERROR, "helper", `Process ${process.pid} on job ${jobName} error: ${err}`);
        });

        TwitchLog.logAdvanced(LOGLEVEL.INFO, "helper", `Attached to all streams for process ${process.pid} for ${jobName}`);

        return job;

    }

    static remuxFile(input: string, output: string, overwrite = false): Promise<RemuxReturn> {
        const ffmpeg_path = this.path_ffmpeg();
        if (!ffmpeg_path) {
            throw new Error("Failed to find ffmpeg");
        }
        return new Promise((resolve, reject) => {

            const opts = [
                "-i", input,
                "-c", "copy",
                "-bsf:a", "aac_adtstoasc",
                // ...ffmpeg_options,
                output,
            ];

            if (overwrite) {
                opts.push("-y");
            }

            if (TwitchConfig.cfg("debug") || TwitchConfig.cfg("app_verbose")) {
                opts.push("-loglevel", "repeat+level+verbose");
            }

            const ffmpeg = spawn(ffmpeg_path, opts);

            let job: TwitchAutomatorJob;

            if (ffmpeg.pid) {
                job = TwitchAutomatorJob.create(`remux_${path.basename(input)}`);
                job.setPid(ffmpeg.pid);
                job.setProcess(ffmpeg);
                job.startLog(`remux_${path.basename(input)}`, `$ ffmpeg ${opts.join(" ")}\n`);
                job.save();
            }

            const stdout: string[] = [];
            const stderr: string[] = [];

            process.stdout.on("data", (data: Stream) => {
                stdout.push(data.toString());
            });
            
            process.stderr.on("data", (data: Stream) => {
                stderr.push(data.toString());
            });

            process.on("error", (err) => {
                TwitchLog.logAdvanced(LOGLEVEL.ERROR, "helper", `Process ${process.pid} error: ${err}`);
                reject({ code: -1, success: false, stdout, stderr });
            });

            ffmpeg.on("close", (code) => {
                if (job) {
                    job.clear();
                }
                // const out_log = ffmpeg.stdout.read();
                const success = fs.existsSync(output) && fs.statSync(output).size > 0;
                if (code == 0) {
                    resolve({ code, success, stdout, stderr });
                } else {
                    reject({ code, success, stdout, stderr });
                }
            });
        });
    }

    // https://stackoverflow.com/a/2510459
    static formatBytes(bytes: number, precision = 2): string {

        const units = ["B", "KB", "MB", "GB", "TB"];

        bytes = Math.max(bytes, 0);
        let pow = Math.floor((bytes ? Math.log(bytes) : 0) / Math.log(1024));
        pow = Math.min(pow, units.length - 1);

        // Uncomment one of the following alternatives
        bytes /= Math.pow(1024, pow);
        // $bytes /= (1 << (10 * $pow)); 

        // return round($bytes, $precision) . ' ' . $units[$pow];
        return `${bytes.toFixed(precision)} ${units[pow]}`;
    }

    /**
     * Return mediainfo for a file
     * 
     * @param filename 
     * @throws
     * @returns 
     */
    public static async mediainfo(filename: string): Promise<MediaInfo | false> {

        TwitchLog.logAdvanced(LOGLEVEL.INFO, "mediainfo", `Run mediainfo on ${filename}`);

        if (!filename) {
            throw new Error("No filename supplied for mediainfo");
        }

        if (!fs.existsSync(filename)) {
            throw new Error("File not found for mediainfo");
        }

        if (fs.statSync(filename).size == 0) {
            throw new Error("Filesize is 0 for mediainfo");
        }

        // $output = shell_exec( TwitchHelper::path_mediainfo() . ' --Full --Output=JSON ' . escapeshellarg($filename) );
        // $process = new Process( [TwitchHelper::path_mediainfo(), '--Full', '--Output=JSON', $filename] );
        // $process->run();

        const mediainfo_path = TwitchHelper.path_mediainfo();
        if (!mediainfo_path) throw new Error("Failed to find mediainfo");

        const output = await TwitchHelper.execSimple(mediainfo_path, ["--Full", "--Output=JSON", filename], "mediainfo");

        if (output && output.stdout) {

            const json: MediaInfoJSONOutput = JSON.parse(output.stdout.join("\n"));

            const data: any = {};

            for (const track of json.media.track) {
                if (track["@type"] == "General") {
                    data.general = track;
                } else if (track["@type"] == "Video") {
                    data.video = track;
                } else if (track["@type"] == "Audio") {
                    data.audio = track;
                }
            }

            return data as MediaInfo;

        } else {
            TwitchLog.logAdvanced(LOGLEVEL.ERROR, "mediainfo", `No output from mediainfo for ${filename}`);
            return false;
        }
    }

    public static async getSubs(): Promise<Subscriptions | false> {

        TwitchLog.logAdvanced(LOGLEVEL.INFO, "helper", "Requesting subscriptions list");

        let response;

        try {
            response = await this.axios.get("/helix/eventsub/subscriptions");
        } catch (err) {
            TwitchLog.logAdvanced(LOGLEVEL.FATAL, "helper", `Subs return: ${err}`);
            return false;
        }

        const json: Subscriptions = response.data;

        TwitchLog.logAdvanced(LOGLEVEL.INFO, "helper", `${json.total} subscriptions`);

        return json;

    }

}