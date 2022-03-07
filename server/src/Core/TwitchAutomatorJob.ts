import path from "path";
import fs from "fs";
import { BaseConfigFolder } from "./BaseConfig";
import { LOGLEVEL, TwitchLog } from "./TwitchLog";
import { PHPDateTimeProxy } from "@/types";
import { TwitchHelper } from "./TwitchHelper";
import { parse } from "date-fns";
import { ChildProcessWithoutNullStreams } from "child_process";

export interface TwitchAutomatorJobJSON {
    name: string;
    pid: number;
    metadata: any;
    dt_started_at: PHPDateTimeProxy;
}

export class TwitchAutomatorJob
{

	static jobs: TwitchAutomatorJob[] = [];

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

    public name: string | undefined;
    public pid: number | undefined;
    public pidfile: string | undefined;
    public pidfile_simple: string | undefined;
    public metadata: any | undefined;
    public status: number | false | undefined;
    public error: number | undefined;
    public process: ChildProcessWithoutNullStreams | undefined;
    public dt_started_at: Date | undefined;	

	public stdout: string[] = [];
	public stderr: string[] = [];
	
	logfile: string = "";

	private realpath(str: string): string {
		return path.normalize(str);
	}

	public static loadJobsFromCache() {
		const jobs = fs.readdirSync(BaseConfigFolder.pids).filter(f => f.endsWith(".json"));
		for (const job_data of jobs){
			TwitchAutomatorJob.load(job_data.replace(".json", ""));
		}
		TwitchLog.logAdvanced(LOGLEVEL.INFO, `job`, `Loaded ${jobs.length} jobs from cache`);

		this.checkStaleJobs();
	}

	public static async checkStaleJobs() {
		const now = new Date();
		for (const job of this.jobs) {
			if (await job.getStatus() == false) {
				TwitchLog.logAdvanced(LOGLEVEL.WARNING, `job`, `Job ${job.name} is stale, no process found. Clearing.`);
				job.clear();
			} else {
				TwitchLog.logAdvanced(LOGLEVEL.INFO, `job`, `Job ${job.name} is still running from previous session.`);
			}
			// if (job.dt_started_at && job.dt_started_at.getTime() + (60 * 1000) < now.getTime()) {
			// 	job.clear();
			// }
		}
	}

	public static create(name: string): TwitchAutomatorJob
	{

        const basepath = BaseConfigFolder.pids;

		// if(file_exists(TwitchHelper::$pids_folder . DIRECTORY_SEPARATOR . $name . ".json")){
		// 	TwitchLog.logAdvanced(LOGLEVEL.WARNING, "job", "Creating job {$name} overwrites existing!");
		// }
        
		if (fs.existsSync(path.join(basepath, name + ".json"))) {
            TwitchLog.logAdvanced(LOGLEVEL.WARNING, "job", `Creating job ${name} overwrites existing!`);
        }

		let job = new this();
		job.name = name;
		job.pidfile = job.realpath(path.join(basepath, name + ".json"));
		job.pidfile_simple = job.realpath(path.join(basepath, name + ".pid"));
		job.dt_started_at = new Date();
		
		return job;
	}

	public static load(name: string): TwitchAutomatorJob | false
	{

		TwitchLog.logAdvanced(LOGLEVEL.DEBUG, `job`, `Loading job ${name}`);

		const memJob = this.jobs.find(job => job.name === name);
		if (memJob) {
			TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "job", `Job ${name} found in memory`);
			return memJob;
		}

        const basepath = BaseConfigFolder.pids;

		let job = new this();
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

		job.dt_started_at = data.dt_started_at ? parse(data.dt_started_at.date, TwitchHelper.PHP_DATE_FORMAT, new Date()) : undefined;

		// TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "job", "Job {$this->name} loaded, proceed to get status.", $this->metadata);

