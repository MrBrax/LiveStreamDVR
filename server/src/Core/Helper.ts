import path from "node:path";
import fs from "node:fs";
import { BaseConfigCacheFolder, BaseConfigDataFolder } from "./BaseConfig";
import { Config } from "./Config";
import { Log } from "./Log";
import { ExecReturn, RemuxReturn } from "Providers/Twitch";
import { spawn } from "node:child_process";
import { Stream } from "../../../common/TwitchAPI/Streams";
import chalk from "chalk";
import { Job } from "./Job";
import { createHash } from "node:crypto";
import { FFProbe } from "../../../common/FFProbe";
import { MediaInfoJSONOutput, VideoMetadata, AudioMetadata } from "../../../common/MediaInfo";
import { MediaInfo } from "../../../common/mediainfofield";

export class Helper {
    public static vodFolder(username = "") {
        return BaseConfigDataFolder.vod + (Config.getInstance().cfg("channel_folders") && username !== "" ? path.sep + username : "");
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
        return false;
    }

    public static path_ffmpeg(): string | false {
        if (Config.getInstance().cfg("ffmpeg_path")) return Config.getInstance().cfg<string>("ffmpeg_path");
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
            Log.logAdvanced(Log.Level.ERROR, "helper", `Streamlink binary not found at: ${full_path}`);
            return false;
        }

