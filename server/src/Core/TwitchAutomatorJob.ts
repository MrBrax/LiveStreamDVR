import path from "path";
import fs from "fs";
import { BaseConfigDataFolder } from "./BaseConfig";
import { LOGLEVEL, TwitchLog } from "./TwitchLog";
import { ExecReturn, TwitchHelper } from "./TwitchHelper";
import { parseISO } from "date-fns";
import { ChildProcessWithoutNullStreams } from "child_process";
import { EventEmitter } from "events";
import { TwitchWebhook } from "./TwitchWebhook";
import { ApiJob } from "../../../common/Api/Client";

export interface TwitchAutomatorJobJSON {
    name: string;
    pid: number;
    metadata: unknown;
    dt_started_at: string;
}

export class TwitchAutomatorJob extends EventEmitter {

    static jobs: TwitchAutomatorJob[] = [];
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
    public metadata: unknown | undefined;
    public status: number | false = false;
    public error: number | undefined;

    public process: ChildProcessWithoutNullStreams | undefined;
    public process_running = false;

    public dt_started_at: Date | undefined;

    public stdout: string[] = [];
    public stderr: string[] = [];
    public code: number | null = null;

    logfile = "";

    private _updateTimer: NodeJS.Timeout | undefined;

    private realpath(str: string): string {
        return path.normalize(str);
    }

    public static loadJobsFromCache() {
        const jobs = fs.readdirSync(BaseConfigDataFolder.pids).filter(f => f.endsWith(".json"));
        for (const job_data of jobs) {
            TwitchAutomatorJob.load(job_data.replace(".json", ""));
        }
        TwitchLog.logAdvanced(LOGLEVEL.INFO, "job", `Loaded ${jobs.length} jobs from cache`);

        this.checkStaleJobs();
    }

    public static async checkStaleJobs() {
        // const now = new Date();
        for (const job of this.jobs) {
            if (await job.getStatus(true) == false) {
                TwitchLog.logAdvanced(LOGLEVEL.WARNING, "job", `Job ${job.name} is stale, no process found. Clearing.`);
                job.clear();
            } else {
                TwitchLog.logAdvanced(LOGLEVEL.INFO, "job", `Job ${job.name} is still running from previous session.`);
            }
            // if (job.dt_started_at && job.dt_started_at.getTime() + (60 * 1000) < now.getTime()) {
            // 	job.clear();
            // }
        }
    }

    public static create(name: string): TwitchAutomatorJob {

        const basepath = BaseConfigDataFolder.pids;

        // if(file_exists(TwitchHelper::$pids_folder . DIRECTORY_SEPARATOR . $name . ".json")){
        // 	TwitchLog.logAdvanced(LOGLEVEL.WARNING, "job", "Creating job {$name} overwrites existing!");
        // }

        if (fs.existsSync(path.join(basepath, name + ".json"))) {
            TwitchLog.logAdvanced(LOGLEVEL.WARNING, "job", `Creating job ${name} overwrites existing!`);
        }

        const job = new this();
        job.name = name;
        job.pidfile = job.realpath(path.join(basepath, name + ".json"));
        job.pidfile_simple = job.realpath(path.join(basepath, name + ".pid"));
        job.dt_started_at = new Date();

        return job;
    }

    public static load(name: string): TwitchAutomatorJob | false {

        TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "job", `Loading job ${name}`);