		if (!TwitchAutomatorJob.jobs.includes(job)) {
			TwitchAutomatorJob.jobs.push(job);
			TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "job", `Loaded job ${job.name} added to jobs list`, job.metadata);
		}

		// $this->getStatus();
		return job;
		
	}

	/**
	 * Save to disk, like when the process starts
	 *
	 * @return bool
	 */
	save()
	{
        if (!this.pidfile) {
            throw new Error("pidfile not set");
        }

		TwitchLog.logAdvanced(LOGLEVEL.INFO, "job", `Save job ${this.name} with PID ${this.pid} to ${this.pidfile}`, this.metadata);

		TwitchHelper.webhook({
			'action': 'job_save',
			'job_name': this.name,
			'job': this
        });

		//return file_put_contents($this->pidfile, json_encode($this)) != false;
        fs.writeFileSync(this.pidfile, JSON.stringify(this), "utf8");

		const exists = fs.existsSync(this.pidfile);

		TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "job", `Job ${this.name} ${exists ? "saved" : "failed to save"}`, this.metadata);

		if (exists && !TwitchAutomatorJob.jobs.includes(this)) {
			TwitchAutomatorJob.jobs.push(this);
			TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "job", `New job ${this.name} added to jobs list`, this.metadata);
		}

        return exists;
	}

	/**
	 * Remove from disk, like when the process quits
	 *
	 * @return bool success
	 */
	clear()
	{
		// if (this.process) {
		// 	this.process = null;
		// }

        if (!this.pidfile) {
            throw new Error("pidfile not set");
        }

		if (fs.existsSync(this.pidfile)) {
			TwitchLog.logAdvanced(LOGLEVEL.INFO, "job", `Clear job ${this.name} with PID ${this.pid}`, this.metadata);
			
			TwitchHelper.webhook({
				'action': 'job_clear',
				'job_name': this.name,
				'job': this
            });

            fs.unlinkSync(this.pidfile);
            return !fs.existsSync(this.pidfile);
		}

		if (TwitchAutomatorJob.jobs.includes(this)) {
			TwitchAutomatorJob.jobs.splice(TwitchAutomatorJob.jobs.indexOf(this), 1);
			TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "job", `Job ${this.name} removed from jobs list`, this.metadata);
		}

		return false;
	}

	/**
	 * Set process PID
	 *
	 * @param int $pid
	 * @return void
	 */
	setPid(pid: number)
	{
		this.pid = pid;
		TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "job", `Set PID ${pid} for job ${this.name}`, this.metadata);
	}

	/**
	 * Get process PID
	 *
	 * @return int Process ID
	 */
	getPid()
	{
		// if (!$this->pid) {
		// 	$this->load();
		// }
		return this.pid;
	}

	/**
	 * Attach process
	 *
	 * @param Process $process
	 * @return void
	 */
	setProcess(process: ChildProcessWithoutNullStreams)
	{
		this.process = process;
		TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "job", `Set process for job ${this.name}`, this.metadata);
	}

	/**
	 * Attach metadata
	 *
	 * @param array $metadata
	 * @return void
	 */
	setMetadata(metadata: any)
	{
		this.metadata = metadata;
	}

	/**
	 * Get running status of job, PID if running.
	 *
	 * @return int|false
	 */
	async getStatus()
	{
		TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "job", `Check status for job ${this.name}`, this.metadata);

		if (!this.pid) {
			throw new Error("No pid set on job");
		}

		let output = "";
		if (TwitchHelper.is_windows()) {
			const proc = await TwitchHelper.execSimple("tasklist", [`/FI`, `PID eq ${this.pid}`]);
			output = proc.stdout.join("\n");
		} else {
			const proc = await TwitchHelper.execSimple("ps", ["-p", this.pid.toString()]);
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
            TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "job", `PID file check for '${this.name}', process is running`);
            this.status = this.pid;
            return this.pid;
        } else {
            TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "job", `PID file check for '${this.name}', process does not exist`);
            this.status = false;
            return false;
        }
	}

	/**
	 * Quit the process via PID
	 *
	 * @return string kill output
	 */
	kill()
	{
		if (this.process) {
			return this.process.kill();
		}

        const pid = this.getPid();

        if (!pid) {
            return false;
        }

		const exec = TwitchHelper.exec(["kill", pid.toString()]);
		this.clear();
		return exec;
	}

	startLog(filename: string, start_text: string) {

		const logs_path = path.join(BaseConfigFolder.logs, "software");
		
		this.logfile = filename;

		const logfile = path.join(logs_path, filename);

		TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "job", `Start log for job ${this.name} on path ${logfile}`, this.metadata);

		fs.writeFileSync(`${logfile}_stdout.log`, start_text, "utf8");
		fs.writeFileSync(`${logfile}_stderr.log`, start_text, "utf8");

		if (this.process) {
			TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "job", `Attach log for job ${this.name} to process`, this.metadata);
			this.process.stdout.on('data', (data: any) => {
				// TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "job", `Job ${this.name} STDOUT: ${data}`, this.metadata);
				this.stdout.push(data);
				fs.appendFileSync(`${logfile}_stdout.log`, data, "utf8");
			});

			this.process.stderr.on('data', (data: any) => {
				// TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "job", `Job ${this.name} STDERR: ${data}`, this.metadata);
				this.stderr.push(data);
				fs.appendFileSync(`${logfile}_stderr.log`, data, "utf8");
			});
		} else {
			TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "job", `No process attached for job ${this.name}`, this.metadata);
		}
	}

	stopLog() {
		if (this.process) {
			TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "job", `Detach log for job ${this.name} from process`, this.metadata);
			this.process.stdout.removeAllListeners();
			this.process.stderr.removeAllListeners();
		}
	}

}