        return exists ? full_path : false;
    }

    public static path_youtubedl(): string | false {
        if (!Config.getInstance().cfg("bin_dir")) return false;
        const full_path = path.join(Config.getInstance().cfg("bin_dir"), `yt-dlp${this.is_windows() ? ".exe" : ""}`);
        const exists = fs.existsSync(full_path);

        if (!exists) {
            Log.logAdvanced(Log.Level.ERROR, "helper", `yt-dlp binary not found at: ${full_path}`);
            return false;
        }

        return exists ? full_path : false;
    }

    public static path_tcd(): string | false {
        if (!Config.getInstance().cfg("bin_dir")) return false;
        const full_path = path.join(Config.getInstance().cfg("bin_dir"), `tcd${this.is_windows() ? ".exe" : ""}`);
        const exists = fs.existsSync(full_path);

        if (!exists) {
            Log.logAdvanced(Log.Level.ERROR, "helper", `tcd binary not found at: ${full_path}`);
            return false;
        }

        return exists ? full_path : false;
    }

    public static path_pipenv(): string | false {
        if (!Config.getInstance().cfg("bin_dir")) return false;
        const full_path = path.join(Config.getInstance().cfg("bin_dir"), `pipenv${this.is_windows() ? ".exe" : ""}`);
        const exists = fs.existsSync(full_path);

        if (!exists) {
            Log.logAdvanced(Log.Level.ERROR, "helper", `pipenv binary not found at: ${full_path}`);
            return false;
        }

        return exists ? full_path : false;
    }

    public static path_twitchdownloader(): string | false {
        if (Config.getInstance().cfg("twitchdownloader_path")) return Config.getInstance().cfg<string>("twitchdownloader_path");
        return false;
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

            process.on("error", (err) => {
                Log.logAdvanced(Log.Level.ERROR, "helper.execSimple", `Process ${pid} for '${what}' error: ${err}`);
                reject({ code: -1, stdout, stderr });
            });

            const pid = process.pid;

            Log.logAdvanced(Log.Level.EXEC, "helper.execSimple", `Executing '${what}': $ ${bin} ${args.join(" ")}`);

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
                Log.logAdvanced(Log.Level.INFO, "helper.execSimple", `Process ${pid} for '${what}' exited with code ${code}`);

                if (code == 0) {
                    resolve({ code, stdout, stderr });
                } else {
                    reject({ code, stdout, stderr });
                }
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
    static execAdvanced(bin: string, args: string[], jobName: string, progressFunction?: (log: string) => number | undefined): Promise<ExecReturn> {
        return new Promise((resolve, reject) => {

            const process = spawn(bin, args || [], {
                // detached: true,
                // windowsHide: true,
            });

            process.on("error", (err) => {
                Log.logAdvanced(Log.Level.ERROR, "helper.execAdvanced", `Process ${process.pid} error: ${err}`);
                reject({ code: -1, stdout, stderr });
            });

            Log.logAdvanced(Log.Level.EXEC, "helper.execAdvanced", `Executing job '${jobName}': $ ${bin} ${args.join(" ")}`);

            let job: Job;

            if (process.pid) {
                Log.logAdvanced(Log.Level.SUCCESS, "helper.execAdvanced", `Spawned process ${process.pid} for ${jobName}`);
                job = Job.create(jobName);
                job.setPid(process.pid);
                job.setExec(bin, args);
                job.setProcess(process);
                job.startLog(jobName, `$ ${bin} ${args.join(" ")}\n`);
                if (!job.save()) {
                    Log.logAdvanced(Log.Level.ERROR, "helper.execAdvanced", `Failed to save job ${jobName}`);
                }
            } else {
                Log.logAdvanced(Log.Level.ERROR, "helper.execAdvanced", `Failed to spawn process for ${jobName}`);
                // reject(new Error(`Failed to spawn process for ${jobName}`));
            }

            const stdout: string[] = [];
            const stderr: string[] = [];

            process.stdout.on("data", (data: Stream) => {
                stdout.push(data.toString());
                if (progressFunction) {
                    const p = progressFunction(data.toString());
                    if (p !== undefined && job) {
                        job.setProgress(p);
                        // console.debug(`Progress for ${jobName}: ${p}`);
                    }
                }
            });

            process.stderr.on("data", (data: Stream) => {
                stderr.push(data.toString());
                if (progressFunction) {
                    const p = progressFunction(data.toString());
                    if (p !== undefined && job) {
                        job.setProgress(p);
                        // console.debug(`Progress for ${jobName}: ${p}`);
                    }
                }
            });

            process.on("close", (code) => {
                if (job) {
                    job.clear();
                }
                // const out_log = ffmpeg.stdout.read();
                // const success = fs.existsSync(output) && fs.statSync(output).size > 0;
                if (code == 0) {
                    Log.logAdvanced(Log.Level.INFO, "helper.execAdvanced", `Process ${process.pid} for ${jobName} exited with code 0`);
                    resolve({ code, stdout, stderr });
                } else {
                    Log.logAdvanced(Log.Level.ERROR, "helper.execAdvanced", `Process ${process.pid} for ${jobName} exited with code ${code}`);
                    reject({ code, stdout, stderr });
                }
            });

            Log.logAdvanced(Log.Level.INFO, "helper.execAdvanced", `Attached to all streams for process ${process.pid} for ${jobName}`);

        });
    }

    static startJob(jobName: string, bin: string, args: string[], env: Record<string, string> = {}): Job | false {

        const envs = Object.keys(env).length > 0 ? env : process.env;

        const jobProcess = spawn(bin, args || [], {
            // detached: true,
            windowsHide: true,
            env: envs,
        });

        console.log("startJob process", jobProcess.spawnfile, jobProcess.spawnargs);

        jobProcess.on("error", (err) => {
            Log.logAdvanced(Log.Level.ERROR, "helper", `Process '${jobProcess.pid}' on job '${jobName}' error: ${err}`, {
                bin,
                args,
                jobName,
                stdout,
                stderr,
            });
        });

        Log.logAdvanced(Log.Level.INFO, "helper", `Executing ${bin} ${args.join(" ")}`);

        let job: Job | false = false;

        if (jobProcess.pid) {
            Log.logAdvanced(Log.Level.SUCCESS, "helper", `Spawned process ${jobProcess.pid} for ${jobName}`);
            job = Job.create(jobName);
            job.setPid(jobProcess.pid);
            job.setExec(bin, args);
            job.setProcess(jobProcess);
            job.addMetadata({
                bin: bin,
                args: args,
                env: env,
            });
            job.startLog(jobName, `$ ${bin} ${args.join(" ")}\n`);
            if (!job.save()) {
                Log.logAdvanced(Log.Level.ERROR, "helper", `Failed to save job ${jobName}`);
            }
        } else {
            Log.logAdvanced(Log.Level.ERROR, "helper", `Failed to spawn process for ${jobName}`);
            // reject(new Error(`Failed to spawn process for ${jobName}`));
        }

        const stdout: string[] = [];
        const stderr: string[] = [];

        jobProcess.stdout.on("data", (data: Stream) => {
            stdout.push(data.toString());
        });

        jobProcess.stderr.on("data", (data: Stream) => {
            stderr.push(data.toString());
        });

        jobProcess.on("close", (code) => {
            if (code == 0) {
                Log.logAdvanced(Log.Level.SUCCESS, "helper", `Process ${jobProcess.pid} for ${jobName} closed with code 0`);
            } else {
                Log.logAdvanced(Log.Level.ERROR, "helper", `Process ${jobProcess.pid} for ${jobName} closed with code ${code}`);
            }

            if (typeof job !== "boolean") {
                job.onClose(code);
                job.clear(); // ?
            }

        });

        Log.logAdvanced(Log.Level.INFO, "helper", `Attached to all streams for process ${jobProcess.pid} for ${jobName}`);

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

            const ffmpeg_path = Helper.path_ffmpeg();

            if (!ffmpeg_path) {
                reject(new Error("Failed to find ffmpeg"));
                return;
            }

            const emptyFile = fs.existsSync(output) && fs.statSync(output).size == 0;

            if (!overwrite && fs.existsSync(output) && !emptyFile) {
                Log.logAdvanced(Log.Level.ERROR, "helper", `Output file ${output} already exists`);
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
                    Log.logAdvanced(Log.Level.ERROR, "helper", `Metadata file ${metadata_file} does not exist for remuxing ${input}`);
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

            if (Config.getInstance().cfg("app_verbose")) {
                opts.push("-loglevel", "repeat+level+verbose");
            }

            if (Config.getInstance().cfg("debug")) {
                // opts.push("-report"); // can't set output file
                opts.push("-progress", path.join(BaseConfigDataFolder.logs_software, "ffmpeg_progress.log"));
                opts.push("-vstats");
                opts.push("-vstats_file", path.join(BaseConfigDataFolder.logs_software, "ffmpeg_vstats.log"));
            }

            opts.push(output);

            Log.logAdvanced(Log.Level.INFO, "helper", `Remuxing ${input} to ${output}`);

            const job = Helper.startJob(`remux_${path.basename(input)}`, ffmpeg_path, opts);

            if (!job || !job.process) {
                reject(new Error(`Failed to start job for remuxing ${input} to ${output}`));
                return;
            }

            let currentSeconds = 0;
            let totalSeconds = 0;
            job.on("log", (stream: string, data: string) => {
                const totalDurationMatch = data.match(/Duration: (\d+):(\d+):(\d+)/);
                if (totalDurationMatch && !totalSeconds) {
                    totalSeconds = parseInt(totalDurationMatch[1]) * 3600 + parseInt(totalDurationMatch[2]) * 60 + parseInt(totalDurationMatch[3]);
                    console.log(`Remux total duration for ${path.basename(input)}: ${totalSeconds}`);
                }
                const currentTimeMatch = data.match(/time=(\d+):(\d+):(\d+)/);
                if (currentTimeMatch && totalSeconds > 0) {
                    currentSeconds = parseInt(currentTimeMatch[1]) * 3600 + parseInt(currentTimeMatch[2]) * 60 + parseInt(currentTimeMatch[3]);
                    job.setProgress(currentSeconds / totalSeconds);
                    // console.debug(`Remux current time: ${currentSeconds}/${totalSeconds}`);
                    console.log(
                        chalk.bgGreen.whiteBright(
                            `[${new Date().toISOString()}] Remuxing ${path.basename(input)} - ${currentSeconds}/${totalSeconds} seconds (${Math.round((currentSeconds / totalSeconds) * 100)}%)`
                        )
                    );
                }
                if (data.match(/moving the moov atom/)) {
                    console.log("Create MOOV atom for " + path.basename(input));
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
                const success = fs.existsSync(output) && fs.statSync(output).size > 0;
                if (success) {
                    Log.logAdvanced(Log.Level.SUCCESS, "helper", `Remuxed ${input} to ${output}`);
                    resolve({ code: code || -1, success, stdout: job.stdout, stderr: job.stderr });
                } else {
                    Log.logAdvanced(Log.Level.ERROR, "helper", `Failed to remux '${input}' to '${output}'`);
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
                    reject(new Error(`Failed to remux '${input}' to '${output}': ${message}`));
                }
            });

        });

    }

    static cutFile(input: string, output: string, start_second: number, end_second: number, overwrite = false): Promise<RemuxReturn> {

        return new Promise((resolve, reject) => {

            const ffmpeg_path = Helper.path_ffmpeg();

            if (!ffmpeg_path) {
                reject(new Error("Failed to find ffmpeg"));
                return;
            }

            const emptyFile = fs.existsSync(output) && fs.statSync(output).size == 0;

            if (!overwrite && fs.existsSync(output) && !emptyFile) {
                Log.logAdvanced(Log.Level.ERROR, "helper", `Output file ${output} already exists`);
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

            Log.logAdvanced(Log.Level.INFO, "helper", `Cutting ${input} to ${output}`);

            const job = Helper.startJob(`cut_${path.basename(input)}`, ffmpeg_path, opts);

            if (!job || !job.process) {
                reject(new Error(`Failed to start job for cutting ${input} to ${output}`));
                return;
            }

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
                const success = fs.existsSync(output) && fs.statSync(output).size > 0;
                if (success) {
                    Log.logAdvanced(Log.Level.SUCCESS, "helper", `Cut ${input} to ${output} success`);
                    resolve({ code: code || -1, success, stdout: job.stdout, stderr: job.stderr });
                } else {
                    Log.logAdvanced(Log.Level.ERROR, "helper", `Failed to cut ${path.basename(input)} to ${path.basename(output)}`);
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

            let currentSeconds = 0;
            let totalSeconds = 0;
            job.on("log", (stream: string, data: string) => {
                const totalDurationMatch = data.match(/Duration: (\d+):(\d+):(\d+)/);
                if (totalDurationMatch && !totalSeconds) {
                    totalSeconds = parseInt(totalDurationMatch[1]) * 3600 + parseInt(totalDurationMatch[2]) * 60 + parseInt(totalDurationMatch[3]);
                    console.debug(`Cut total duration: ${totalSeconds}`);
                }
                const currentTimeMatch = data.match(/time=(\d+):(\d+):(\d+)/);
                if (currentTimeMatch && totalSeconds > 0) {
                    currentSeconds = parseInt(currentTimeMatch[1]) * 3600 + parseInt(currentTimeMatch[2]) * 60 + parseInt(currentTimeMatch[3]);
                    job.setProgress(currentSeconds / totalSeconds);
                    console.debug(`Cut current time: ${currentSeconds}`);
                }
                if (data.match(/moving the moov atom/)) {
                    console.debug("Cut moov atom move");
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

        Log.logAdvanced(Log.Level.INFO, "helper.mediainfo", `Run mediainfo on ${filename}`);

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
            Log.logAdvanced(Log.Level.ERROR, "helper.mediainfo", `No output from mediainfo for ${filename}`);
            throw new Error("No output from mediainfo");
        }
    }

    public static async ffprobe(filename: string): Promise<FFProbe> {

        Log.logAdvanced(Log.Level.INFO, "helper.ffprobe", `Run ffprobe on ${filename}`);

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
            Log.logAdvanced(Log.Level.ERROR, "helper.ffprobe", `No output from ffprobe for ${filename}`);
            throw new Error("No output from ffprobe");
        }

    }

    public static async videometadata(filename: string): Promise<VideoMetadata | AudioMetadata> {

        let data: MediaInfo | false = false;

        const filenameHash = createHash("md5").update(filename).digest("hex"); // TODO: do we need it to by dynamic?
        const dataPath = path.join(BaseConfigCacheFolder.cache, "mediainfo", `${filenameHash}.json`);

        if (fs.existsSync(dataPath)) {

            data = JSON.parse(fs.readFileSync(dataPath, { encoding: "utf-8" }));

            if (!data) {
                Log.logAdvanced(Log.Level.ERROR, "helper.videometadata", `Trying to read cached mediainfo of ${filename} returned nothing`);
                throw new Error("No cached data from mediainfo");
            }

        } else {

            try {
                data = await Helper.mediainfo(filename);
            } catch (th) {
                Log.logAdvanced(Log.Level.ERROR, "helper.videometadata", `Trying to get mediainfo of ${filename} returned: ${(th as Error).message}`);
                throw th; // rethrow?
            }

            if (!data) {
                Log.logAdvanced(Log.Level.ERROR, "helper.videometadata", `Trying to get mediainfo of ${filename} returned false`);
                throw new Error("No data from mediainfo");
            }

            if (!fs.existsSync(path.dirname(dataPath))) {
                fs.mkdirSync(path.dirname(dataPath), { recursive: true });
            }

            fs.writeFileSync(dataPath, JSON.stringify(data));

        }

        if (!data.general.Format || !data.general.Duration) {
            Log.logAdvanced(Log.Level.ERROR, "helper.videometadata", `Invalid mediainfo for ${filename} (missing ${!data.general.Format ? "Format" : ""} ${!data.general.Duration ? "Duration" : ""})`);
            throw new Error("Invalid mediainfo: no format/duration");
        }

        // if (!data.video) {
        //     Log.logAdvanced(Log.Level.ERROR, "helper.videometadata", `Invalid mediainfo for ${filename} (missing video)`);
        //     throw new Error("Invalid mediainfo: no video");
        // }

        if (!data.audio) {
            Log.logAdvanced(Log.Level.ERROR, "helper.videometadata", `Invalid mediainfo for ${filename} (missing audio)`);
            throw new Error("Invalid mediainfo: no audio");
        }

        const isAudio = data.video === undefined;

        if (isAudio) {

            if (data.audio) {

                const audio_metadata = {

                    type: "audio",

                    container: data.general.Format,

                    size: parseInt(data.general.FileSize),
                    duration: parseInt(data.general.Duration),
                    bitrate: parseInt(data.general.OverallBitRate),

                    audio_codec: data.audio.Format,
                    audio_bitrate: parseInt(data.audio.BitRate),
                    audio_bitrate_mode: data.audio.BitRate_Mode as "VBR" | "CBR",
                    audio_sample_rate: parseInt(data.audio.SamplingRate),
                    audio_channels: parseInt(data.audio.Channels),

                } as AudioMetadata;

                Log.logAdvanced(Log.Level.SUCCESS, "helper.videometadata", `${filename} is an audio file ${audio_metadata.duration} long.`);

                return audio_metadata;

            } else {

                throw new Error("Invalid mediainfo: no audio");

            }

        } else {

            if (data.video && data.audio) {

                const video_metadata = {

                    type: "video",

                    container: data.general.Format,

                    size: parseInt(data.general.FileSize),
                    duration: parseInt(data.general.Duration),
                    bitrate: parseInt(data.general.OverallBitRate),

                    width: parseInt(data.video.Width),
                    height: parseInt(data.video.Height),

                    fps: parseInt(data.video.FrameRate), // TODO: check if this is correct, seems to be variable
                    fps_mode: data.video.FrameRate_Mode as "VFR" | "CFR",

                    audio_codec: data.audio.Format,
                    audio_bitrate: parseInt(data.audio.BitRate),
                    audio_bitrate_mode: data.audio.BitRate_Mode as "VBR" | "CBR",
                    audio_sample_rate: parseInt(data.audio.SamplingRate),
                    audio_channels: parseInt(data.audio.Channels),

                    video_codec: data.video.Format,
                    video_bitrate: parseInt(data.video.BitRate),
                    video_bitrate_mode: data.video.BitRate_Mode as "VBR" | "CBR",

                } as VideoMetadata;

                Log.logAdvanced(Log.Level.SUCCESS, "helper.videometadata", `${filename} is a video file ${video_metadata.duration} long at ${video_metadata.height}p${video_metadata.fps}.`);

                return video_metadata;

            } else {

                throw new Error("Invalid mediainfo: no video/audio");

            }

        }

    }

    public static ffmpeg_time(ms: number): string {
        // format as 00:00:00.000
        const hours = Math.floor(ms / 3600000);
        const minutes = Math.floor((ms % 3600000) / 60000);
        const seconds = Math.floor(((ms % 3600000) % 60000) / 1000);
        const milliseconds = Math.floor(((ms % 3600000) % 60000) % 1000);
        return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`;
    }

    public static async videoThumbnail(filename: string, width: number, offset = 5000): Promise<string> {

        Log.logAdvanced(Log.Level.INFO, "helper.thumbnail", `Run ffmpeg on ${filename}`);

        if (!filename) {
            throw new Error("No filename supplied for thumbnail");
        }

        if (!fs.existsSync(filename)) {
            throw new Error(`File not found for video thumbnail: ${filename}`);
        }

        if (fs.statSync(filename).size == 0) {
            throw new Error(`Filesize is 0 for video thumbnail: ${filename}`);
        }

        const filenameHash = createHash("md5").update(filename + width + offset).digest("hex");

        const output_image = path.join(BaseConfigCacheFolder.public_cache_thumbs, `${filenameHash}.${Config.getInstance().cfg<string>("thumbnail_format", "jpg")}`);

        if (fs.existsSync(output_image)) {
            return path.basename(output_image);
        }

        const ffmpeg_path = Helper.path_ffmpeg();
        if (!ffmpeg_path) throw new Error("Failed to find ffmpeg");

        const output = await Helper.execSimple(ffmpeg_path, [
            "-ss", this.ffmpeg_time(offset),
            "-i", filename,
            "-vf", `thumbnail,scale=${width}:-1`,
            "-frames:v", "1",
            output_image,
        ], "ffmpeg video thumbnail");

        if (output && fs.existsSync(output_image) && fs.statSync(output_image).size > 0) {
            return path.basename(output_image);
        } else {
            throw new Error("No output from ffmpeg");
        }

    }

    public static async imageThumbnail(filename: string, width: number): Promise<string> {

        Log.logAdvanced(Log.Level.INFO, "helper.thumbnail", `Run thumbnail on ${filename}`);

        if (!filename) {
            throw new Error("No filename supplied for thumbnail");
        }

        if (!fs.existsSync(filename)) {
            throw new Error(`File not found for thumbnail: ${filename}`);
        }

        if (fs.statSync(filename).size == 0) {
            throw new Error(`Filesize is 0 for thumbnail: ${filename}`);
        }

        const filenameHash = createHash("md5").update(filename + width).digest("hex");

        const thumbnail_format = Config.getInstance().cfg<string>("thumbnail_format", "jpg");

        const output_image = path.join(BaseConfigCacheFolder.public_cache_thumbs, `${filenameHash}.${thumbnail_format}`);

        if (fs.existsSync(output_image)) {
            return path.basename(output_image);
        }

        const ffmpeg_path = Helper.path_ffmpeg();
        if (!ffmpeg_path) throw new Error("Failed to find ffmpeg");

        /*
        let codec = "";
        if (thumbnail_format == "jpg") {
            codec = "jpeg";
        } else if (thumbnail_format == "png") {
            codec = "png";
        } else if (thumbnail_format == "webp") {
            codec = "webp";
        } else {
            throw new Error(`Unsupported thumbnail format: ${thumbnail_format}`);
        }
        */

        let output: ExecReturn;

        try {
            output = await Helper.execSimple(ffmpeg_path, [
                "-i", filename,
                "-vf", `scale=${width}:-1`,
                // "-codec", codec,        
                output_image,
            ], "ffmpeg image thumbnail");
        } catch (error) {
            Log.logAdvanced(Log.Level.ERROR, "helper.thumbnail", `Failed to create thumbnail: ${error}`, error);
            throw error;            
        }

        if ((output.stderr.join("") + output.stdout.join("")).includes("Default encoder for format")) {
            throw new Error("Unsupported codec for image thumbnail");
        }

        if (output && fs.existsSync(output_image) && fs.statSync(output_image).size > 0) {
            return path.basename(output_image);
        } else {
            Log.logAdvanced(Log.Level.ERROR, "helper.thumbnail", `Failed to create thumbnail for ${filename}`, output);
            throw new Error("No output from ffmpeg");
        }

    }

}