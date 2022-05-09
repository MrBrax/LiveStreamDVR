import axios, { Axios } from "axios";
import chalk from "chalk";
import { spawn } from "child_process";
import { format } from "date-fns";
import fs from "fs";
import path from "path";
import { Stream } from "stream";
import { MediaInfoJSONOutput } from "../../../common/MediaInfo";
import { MediaInfo } from "../../../common/mediainfofield";
import { FFProbe } from "../../../common/FFProbe";
import { EventSubTypes } from "../../../common/TwitchAPI/Shared";
import { Subscriptions } from "../../../common/TwitchAPI/Subscriptions";
import { BaseConfigDataFolder } from "./BaseConfig";
import { Job } from "./Job";
import { Config } from "./Config";
import { LOGLEVEL, Log } from "./Log";
import { TwitchCommentDump } from "../../../common/Comments";
import { replaceAll } from "../Helpers/ReplaceAll";
import { TwitchChannel } from "./TwitchChannel";

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

export class Helper {

    static axios: Axios | undefined;

    static accessToken = "";

    static readonly accessTokenFile = path.join(BaseConfigDataFolder.cache, "oauth.bin");

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
                Log.logAdvanced(LOGLEVEL.INFO, "helper", `Deleting old access token, too old: ${format(fs.statSync(this.accessTokenFile).mtimeMs, this.PHP_DATE_FORMAT)}`);
                fs.unlinkSync(this.accessTokenFile);
            } else if (!force) {
                Log.logAdvanced(LOGLEVEL.DEBUG, "helper", "Fetched access token from cache");
                return fs.readFileSync(this.accessTokenFile, "utf8");
            }

        }

        if (!Config.getInstance().cfg("api_secret") || !Config.getInstance().cfg("api_client_id")) {
            Log.logAdvanced(LOGLEVEL.ERROR, "helper", "Missing either api secret or client id, aborting fetching of access token!");
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
            "client_id": Config.getInstance().cfg("api_client_id"),
            "client_secret": Config.getInstance().cfg("api_secret"),
            "grant_type": "client_credentials",
        }, {
            headers: {
                "Client-ID": Config.getInstance().cfg("api_client_id"),
            },
        });

        if (response.status != 200) {
            Log.logAdvanced(LOGLEVEL.FATAL, "helper", "Tried to get oauth token but server returned: " + response.statusText);
            throw new Error("Tried to get oauth token but server returned: " + response.statusText);
        }

        const json = response.data;

        if (!json || !json.access_token) {
            Log.logAdvanced(LOGLEVEL.ERROR, "helper", `Failed to fetch access token: ${json}`);
            throw new Error(`Failed to fetch access token: ${json}`);
        }

        const access_token = json.access_token;

        this.accessToken = access_token;

        fs.writeFileSync(this.accessTokenFile, access_token);

        Log.logAdvanced(LOGLEVEL.INFO, "helper", "Fetched new access token");

        return access_token;
    }

    public static vodFolder(username = "") {
        return BaseConfigDataFolder.vod + (Config.getInstance().cfg("channel_folders") && username !== "" ? path.sep + username : "");
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

    public static twitchDuration(seconds: number): string {
        return replaceAll(this.getNiceDuration(seconds), " ", "").trim();
        // return trim(str_replace(" ", "", self::getNiceDuration($seconds)));
    }

    /**
     * Format in HH:MM:SS
     * @param duration_seconds 
     */
    public static formatDuration(duration_seconds: number) {
        const hours = Math.floor(duration_seconds / (60 * 60));
        const minutes = Math.floor((duration_seconds - (hours * 60 * 60)) / 60);
        const seconds = Math.floor(duration_seconds - (hours * 60 * 60) - (minutes * 60));
        return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }

    public static formatSubtitleDuration(duration_seconds: number) {
        const hours = Math.floor(duration_seconds / (60 * 60));
        const minutes = Math.floor((duration_seconds - (hours * 60 * 60)) / 60);
        const seconds = Math.floor(duration_seconds - (hours * 60 * 60) - (minutes * 60));
        const milliseconds = Math.floor((duration_seconds - (hours * 60 * 60) - (minutes * 60) - seconds) * 1000);
        return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`;
    }

    public static is_windows() {
        return process.platform === "win32";
    }

    public static is_docker() {
        return process.env.TCD_DOCKER !== undefined;
    }

    public static path_node(): string | false {
        if (Config.getInstance().cfg("node_path")) return Config.getInstance().cfg<string>("node_path");

        if (this.is_windows()) {
            return "C:\\Program Files\\nodejs\\node.exe";
        } else {
            return "/usr/local/bin/node";
        }
    }

    public static path_mediainfo(): string | false {

        if (Config.getInstance().cfg("mediainfo_path")) return Config.getInstance().cfg<string>("mediainfo_path");

        // const path = this.whereis("mediainfo", "mediainfo.exe");
        // if (path) {
        // 	TwitchConfig.setConfig('mediainfo_path', path);
        // 	TwitchConfig.saveConfig("path resolver");
        // 	return path;
        // }

        return false;
    }

    public static path_ffmpeg(): string | false {
        if (Config.getInstance().cfg("ffmpeg_path")) return Config.getInstance().cfg<string>("ffmpeg_path");

        // const path = this.whereis("ffmpeg", "ffmpeg.exe");
        // if (path) {
        // 	TwitchConfig.setConfig('ffmpeg_path', path);
        // 	TwitchConfig.saveConfig("path resolver");
        // 	return path;
        // }

        return false;
    }

    // very bad
    public static path_ffprobe(): string | false {
        const f = this.path_ffmpeg();
        if (!f) return false;
        return f.replace("ffmpeg.exe", "ffprobe.exe");
    }

    public static path_streamlink(): string | false {
        if (!Config.getInstance().cfg("bin_dir")) return false;
        const full_path = path.join(Config.getInstance().cfg("bin_dir"), `streamlink${this.is_windows() ? ".exe" : ""}`);
        const exists = fs.existsSync(full_path);

        if (!exists) {
            Log.logAdvanced(LOGLEVEL.ERROR, "helper", `Streamlink binary not found at: ${full_path}`);
            return false;
        }

        return exists ? full_path : false;
    }

    public static path_youtubedl(): string | false {
        if (!Config.getInstance().cfg("bin_dir")) return false;
        const full_path = path.join(Config.getInstance().cfg("bin_dir"), `yt-dlp${this.is_windows() ? ".exe" : ""}`);
        const exists = fs.existsSync(full_path);

        if (!exists) {
            Log.logAdvanced(LOGLEVEL.ERROR, "helper", `yt-dlp binary not found at: ${full_path}`);
            return false;
        }

        return exists ? full_path : false;
    }

    public static path_tcd(): string | false {
        if (!Config.getInstance().cfg("bin_dir")) return false;
        const full_path = path.join(Config.getInstance().cfg("bin_dir"), `tcd${this.is_windows() ? ".exe" : ""}`);
        const exists = fs.existsSync(full_path);

        if (!exists) {
            Log.logAdvanced(LOGLEVEL.ERROR, "helper", `tcd binary not found at: ${full_path}`);
            return false;
        }

        return exists ? full_path : false;
    }

    public static path_pipenv(): string | false {
        if (!Config.getInstance().cfg("bin_dir")) return false;
        const full_path = path.join(Config.getInstance().cfg("bin_dir"), `pipenv${this.is_windows() ? ".exe" : ""}`);
        const exists = fs.existsSync(full_path);

        if (!exists) {
            Log.logAdvanced(LOGLEVEL.ERROR, "helper", `pipenv binary not found at: ${full_path}`);
            return false;
        }

        return exists ? full_path : false;
    }

    public static path_twitchdownloader(): string | false {
        if (Config.getInstance().cfg("twitchdownloader_path")) return Config.getInstance().cfg<string>("twitchdownloader_path");
        return false;
    }

    public static async eventSubUnsubscribe(subscription_id: string) {

        Log.logAdvanced(LOGLEVEL.INFO, "helper", `Unsubscribing from eventsub id ${subscription_id}`);

        if (!this.axios) {
            throw new Error("Axios is not initialized");
        }

        let response;

        try {
            // $response = $this->$guzzler->request("DELETE", "/helix/eventsub/subscriptions?id={$subscription_id}");
            response = await this.axios.delete(`/helix/eventsub/subscriptions?id=${subscription_id}`);
        } catch (th) {
            Log.logAdvanced(LOGLEVEL.FATAL, "helper", `Unsubscribe from eventsub ${subscription_id} error: ${th}`);
            return false;
        }

        if (response.status > 299) {
            Log.logAdvanced(LOGLEVEL.FATAL, "helper", `Unsubscribe from eventsub ${subscription_id} error: ${response.statusText}`);
            return false;
        }

        Log.logAdvanced(LOGLEVEL.SUCCESS, "helper", `Unsubscribed from eventsub ${subscription_id} successfully`);

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

            const pid = process.pid;

            Log.logAdvanced(LOGLEVEL.EXEC, "helper.execSimple", `Executing '${what}': $ ${bin} ${args.join(" ")}`);

            const stdout: string[] = [];
            const stderr: string[] = [];

            process.stdout.on("data", (data: Stream) => {
                if (Config.debug) console.debug(chalk.bold.green(`$ ${bin} ${args.join(" ")}\n`, chalk.green(`${data.toString().trim()}`)));
                stdout.push(data.toString());
            });

            process.stderr.on("data", (data: Stream) => {
                if (Config.debug) console.error(chalk.bold.red(`$ ${bin} ${args.join(" ")}\n`, chalk.red(`> ${data.toString().trim()}`)));
                stderr.push(data.toString());
            });

            process.on("close", (code) => {
                Log.logAdvanced(LOGLEVEL.INFO, "helper.execSimple", `Process ${pid} for '${what}' exited with code ${code}`);

                if (code == 0) {
                    resolve({ code, stdout, stderr });
                } else {
                    reject({ code, stdout, stderr });
                }
            });

            process.on("error", (err) => {
                Log.logAdvanced(LOGLEVEL.ERROR, "helper.execSimple", `Process ${pid} for '${what}' error: ${err}`);
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

            Log.logAdvanced(LOGLEVEL.EXEC, "helper.execAdvanced", `Executing job '${jobName}': $ ${bin} ${args.join(" ")}`);

            let job: Job;

            if (process.pid) {
                Log.logAdvanced(LOGLEVEL.SUCCESS, "helper.execAdvanced", `Spawned process ${process.pid} for ${jobName}`);
                job = Job.create(jobName);
                job.setPid(process.pid);
                job.setExec(bin, args);
                job.setProcess(process);
                job.startLog(jobName, `$ ${bin} ${args.join(" ")}\n`);
                if (!job.save()) {
                    Log.logAdvanced(LOGLEVEL.ERROR, "helper.execAdvanced", `Failed to save job ${jobName}`);
                }
            } else {
                Log.logAdvanced(LOGLEVEL.ERROR, "helper.execAdvanced", `Failed to spawn process for ${jobName}`);
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
                Log.logAdvanced(LOGLEVEL.INFO, "helper.execAdvanced", `Process ${process.pid} for ${jobName} exited with code ${code}`);
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
                Log.logAdvanced(LOGLEVEL.ERROR, "helper.execAdvanced", `Process ${process.pid} error: ${err}`);
                reject({ code: -1, stdout, stderr });
            });

            Log.logAdvanced(LOGLEVEL.INFO, "helper.execAdvanced", `Attached to all streams for process ${process.pid} for ${jobName}`);

        });
    }

    static startJob(jobName: string, bin: string, args: string[], env: Record<string, string> = {}): Job | false {

        const process = spawn(bin, args || [], {
            // detached: true,
            windowsHide: true,
            env: env ?? undefined,
        });

        Log.logAdvanced(LOGLEVEL.INFO, "helper", `Executing ${bin} ${args.join(" ")}`);

        let job: Job | false = false;

        if (process.pid) {
            Log.logAdvanced(LOGLEVEL.SUCCESS, "helper", `Spawned process ${process.pid} for ${jobName}`);
            job = Job.create(jobName);
            job.setPid(process.pid);
            job.setExec(bin, args);
            job.setProcess(process);
            job.addMetadata({
                bin: bin,
                args: args,
                env: env,
            });
            job.startLog(jobName, `$ ${bin} ${args.join(" ")}\n`);
            if (!job.save()) {
                Log.logAdvanced(LOGLEVEL.ERROR, "helper", `Failed to save job ${jobName}`);
            }
        } else {
            Log.logAdvanced(LOGLEVEL.ERROR, "helper", `Failed to spawn process for ${jobName}`);
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
            Log.logAdvanced(LOGLEVEL.INFO, "helper", `Process ${process.pid} for ${jobName} exited with code ${code}`);

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
            Log.logAdvanced(LOGLEVEL.ERROR, "helper", `Process '${process.pid}' on job '${jobName}' error: ${err}`, {
                bin,
                args,
                jobName,
                stdout,
                stderr,
            });
        });

        Log.logAdvanced(LOGLEVEL.INFO, "helper", `Attached to all streams for process ${process.pid} for ${jobName}`);

        return job;

    }

    /**
     * Remux input to output
     * 
     * @param input 
     * @param output 
     * @param overwrite 
     * @returns 
     */
    static remuxFile(input: string, output: string, overwrite = false, metadata_file?: string): Promise<RemuxReturn> {

        return new Promise((resolve, reject) => {

            const ffmpeg_path = this.path_ffmpeg();

            if (!ffmpeg_path) {
                reject(new Error("Failed to find ffmpeg"));
                return;
            }

            const emptyFile = fs.existsSync(output) && fs.statSync(output).size == 0;

            if (!overwrite && fs.existsSync(output) && !emptyFile) {
                Log.logAdvanced(LOGLEVEL.ERROR, "helper", `Output file ${output} already exists`);
                reject(new Error(`Output file ${output} already exists`));
            }

            if (emptyFile) {
                fs.unlinkSync(output);
            }

            // ffmpeg seems to make ts cfr into vfr, don't know why

            const opts: string[] = [];
            // "-r", parseInt(info.video.FrameRate).toString(),
            // "-vsync", "cfr",
            opts.push("-i", input);

            // write metadata to file
            if (metadata_file) {
                if (fs.existsSync(metadata_file)) {
                    opts.push("-i", metadata_file);
                    opts.push("-map_metadata", "1");
                } else {
                    Log.logAdvanced(LOGLEVEL.ERROR, "helper", `Metadata file ${metadata_file} does not exist for remuxing ${input}`);
                }
            }

            // "-map", "0",
            // "-analyzeduration", 

            opts.push("-c", "copy"); // copy all streams

            if (!output.endsWith(Config.AudioContainer)) {
                opts.push("-bsf:a", "aac_adtstoasc"); // audio bitstream filter?
            }

            if (output.endsWith(".mp4")) {
                opts.push("-movflags", "faststart"); // make streaming possible, not sure if this is a good idea
            }

            // "-r", parseInt(info.video.FrameRate).toString(),
            // "-vsync", "cfr",
            // ...ffmpeg_options,
            // output,

            if (overwrite || emptyFile) {
                opts.push("-y");
            }

            if (Config.getInstance().cfg("debug") || Config.getInstance().cfg("app_verbose")) {
                opts.push("-loglevel", "repeat+level+verbose");
            }

            opts.push(output);

            Log.logAdvanced(LOGLEVEL.INFO, "helper", `Remuxing ${input} to ${output}`);

            const job = Helper.startJob(`remux_${path.basename(input)}`, ffmpeg_path, opts);

            if (!job || !job.process) {
                reject(new Error(`Failed to start job for remuxing ${input} to ${output}`));
                return;
            }

            // TODO: progress log
            // job.on("log", (data: string) => {
            //     const progress_match = data.match(/time=([0-9\.\:]+)/);
            //     if (progress_match) {
            //         const progress = progress_match[1];
            //         // TwitchLog.logAdvanced(LOGLEVEL.INFO, "helper", `Remuxing ${input} to ${output} progress: ${progress}`);
            //         console.log(chalk.gray(`Remuxing ${input} to ${output} progress: ${progress}`));
            //     }
            // });

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
                const success = fs.existsSync(output) && fs.statSync(output).size > 0;
                if (success) {
                    Log.logAdvanced(LOGLEVEL.SUCCESS, "helper", `Remuxed ${input} to ${output}`);
                    resolve({ code: code || -1, success, stdout: job.stdout, stderr: job.stderr });
                } else {
                    Log.logAdvanced(LOGLEVEL.ERROR, "helper", `Failed to remux ${path.basename(input)} to ${path.basename(output)}`);
                    // reject({ code, success, stdout: job.stdout, stderr: job.stderr });

                    let message = "Unknown error";
                    const errorSearch = job.stderr.join("").match(/\[error\] (.*)/g);
                    if (errorSearch && errorSearch.length > 0) {
                        message = errorSearch.slice(1).join(", ");
                    }

                    if (fs.existsSync(output) && fs.statSync(output).size == 0) {
                        fs.unlinkSync(output);
                    }

                    // for (const err of errorSearch) {
                    //    message = err[1];
                    reject(new Error(`Failed to remux ${path.basename(input)} to ${path.basename(output)}: ${message}`));
                }
            });

        });

    }

    static cutFile(input: string, output: string, start_second: number, end_second: number, overwrite = false): Promise<RemuxReturn> {

        return new Promise((resolve, reject) => {

            const ffmpeg_path = this.path_ffmpeg();

            if (!ffmpeg_path) {
                reject(new Error("Failed to find ffmpeg"));
                return;
            }

            const emptyFile = fs.existsSync(output) && fs.statSync(output).size == 0;

            if (!overwrite && fs.existsSync(output) && !emptyFile) {
                Log.logAdvanced(LOGLEVEL.ERROR, "helper", `Output file ${output} already exists`);
                reject(new Error(`Output file ${output} already exists`));
                return;
            }

            if (emptyFile) {
                fs.unlinkSync(output);
            }

            const opts: string[] = [];
            opts.push("-i", input);
            opts.push("-ss", start_second.toString());
            opts.push("-t", (end_second - start_second).toString());
            opts.push("-c", "copy");
            // opts.push("-bsf:a", "aac_adtstoasc");
            // ...ffmpeg_options,
            // output,

            if (Config.debug || Config.getInstance().cfg("app_verbose")) {
                opts.push("-loglevel", "repeat+level+verbose");
            }

            opts.push(output);

            Log.logAdvanced(LOGLEVEL.INFO, "helper", `Cutting ${input} to ${output}`);

            const job = Helper.startJob(`cut_${path.basename(input)}`, ffmpeg_path, opts);

            if (!job || !job.process) {
                reject(new Error(`Failed to start job for cutting ${input} to ${output}`));
                return;
            }

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
                const success = fs.existsSync(output) && fs.statSync(output).size > 0;
                if (success) {
                    Log.logAdvanced(LOGLEVEL.SUCCESS, "helper", `Cut ${input} to ${output} success`);
                    resolve({ code: code || -1, success, stdout: job.stdout, stderr: job.stderr });
                } else {
                    Log.logAdvanced(LOGLEVEL.ERROR, "helper", `Failed to cut ${path.basename(input)} to ${path.basename(output)}`);
                    // reject({ code, success, stdout: job.stdout, stderr: job.stderr });

                    let message = "Unknown error";
                    const errorSearch = job.stderr.join("").match(/\[error\] (.*)/g);
                    if (errorSearch && errorSearch.length > 0) {
                        message = errorSearch.slice(1).join(", ");
                    }

                    if (fs.existsSync(output) && fs.statSync(output).size == 0) {
                        fs.unlinkSync(output);
                    }

                    // for (const err of errorSearch) {
                    //    message = err[1];
                    reject(new Error(`Failed to cut ${path.basename(input)} to ${path.basename(output)}: ${message}`));
                }
            });

        });

    }

    // not sure if this is even working correctly, chat is horrible to work with, not even worth it
    static cutChat(input: string, output: string, start_second: number, end_second: number, overwrite = false): boolean {

        // return new Promise((resolve, reject) => {

        if (!fs.existsSync(input)) {
            throw new Error(`Input file ${input} does not exist`);
        }

        if (!overwrite && fs.existsSync(output)) {
            throw new Error(`Output file ${output} already exists`);
        }

        const json: TwitchCommentDump = JSON.parse(fs.readFileSync(input, "utf8"));

        // delete comments outside of the time range
        json.comments = json.comments.filter((comment) => {
            return comment.content_offset_seconds >= start_second && comment.content_offset_seconds <= end_second;
        });

        // normalize the offset of each comment
        const base_offset = json.comments[0].content_offset_seconds;
        json.comments.forEach((comment) => {
            comment.content_offset_seconds -= base_offset;
        });

        // set length
        // json.video.length = end_second - start_second;
        json.video.start = 0;
        json.video.end = end_second - start_second;
        // json.video.duration = TwitchHelper.twitchDuration(end_second-start_second);

        fs.writeFileSync(output, JSON.stringify(json));

        return fs.existsSync(output) && fs.statSync(output).size > 0;
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

    static formatBits(bits: number, precision = 2): string {
        return this.formatBytes(bits * 8, precision).toLowerCase();
    }

    /**
     * Return mediainfo for a file
     * 
     * @param filename 
     * @throws
     * @returns 
     */
    public static async mediainfo(filename: string): Promise<MediaInfo> {

        Log.logAdvanced(LOGLEVEL.INFO, "mediainfo", `Run mediainfo on ${filename}`);

        if (!filename) {
            throw new Error("No filename supplied for mediainfo");
        }

        if (!fs.existsSync(filename)) {
            throw new Error("File not found for mediainfo");
        }

        if (fs.statSync(filename).size == 0) {
            throw new Error("Filesize is 0 for mediainfo");
        }

        const mediainfo_path = Helper.path_mediainfo();
        if (!mediainfo_path) throw new Error("Failed to find mediainfo");

        const output = await Helper.execSimple(mediainfo_path, ["--Full", "--Output=JSON", filename], "mediainfo");

        if (output && output.stdout) {

            const json: MediaInfoJSONOutput = JSON.parse(output.stdout.join(""));

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
            Log.logAdvanced(LOGLEVEL.ERROR, "mediainfo", `No output from mediainfo for ${filename}`);
            throw new Error("No output from mediainfo");
        }
    }

    public static async ffprobe(filename: string): Promise<FFProbe> {

        Log.logAdvanced(LOGLEVEL.INFO, "ffprobe", `Run ffprobe on ${filename}`);

        if (!filename) {
            throw new Error("No filename supplied for ffprobe");
        }

        if (!fs.existsSync(filename)) {
            throw new Error("File not found for ffprobe");
        }

        if (fs.statSync(filename).size == 0) {
            throw new Error("Filesize is 0 for ffprobe");
        }

        const ffprobe_path = Helper.path_ffprobe();
        if (!ffprobe_path) throw new Error("Failed to find ffprobe");

        const output = await Helper.execSimple(ffprobe_path, [
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            // "-show_entries",
            filename,
        ], "ffprobe");

        if (output && output.stdout) {
            const json: FFProbe = JSON.parse(output.stdout.join(""));
            return json;
        } else {
            Log.logAdvanced(LOGLEVEL.ERROR, "ffprobe", `No output from ffprobe for ${filename}`);
            throw new Error("No output from ffprobe");
        }

    }

    public static async getSubs(): Promise<Subscriptions | false> {

        Log.logAdvanced(LOGLEVEL.INFO, "helper", "Requesting subscriptions list");

        if (!this.axios) {
            throw new Error("Axios is not initialized");
        }

        let response;

        try {
            response = await this.axios.get("/helix/eventsub/subscriptions");
        } catch (err) {
            Log.logAdvanced(LOGLEVEL.FATAL, "helper", `Subs return: ${err}`);
            return false;
        }

        const json: Subscriptions = response.data;

        Log.logAdvanced(LOGLEVEL.INFO, "helper", `${json.total} subscriptions`);

        return json;

    }

    public static getErrors(): string[] {
        const errors = [];
        if (!this.axios) errors.push("Axios is not initialized. Make sure the client id and secret are set in the config.");
        if (!Config.getInstance().cfg("app_url") && Config.getInstance().cfg("app_url") !== "debug") errors.push("No app url set in the config.");
        if (!Config.getInstance().cfg("api_client_id")) errors.push("No client id set in the config.");
        if (!Config.getInstance().cfg("api_secret")) errors.push("No client secret set in the config.");
        if (TwitchChannel.channels.length == 0) errors.push("No channels set in the config.");

        if (!this.path_ffmpeg()) errors.push("Failed to find ffmpeg");
        if (!this.path_streamlink()) errors.push("Failed to find streamlink");
        if (!this.path_mediainfo()) errors.push("Failed to find mediainfo");

        for (const field of Config.settingsFields) {
            if (field.deprecated && Config.getInstance().cfg(field.key) !== field.default) {
                if (typeof field.deprecated === "string") {
                    errors.push(`${field.key} is deprecated: ${field.deprecated}`);
                } else {
                    errors.push(`'${field.key}' is deprecated and will be removed in the future.`);
                }
            }
        }

        return errors;
    }

}