        const memJob = this.jobs.find(job => job.name === name);
        if (memJob) {
            TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "job", `Job ${name} found in memory`);
            return memJob;
        }

        const basepath = BaseConfigDataFolder.pids;

        const job = new this();
        job.name = name;
        job.pidfile = job.realpath(path.join(basepath, `${name}.json`));
        job.pidfile_simple = job.realpath(path.join(basepath, `${name}.pid`));
        job.dt_started_at = new Date();

        // if no pid file
        if (!fs.existsSync(job.pidfile)) {
            TwitchLog.logAdvanced(LOGLEVEL.ERROR, "job", `Loading job ${job.name} failed, no json file`, job.metadata);
            // return job.loadSimple();
            job.error = this.NO_FILE;
            return false;
        }

        // read pid file
        const raw = fs.readFileSync(job.pidfile, "utf8");
        if (!raw) {
            TwitchLog.logAdvanced(LOGLEVEL.ERROR, "job", `Loading job ${job.name} failed, no data in json file`, job.metadata);
            job.error = this.NO_DATA;
            return false;
        }

        const data: TwitchAutomatorJobJSON = JSON.parse(raw);

        job.pid = data.pid;

        job.dt_started_at = data.dt_started_at ? parseISO(data.dt_started_at) : undefined;

        // TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "job", "Job {$this->name} loaded, proceed to get status.", $this->metadata);

        if (!TwitchAutomatorJob.jobs.includes(job)) {
            TwitchAutomatorJob.jobs.push(job);
            TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "job", `Loaded job ${job.name} added to jobs list`, job.metadata);
        }

        // $this->getStatus();
        return job;

    }

    public static hasJob(name: string): boolean {
        return this.jobs.some(job => job.name === name);
    }

    public static findJob(search: string): TwitchAutomatorJob | false {
        const job = this.jobs.find(job => job.name?.includes(search));
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

        TwitchLog.logAdvanced(LOGLEVEL.INFO, "job", `Save job ${this.name} with PID ${this.pid} to ${this.pidfile}`, this.metadata);

        TwitchWebhook.dispatch("job_save", {
            "job_name": this.name,
            "job": this.toAPI(),
        });

        //return file_put_contents($this->pidfile, json_encode($this)) != false;
        // console.debug("job save", this);

        let json_data;
        try {
            json_data = JSON.stringify(this);
        } catch (e) {
            TwitchLog.logAdvanced(LOGLEVEL.FATAL, "job", `Failed to stringify job ${this.name}`, this.metadata);
            return false;
        }

        fs.writeFileSync(this.pidfile, json_data, "utf8");

        const exists = fs.existsSync(this.pidfile);

        TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "job", `Job ${this.name} ${exists ? "saved" : "failed to save"}`, this.metadata);

        if (exists && !TwitchAutomatorJob.jobs.includes(this)) {
            TwitchAutomatorJob.jobs.push(this);
            TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "job", `New job ${this.name} added to jobs list`, this.metadata);
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

        if (!this.pidfile) {
            throw new Error("pidfile not set");
        }

        this.emit("pre_clear");

        if (fs.existsSync(this.pidfile)) {
            TwitchLog.logAdvanced(LOGLEVEL.INFO, "job", `Clear job ${this.name} with PID ${this.pid}`, this.metadata);

            TwitchWebhook.dispatch("job_clear", {
                "job_name": this.name || "",
                "job": this.toAPI(),
            });

            fs.unlinkSync(this.pidfile);
            // return !fs.existsSync(this.pidfile);
        }

        if (TwitchAutomatorJob.hasJob(this.name || "")) {
            TwitchAutomatorJob.jobs = TwitchAutomatorJob.jobs.filter(job => job.name !== this.name);
            TwitchLog.logAdvanced(LOGLEVEL.SUCCESS, "job", `Job ${this.name} removed from jobs list`, this.metadata);
        } else {
            TwitchLog.logAdvanced(LOGLEVEL.WARNING, "job", `Job ${this.name} not found in jobs list`, this.metadata);
        }

        this.emit("clear");

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
        TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "job", `Set PID ${pid} for job ${this.name}`, this.metadata);
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

    /**
     * Attach process to job, possibly avoiding the need to check running processes
     *
     * @param {Process} process Process to attach
     * @return void
     */
    public setProcess(process: ChildProcessWithoutNullStreams): void {
        this.emit("process_set", this.process, process);
        this.process = process;
        TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "job", `Set process for job ${this.name}`, this.metadata);

        this.process_running = process.pid !== undefined; // @todo: check if process is running

        this.process.on("exit", (code, signal) => {
            this.emit("process_exit", code, signal);
            this.process_running = false;
        });

        this.process.on("error", (err) => {
            this.emit("process_error", err);
            this.process_running = false;
        });

        this.process.on("close", (code, signal) => {
            this.emit("process_close", code, signal);
            this.process_running = false;
        });

        this.broadcastUpdate();

        /*
        this.process.on("close", (code, signal) => {
            TwitchLog.logAdvanced(LOGLEVEL.INFO, "job", `Process for job ${this.name} exited with code ${code} and signal ${signal}`, this.metadata);
            this.emit("close", code, signal);
        }
        */
    }

    /**
     * Attach metadata
     *
     * @param {any} metadata An object or array or any other data to attach
     * @return {void}
     */
    public setMetadata(metadata: unknown): void {
        this.emit("metadata_set", this.metadata, metadata);
        this.metadata = metadata;
        this.broadcastUpdate();
    }

    /**
     * Get running status of job, PID if running.
     *
     * @param {boolean} use_command Use command to check if running, instead of relying on events.
     * @throws {Error}
     * @returns {(int|false)} PID if running, false if not.
     */
    public async getStatus(use_command = false): Promise<number | false> {

        TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "job", `Check status for job ${this.name}`, this.metadata);

        if (!this.pid) {
            throw new Error("No pid set on job");
        }

        // broadcast only if changed status
        const currentStatus = this.status;

        // @todo: check if this works
        if (this.process && !use_command) {
            this.status = this.process_running && this.process.pid ? this.process.pid : false;
            if (currentStatus !== this.status) this.broadcastUpdate();
            return this.process_running && this.process.pid ? this.process.pid : false;
        }

        let output = "";
        if (TwitchHelper.is_windows()) {

            let proc;
            try {
                proc = await TwitchHelper.execSimple("tasklist", ["/FI", `PID eq ${this.pid}`], `windows process status (${this.name})`);
            } catch (e) {
                TwitchLog.logAdvanced(LOGLEVEL.ERROR, "job", `Error checking status for job ${this.name} (${this.process_running})`, this.metadata);
                console.debug(`Error checking status for job ${this.name} (${this.process_running})`);
                this.status = false;
                if (currentStatus !== this.status) this.broadcastUpdate();
                return false;
            }

            output = proc.stdout.join("\n");

        } else {

            let proc;
            try {
                proc = await TwitchHelper.execSimple("ps", ["-p", this.pid.toString()], `linux process status (${this.name})`);
            } catch (e) {
                TwitchLog.logAdvanced(LOGLEVEL.ERROR, "job", `Error checking status for job ${this.name} (${this.process_running})`, this.metadata);
                console.debug(`Error checking status for job ${this.name} (${this.process_running})`);
                this.status = false;
                if (currentStatus !== this.status) this.broadcastUpdate();
                return false;
            }

            output = proc.stdout.join("\n");

        }

        /*
        if (mb_strpos($output, (string)$this->pid) !== false) {
            TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "job", "PID file check for '{$this->name}', process is running");
            $this->status = $this->pid;
            return $this->pid;
        } else {
            TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "job", "PID file check for '{$this->name}', process does not exist");
            $this->status = false;
            return false;
        }
        */
        if (output.indexOf(this.pid.toString()) !== -1) {
            TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "job", `PID file check for '${this.name}', process is running (${this.process_running})`);
            // console.debug(`PID file check for '${this.name}', process is running (${this.process_running})`);
            this.status = this.pid;
            if (currentStatus !== this.status) this.broadcastUpdate();
            return this.pid;
        } else {
            TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "job", `PID file check for '${this.name}', process does not exist (${this.process_running})`);
            // console.debug(`PID file check for '${this.name}', process does not exist (${this.process_running})`);
            this.status = false;
            if (currentStatus !== this.status) this.broadcastUpdate();
            return false;
        }
    }

    /**
     * Quit the process via PID
     * 
     * @param {NodeJS.Signals} method Method to use to quit process
     * @returns {Promise<false|ExecReturn>} False if no PID set, otherwise the result of the quit command
     */
    public async kill(method: NodeJS.Signals = "SIGTERM"): Promise<false | ExecReturn> {
        if (this.process) {
            this.process.kill(method);
        }

        const pid = this.getPid();

        this.emit("pre_kill", method);

        if (!pid) {
            TwitchLog.logAdvanced(LOGLEVEL.WARNING, "job", `Kill process for job ${this.name}, PID not found`, this.metadata);
            this.clear();
            this.broadcastUpdate();
            return false;
        }

        if (TwitchHelper.is_windows()) {
            const exec = await TwitchHelper.execSimple("taskkill", ["/F", "/PID", `${pid}`], "windows process kill");
            this.clear();
            this.broadcastUpdate();
            return exec;
        } else {
            const exec = await TwitchHelper.execSimple("kill", [pid.toString()], "linux process kill");
            this.clear();
            this.broadcastUpdate();
            return exec;
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

        TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "job", `Start log for job ${this.name} on path ${logfile}`, this.metadata);

        fs.writeFileSync(`${logfile}_stdout.log`, start_text, "utf8");
        fs.writeFileSync(`${logfile}_stderr.log`, start_text, "utf8");

        if (this.process) {
            TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "job", `Attach log for job ${this.name} to process`, this.metadata);
            this.process.stdout.on("data", (data: Buffer) => {
                // TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "job", `Job ${this.name} STDOUT: ${data}`, this.metadata);
                this.emit("stdout", data.toString());
                this.emit("log", "stdout", data.toString());
                this.stdout.push(data.toString());
                fs.appendFileSync(`${logfile}_stdout.log`, data, "utf8");
            });

            this.process.stderr.on("data", (data: Buffer) => {
                // TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "job", `Job ${this.name} STDERR: ${data}`, this.metadata);
                this.emit("stderr", data.toString());
                this.emit("log", "stderr", data.toString());
                this.stderr.push(data.toString());
                fs.appendFileSync(`${logfile}_stderr.log`, data, "utf8");
            });
        } else {
            TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "job", `No process attached for job ${this.name}`, this.metadata);
        }
    }

    /**
     * Stop logging to file from the attached process
     */
    public stopLog() {
        if (this.process) {
            TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "job", `Detach log for job ${this.name} from process`, this.metadata);
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
        };
    }

    public toJSON(): TwitchAutomatorJobJSON {
        return {
            name: this.name || "",
            pid: this.pid || 0,
            metadata: this.metadata,
            dt_started_at: this.dt_started_at?.toISOString() || "",
        };
    }

    public broadcastUpdate() {
        if (this._updateTimer) clearTimeout(this._updateTimer);
        this._updateTimer = setTimeout(() => {
            console.debug(`Broadcasting job update for ${this.name}`);
            this.emit("update", this.toAPI());
            this._updateTimer = undefined;
            TwitchWebhook.dispatch(TwitchAutomatorJob.hasJob(this.name || "") ? "job_update" : "job_clear", {
                "job_name": this.name || "",
                "job": this.toAPI(),
            });
        }, 2000);
    }

}
