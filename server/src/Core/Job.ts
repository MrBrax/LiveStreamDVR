import { execSimple } from "@/Helpers/Execute";
import { is_windows } from "@/Helpers/System";
import { xClearTimeout, xTimeout } from "@/Helpers/Timeout";
import { ApiJob } from "@common/Api/Client";
import { JobStatus } from "@common/Defs";
import { parseJSON } from "date-fns";
import { ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { BaseConfigCacheFolder, BaseConfigDataFolder } from "./BaseConfig";
import { LOGLEVEL, log } from "./Log";
import { Webhook } from "./Webhook";

export interface TwitchAutomatorJobJSON {
    name: string;
    pid: number;
    metadata?: Record<string, any>;
    dt_started_at: string;
    bin?: string;
    args?: string[];
}

export class Job extends EventEmitter {

    static jobs: Job[] = [];
    static pidstatus: Record<number, boolean> = {};

    static readonly NO_FILE = 1;
    static readonly NO_DATA = 2;

    /*
    public string $name;
    public $pid;
    public string $pidfile;
    public string $pidfile_simple;
    public array $metadata = [];
    public $status;
    public int $error;
    public Process $process;
    public ?\DateTime $dt_started_at;
    */

    public name!: string;
    public pid: number | undefined;
    public pidfile: string | undefined;
    public pidfile_simple: string | undefined;
    public metadata: Record<string, any> | undefined;
    public status: JobStatus = JobStatus.NONE;
    public error: number | undefined;

    public process: ChildProcessWithoutNullStreams | undefined;
    public process_running = false;

    public dt_started_at: Date | undefined;

    public stdout: string[] = [];
    public stderr: string[] = [];
    public code: number | null = null;

    public bin?: string;
    public args?: string[];

    public progress = 0;

    public dummy = false;

    logfile = "";

    private _updateTimer: NodeJS.Timeout | undefined;
    private _progressTimer: NodeJS.Timeout | undefined;

    private realpath(str: string): string {
        return path.normalize(str);
    }

    public static loadJobsFromCache() {
        const jobs = fs.readdirSync(BaseConfigCacheFolder.pids).filter(f => f.endsWith(".json"));
        for (const job_data of jobs) {
            Job.load(job_data.replace(".json", ""));
        }
        log(LOGLEVEL.INFO, "job", `Loaded ${jobs.length} jobs from cache`);

        this.checkStaleJobs();
    }

    public static async checkStaleJobs() {
        // const now = new Date();
        for (const job of this.jobs) {
            if (job.dummy) {
                job.clear();
                continue;
            }

            let status;
            try {
                status = await job.getStatus(true);
            } catch (error) {
                log(LOGLEVEL.ERROR, "job", `Job ${job.name} stale status error: ${(error as Error).message}`);
                job.clear();
                continue;
            }

            if (status == JobStatus.STOPPED || status == JobStatus.ERROR) {
                log(LOGLEVEL.WARNING, "job", `Job ${job.name} is stale, no process found. Clearing.`);
                job.clear();
            } else {
                log(LOGLEVEL.INFO, "job", `Job ${job.name} is still running from previous session.`);
            }
            // if (job.dt_started_at && job.dt_started_at.getTime() + (60 * 1000) < now.getTime()) {
            // 	job.clear();
            // }
        }
    }

    public static create(name: string): Job {

        const basepath = BaseConfigCacheFolder.pids;

        // if(file_exists(TwitchHelper::$pids_folder . DIRECTORY_SEPARATOR . $name . ".json")){
        // 	TwitchlogAdvanced(LOGLEVEL.WARNING, "job", "Creating job {$name} overwrites existing!");
        // }

        if (fs.existsSync(path.join(basepath, name + ".json"))) {
            log(LOGLEVEL.WARNING, "job", `Creating job ${name} overwrites existing!`);
        }

        const job = new this();
        job.name = name;
        job.pidfile = job.realpath(path.join(basepath, name + ".json"));
        job.pidfile_simple = job.realpath(path.join(basepath, name + ".pid"));
        job.dt_started_at = new Date();

        return job;
    }

    public static load(name: string): Job | false {

        log(LOGLEVEL.DEBUG, "job", `Loading job ${name}`);

        const memJob = this.jobs.find(job => job.name === name);
        if (memJob) {
            log(LOGLEVEL.DEBUG, "job", `Job ${name} found in memory`);
            return memJob;
        }

        const basepath = BaseConfigCacheFolder.pids;

        const job = new this();
        job.name = name;
        job.pidfile = job.realpath(path.join(basepath, `${name}.json`));
        job.pidfile_simple = job.realpath(path.join(basepath, `${name}.pid`));
        job.dt_started_at = new Date();

        // if no pid file
        if (!fs.existsSync(job.pidfile)) {
            log(LOGLEVEL.ERROR, "job", `Loading job ${job.name} failed, no json file`, job.metadata);
            // return job.loadSimple();
            job.error = this.NO_FILE;
            return false;
        }

        // read pid file
        const raw = fs.readFileSync(job.pidfile, "utf8");
        if (!raw) {
            log(LOGLEVEL.ERROR, "job", `Loading job ${job.name} failed, no data in json file`, job.metadata);
            job.error = this.NO_DATA;
            return false;
        }

        const data: TwitchAutomatorJobJSON = JSON.parse(raw);

        job.pid = data.pid;
        job.dt_started_at = data.dt_started_at ? parseJSON(data.dt_started_at) : undefined;
        job.metadata = data.metadata;
        job.bin = data.bin;
        job.args = data.args;

        // TwitchlogAdvanced(LOGLEVEL.DEBUG, "job", "Job {$this->name} loaded, proceed to get status.", $this->metadata);

        if (!Job.jobs.includes(job)) {
            Job.jobs.push(job);
            log(LOGLEVEL.DEBUG, "job", `Loaded job ${job.name} added to jobs list`, job.metadata);
        }

        // $this->getStatus();
        return job;

    }

    public static hasJob(name: string): boolean {
        return this.jobs.some(job => job.name === name);
    }

    public static findJob(search: string): Job | false {
        const job = this.jobs.find(job => job.name?.includes(search));
        if (job) {
            return job;
        }
        return false;
    }

    public static findJobThatStartsWith(search: string): Job | false {
        const job = this.jobs.find(job => job.name?.startsWith(search));
        if (job) {
            return job;
        }
        return false;
    }

    public static findJobByPid(pid: number): Job | false {
        const job = this.jobs.find(job => job.pid === pid);
        if (job) {
            return job;
        }
        return false;
    }

    public static getJob(name: string): Job | false {
        const job = this.jobs.find(job => job.name === name);
        if (job) {
            return job;
        }
        return false;
    }

    /**
     * Save to disk, like when the process starts
     *
     * @return {boolean} Success
     */
    public save(): boolean {
        if (!this.pidfile) {
            throw new Error("pidfile not set");
        }

        if (!this.name) {
            throw new Error("name not set");
        }

        if (this.dummy) {
            Webhook.dispatchAll("job_save", {
                "job_name": this.name,
                "job": this.toAPI(),
            });
            if (!Job.hasJob(this.name)) {
                Job.jobs.push(this);
                log(LOGLEVEL.DEBUG, "job", `New job ${this.name} (dummy) added to jobs list`, this.metadata);
            } else {
                log(LOGLEVEL.DEBUG, "job", `Job ${this.name} (dummy) already in jobs list`, this.metadata);
            }
            return false;
        }

        log(LOGLEVEL.INFO, "job", `Save job ${this.name} with PID ${this.pid} to ${this.pidfile}`, this.metadata);

        Webhook.dispatchAll("job_save", {
            "job_name": this.name,
            "job": this.toAPI(),
        });

        //return file_put_contents($this->pidfile, json_encode($this)) != false;
        // console.debug("job save", this);

        let json_data;
        try {
            json_data = JSON.stringify(this);
        } catch (e) {
            log(LOGLEVEL.FATAL, "job", `Failed to stringify job ${this.name}`, this.metadata);
            return false;
        }

        fs.writeFileSync(this.pidfile, json_data, "utf8");

        const exists = fs.existsSync(this.pidfile);

        log(LOGLEVEL.DEBUG, "job", `Job ${this.name} ${exists ? "saved" : "failed to save"}`, this.metadata);

        if (exists && !Job.hasJob(this.name)) {
            Job.jobs.push(this);
            log(LOGLEVEL.DEBUG, "job", `New job ${this.name} added to jobs list`, this.metadata);
        }

        this.emit("save");

        return exists;
    }

    /**
     * Remove from disk, like when the process quits
     *
     * @return {boolean} Success
     */
    public clear(): boolean {
        // if (this.process) {
        // 	this.process = null;
        // }

        if (this.dummy) {
            this.emit("pre_clear");
            log(LOGLEVEL.DEBUG, "job", `Clear job ${this.name} (dummy)`, this.metadata);
            Job.jobs = Job.jobs.filter(job => job.name !== this.name);
            this.emit("clear", this.code);
            this.broadcastUpdate();
            return false;
        }

        if (!this.pidfile) {
            throw new Error("pidfile not set");
        }

        this.emit("pre_clear");

        if (fs.existsSync(this.pidfile)) {
            log(LOGLEVEL.INFO, "job", `Clear job ${this.name} with PID ${this.pid}`, this.metadata);

            Webhook.dispatchAll("job_clear", {
                "job_name": this.name,
                "job": this.toAPI(),
            });

            fs.unlinkSync(this.pidfile);
            // return !fs.existsSync(this.pidfile);
        }

        if (Job.hasJob(this.name)) {
            Job.jobs = Job.jobs.filter(job => job.name !== this.name);
            log(LOGLEVEL.SUCCESS, "job", `Job ${this.name} removed from jobs list`, this.metadata);
        } else {
            log(LOGLEVEL.WARNING, "job", `Job ${this.name} not found in jobs list`, this.metadata);
        }

        this.emit("clear", this.code);

        this.broadcastUpdate();

        return false;
    }

    /**
     * Set process PID
     *
     * @param {number} pid
     * @return void
     */
    public setPid(pid: number): void {
        this.emit("pid_set", this.pid, pid);
        this.pid = pid;
        log(LOGLEVEL.DEBUG, "job", `Set PID ${pid} for job ${this.name}`, this.metadata);
        this.broadcastUpdate();
    }

    /**
     * Get process PID
     *
     * @return {(number|undefined)} Process ID
     */
    public getPid(): number | undefined {
        return this.pid;
    }

    public setExec(bin: string, args: string[]): void {
        this.bin = bin;
        this.args = args;
        this.broadcastUpdate();
    }

    /**
     * Attach process to job, possibly avoiding the need to check running processes
     *
     * @param {Process} process Process to attach
     * @return void
     */
    public setProcess(process: ChildProcessWithoutNullStreams): void {
        this.emit("process_set", this.process, process);
        this.process = process;
        log(LOGLEVEL.DEBUG, "job", `Set process for job ${this.name}`, this.metadata);

        this.process_running = process.pid !== undefined;

        this.process.on("spawn", () => {
            log(LOGLEVEL.DEBUG, "job", `Spawned process for job ${this.name}`, this.metadata);
            this.status = JobStatus.RUNNING;
            this.emit("process_start");
            this.process_running = true;
        });

        this.process.on("exit", (code, signal) => {
            if (code === 1) this.status = JobStatus.ERROR;
            this.emit("process_exit", code, signal);
            this.process_running = false;
            this.onClose(code);
        });

        this.process.on("error", (err) => {
            this.status = JobStatus.ERROR;
            this.emit("process_error", err);
            this.process_running = false;
        });

        this.process.on("close", (code, signal) => {
            if (code === 1) this.status = JobStatus.ERROR;
            this.emit("process_close", code, signal);
            this.process_running = false;
            this.onClose(code);
        });

        this.on("process_start", () => {
            this.broadcastUpdate();
        });

        this.on("process_exit", () => {
            this.broadcastUpdate();
        });

        this.on("process_error", () => {
            this.broadcastUpdate();
        });

        this.broadcastUpdate();

        /*
        this.process.on("close", (code, signal) => {
            TwitchlogAdvanced(LOGLEVEL.INFO, "job", `Process for job ${this.name} exited with code ${code} and signal ${signal}`, this.metadata);
            this.emit("close", code, signal);
        }
        */
    }

    public detachProcess(): void {
        if (!this.process) {
            throw new Error("process not set");
        }

        // this.process.stderr.unpipe()
        // this.process.stderr.destroy()
        // this.process.stdout.unpipe()
        // this.process.stdout.destroy()
        // this.process.stdin.end()
        // this.process.stdin.destroy()

        this.process.unref();

        this.process = undefined;
    }

    /**
     * Attach metadata
     *
     * @param {any} metadata An object or array or any other data to attach
     * @return {void}
     */
    public setMetadata(metadata: Record<string, any>): void {
        this.emit("metadata_set", this.metadata, metadata);
        this.metadata = metadata;
        this.broadcastUpdate();
    }

    public addMetadata(metadata: Record<string, any>): void {
        this.emit("metadata_add", this.metadata, metadata);
        this.metadata = { ...this.metadata, ...metadata };
        this.broadcastUpdate();
    }

    /**
     * Get running status of job, PID if running.
     *
     * @param {boolean} use_command Use command to check if running, instead of relying on events.
     * @throws {Error}
     * @returns {(int|false)} PID if running, false if not.
     */
    public async getStatus(use_command = false): Promise<JobStatus> {

        log(LOGLEVEL.DEBUG, "job", `Check status for job ${this.name}`, this.metadata);

        if (this.dummy) {
            this.status = JobStatus.RUNNING;
            log(LOGLEVEL.DEBUG, "job", `Job ${this.name} is dummy, returning RUNNING`, this.metadata);
            return JobStatus.RUNNING;
        }

        // console.debug("get job status", this.name);

        if (!this.pid) {
            throw new Error("No pid set on job");
        }

        // broadcast only if changed status
        const currentStatus = this.status;

        if (this.process && !use_command) {
            this.status = this.process_running && this.process.pid ? JobStatus.RUNNING : JobStatus.STOPPED;
            if (currentStatus !== this.status) this.broadcastUpdate();
            return this.process_running && this.process.pid ? JobStatus.RUNNING : JobStatus.STOPPED;
        }

        let output = "";
        if (is_windows()) {

            let proc;
            try {
                proc = await execSimple("tasklist", ["/FI", `"PID eq ${this.pid}"`], `windows process status (${this.name})`);
            } catch (e) {
                log(LOGLEVEL.ERROR, "job", `Error checking status for windows job ${this.name} (${this.process_running})`, this.metadata);
                // console.debug(`Error checking status for job ${this.name} (${this.process_running})`);
                this.status = JobStatus.STOPPED;
                if (currentStatus !== this.status) this.broadcastUpdate();
                // console.debug("get job status with windows command caught", this.name, this.status);
                return JobStatus.STOPPED;
            }

            output = proc.stdout.join("\n");

        } else {

            let proc;
            try {
                proc = await execSimple("ps", ["-p", this.pid.toString()], `linux process status (${this.name})`);
            } catch (e) {
                log(LOGLEVEL.ERROR, "job", `Error checking status for linux job ${this.name} (${this.process_running})`, this.metadata);
                // console.debug(`Error checking status for job ${this.name} (${this.process_running})`);
                this.status = JobStatus.STOPPED;
                if (currentStatus !== this.status) this.broadcastUpdate();
                // console.debug("get job status with linux command caught", this.name, this.status);
                return JobStatus.STOPPED;
            }

            output = proc.stdout.join("\n");

        }

        if (output.includes(this.pid.toString())) {
            log(LOGLEVEL.DEBUG, "job", `PID file check for '${this.name}', process is running (${this.process_running})`);
            this.status = JobStatus.RUNNING;
            if (currentStatus !== this.status) this.broadcastUpdate();

            if (this.bin && !output.includes(path.basename(this.bin))) {
                log(LOGLEVEL.WARNING, "job", `PID file check for '${this.name}', process is running but binary does not match (${this.bin})`);
            }

            return JobStatus.RUNNING;
        } else {
            log(LOGLEVEL.DEBUG, "job", `PID file check for '${this.name}', process does not exist (${this.process_running})`);
            this.status = JobStatus.STOPPED;
            if (currentStatus !== this.status) this.broadcastUpdate();
            return JobStatus.STOPPED;
        }
    }

    /**
     * Quit the process via PID
     * 
     * @param {NodeJS.Signals} method Method to use to quit process
     * @returns {Promise<false|ExecReturn>} False if no PID set, otherwise the result of the quit command
     */
    public async kill(method: NodeJS.Signals = "SIGTERM"): Promise<boolean> {

        if (this.process) {
            let success;
            try {
                success = this.process.kill(method);
            } catch (error) {
                log(LOGLEVEL.ERROR, "job", `Exception killing process for job ${this.name} with internal process (${method})`, this.metadata);
                return false;
            }

            if (success) {
                this.status = JobStatus.STOPPED;
                this.broadcastUpdate();
                log(LOGLEVEL.INFO, "job", `Killed job ${this.name} with internal process (${method})`, this.metadata);
                return true;
            } else {
                log(LOGLEVEL.ERROR, "job", `Error killing internal process for job ${this.name}, continuing to other methods.`, this.metadata);
            }

        }

        const pid = this.getPid();

        log(LOGLEVEL.INFO, "job", `Killing job ${this.name} (${pid})`, this.metadata);

        this.emit("pre_kill", method);

        if (!pid) {
            log(LOGLEVEL.WARNING, "job", `Kill process for job ${this.name}, PID not found`, this.metadata);
            this.clear();
            this.broadcastUpdate();
            return false;
        }

        if (is_windows()) {
            let exec;
            const args: string[] = [];
            if (method === "SIGKILL") {
                args.push("/F");
            }
            args.push("/PID", pid.toString());
            try {
                exec = await execSimple("taskkill", args, "windows process kill");
            } catch (error) {
                log(LOGLEVEL.ERROR, "job", `Exception killing process for job ${this.name}: ${(error as Error).message}`, this.metadata);
                this.broadcastUpdate();
                return false;
            }
            const status = await this.getStatus();
            this.clear();
            this.broadcastUpdate();
            if (status === JobStatus.STOPPED) {
                log(LOGLEVEL.INFO, "job", `Killed job ${this.name} (${pid}) (windows)`, this.metadata);
                return true;
            } else {
                log(LOGLEVEL.ERROR, "job", `Failed to kill job ${this.name} (${pid}) (windows) (${status})`, this.metadata);
                return false;
            }
        } else {
            let exec;

            const signalFlag = `-${method.substring(3).toLocaleLowerCase()}`;

            try {
                exec = await execSimple("kill", [signalFlag, pid.toString()], "linux process kill");
            } catch (error) {
                log(LOGLEVEL.ERROR, "job", `Exception killing process for job ${this.name}: ${(error as Error).message}`, this.metadata);
                this.broadcastUpdate();
                return false;
            }
            const status = await this.getStatus();
            this.clear();
            this.broadcastUpdate();
            if (status === JobStatus.STOPPED) {
                log(LOGLEVEL.INFO, "job", `Killed job ${this.name} (${pid}) (linux)`, this.metadata);
                return true;
            } else {
                log(LOGLEVEL.ERROR, "job", `Failed to kill job ${this.name} (${pid}) (linux) (${status})`, this.metadata);
                return false;
            }
        }
    }

    /**
     * Start logging to file from the attached process
     * @param filename 
     * @param start_text 
     */
    public startLog(filename: string, start_text: string): void {

        const logs_path = path.join(BaseConfigDataFolder.logs, "software");

        this.logfile = filename;

        const logfile = path.join(logs_path, filename);

        log(LOGLEVEL.DEBUG, "job", `Start log for job ${this.name} on path ${logfile}`, this.metadata);

        fs.writeFileSync(`${logfile}_stdout.log`, start_text, "utf8");
        fs.writeFileSync(`${logfile}_stderr.log`, start_text, "utf8");

        if (this.process) {
            log(LOGLEVEL.DEBUG, "job", `Attach log for job ${this.name} to process`, this.metadata);
            this.process.stdout.on("data", (data: Buffer) => {
                // TwitchlogAdvanced(LOGLEVEL.DEBUG, "job", `Job ${this.name} STDOUT: ${data}`, this.metadata);
                this.emit("stdout", data.toString());
                this.emit("log", "stdout", data.toString());
                this.stdout.push(data.toString());
                fs.appendFileSync(`${logfile}_stdout.log`, data, "utf8");
            });

            this.process.stderr.on("data", (data: Buffer) => {
                // TwitchlogAdvanced(LOGLEVEL.DEBUG, "job", `Job ${this.name} STDERR: ${data}`, this.metadata);
                this.emit("stderr", data.toString());
                this.emit("log", "stderr", data.toString());
                this.stderr.push(data.toString());
                fs.appendFileSync(`${logfile}_stderr.log`, data, "utf8");
            });
        } else {
            log(LOGLEVEL.DEBUG, "job", `No process attached for job ${this.name}`, this.metadata);
        }
    }

    private progressAccumulator = 0; // FIXME: i hate this implementation
    private progressUpdatesCleared = 0;
    public setProgress(progress: number): void {
        if (progress > this.progress) {
            // console.debug(`Job ${this.name} progress: ${progress}`);

            /*
            this.progressAccumulator += Math.abs(progress - this.progress);

            // only update if progress has changed by at least 2%
            if (this.progressAccumulator > 0.02) {
                this.progress = progress;
                // this.broadcastUpdate(true); // only send update if progress has changed by more than 5%
                Webhook.dispatch("job_progress", {
                    "job_name": this.name || "",
                    "progress": progress,
                });
                this.progressAccumulator = 0;
            } else {
                this.progress = progress;
                // console.debug(`Job ${this.name} did not change progress by more than 2%`);
            }
            */

            if (progress > this.progressAccumulator + 0.1) {
                log(LOGLEVEL.INFO, "job", `Job ${this.name} progress: ${Math.round(progress * 100)}%`, this.metadata);
                this.progressAccumulator = progress;
            }

            if (this._progressTimer) {
                // console.debug(`Job ${this.name} cancel update`);
                xClearTimeout(this._progressTimer);
                this.progressUpdatesCleared++;
            }
            if (this.progressUpdatesCleared > 5) {
                this.updateProgress(progress);
                this.progressUpdatesCleared = 0;
            } else {
                this._progressTimer = xTimeout(() => {
                    if (!this || (!this.dummy && this.status !== JobStatus.RUNNING)) return;
                    this.updateProgress(progress);
                    this.progressUpdatesCleared = 0;
                }, 2000);
            }
        } else {
            // console.debug(`Job ${this.name} less progress: ${progress} / ${this.progress}`);
        }
    }

    public updateProgress(progress: number): void {
        this.progress = progress;
        Webhook.dispatchAll("job_progress", {
            "job_name": this.name || "",
            "progress": progress,
        });
    }
    /**
     * Stop logging to file from the attached process
     */
    public stopLog() {
        if (this.process) {
            log(LOGLEVEL.DEBUG, "job", `Detach log for job ${this.name} from process`, this.metadata);
            this.process.stdout.removeAllListeners();
            this.process.stderr.removeAllListeners();
        }
    }

    public onClose(code: number | null) {
        this.emit("close", code);
        this.code = code;
        this.broadcastUpdate();
    }

    public toAPI(): ApiJob {
        return {
            name: this.name || "",
            pid: this.pid,
            process_running: this.process_running,
            status: this.status,
            progress: this.progress,
            dt_started_at: this.dt_started_at ? this.dt_started_at.toJSON() : "",
        };
    }

    public toJSON(): TwitchAutomatorJobJSON {
        return {
            name: this.name || "",
            pid: this.pid || 0,
            metadata: this.metadata,
            dt_started_at: this.dt_started_at?.toISOString() || "",
            bin: this.bin,
            args: this.args,
        };
    }

    public broadcastUpdate(noTimer = false) {
        if (this._updateTimer) xClearTimeout(this._updateTimer);
        if (!noTimer) {
            this._updateTimer = xTimeout(async () => {
                // console.debug(`Broadcasting job update for ${this.name}: ${this.status}`);

                try {
                    await this.getStatus();
                } catch (error) {
                    log(LOGLEVEL.ERROR, "job", `Broadcast job ${this.name} status error: ${(error as Error).message}`);
                }

                this.emit("update", this.toAPI());
                this._updateTimer = undefined;
                Webhook.dispatchAll(Job.hasJob(this.name) ? "job_update" : "job_clear", {
                    "job_name": this.name,
                    "job": this.toAPI(),
                });
            }, 2000);
        } else {
            // (async () => {
            // await this.getStatus();
            this.emit("update", this.toAPI());
            Webhook.dispatchAll(Job.hasJob(this.name) ? "job_update" : "job_clear", {
                "job_name": this.name,
                "job": this.toAPI(),
            });
            // }
            // )(); // ugly hack
        }
    }

}
