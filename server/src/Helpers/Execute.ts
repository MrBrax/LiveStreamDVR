import { Config } from "@/Core/Config";
import { Job } from "@/Core/Job";
import { LOGLEVEL, log } from "@/Core/Log";
import chalk from "chalk";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { spawn } from "node:child_process";
import type { Stream } from "node:stream";

/**
 * A tuple-like type representing the return value of execSimple and execAdvanced
 */
export interface ExecReturn {
    /** stdout of the process, as an array of strings */
    stdout: string[];
    /** stderr of the process, as an array of strings */
    stderr: string[];
    /** The exit code of the process */
    code: number;
    /** The binary that was executed */
    bin?: string;
    /** The arguments that were passed to the binary */
    args?: string[];
    /** A description of what was executed */
    what?: string;
}

class ExecError extends Error {
    public code: number | null;
    public stdout: string[];
    public stderr: string[];
    public bin?: string;
    public args?: string[];
    public what?: string;

    constructor(
        message: string,
        code: number | null,
        stdout: string[],
        stderr: string[],
        bin?: string,
        args?: string[],
        what?: string
    ) {
        super(message);
        this.code = code;
        this.stdout = stdout;
        this.stderr = stderr;
        this.bin = bin;
        this.args = args;
        this.what = what;
    }
}

interface RunningProcess {
    internal_pid: number;
    process: ChildProcessWithoutNullStreams;
    // env: Record<string, string>;
    // cwd: string;
    what: string;
}

let InternalPid = 0;
const RunningProcesses: RunningProcess[] = [];

/**
 * Execute a command and return the output
 *
 * @param bin - The binary to execute
 * @param args - The arguments to pass to the binary
 * @param what - A description of what is being executed, for logging purposes
 * @throws Exception
 * @returns
 */
export function execSimple(
    bin: string,
    args: string[],
    what: string
): Promise<ExecReturn> {
    return new Promise((resolve, reject) => {
        const stdout: string[] = [];
        const stderr: string[] = [];

        const process = spawn(bin, args || [], {
            // detached: true,
            windowsHide: true,
        });

        const pid = process.pid;

        process.on("error", (err) => {
            log(
                LOGLEVEL.ERROR,
                "helper.execSimple",
                `Process ${pid} for '${what}' error: ${err}`
            );
            console.error(err);
            reject(
                new ExecError(
                    `Process ${pid} for '${what}' error: ${err}`,
                    -1,
                    stdout,
                    stderr,
                    bin,
                    args,
                    what
                )
            );
        });

        log(
            LOGLEVEL.EXEC,
            "helper.execSimple",
            `Executing '${what}': $ ${bin} ${args.join(" ")}`
        );

        process.stdout.on("data", (data: Stream) => {
            if (Config.debug)
                console.debug(
                    chalk.bold.green(
                        `$ ${bin} ${args.join(" ")}\n`,
                        chalk.green(`${data.toString().trim()}`)
                    )
                );
            stdout.push(data.toString());
        });

        process.stderr.on("data", (data: Stream) => {
            if (Config.debug)
                console.error(
                    chalk.bold.red(
                        `$ ${bin} ${args.join(" ")}\n`,
                        chalk.red(`> ${data.toString().trim()}`)
                    )
                );
            stderr.push(data.toString());
        });

        process.on("close", (code) => {
            log(
                LOGLEVEL.INFO,
                "helper.execSimple",
                `Process ${pid} for '${what}' exited with code ${code}`
            );

            if (code == 0) {
                resolve({ code, stdout, stderr, bin, args, what });
            } else {
                // reject({ code, stdout, stderr, bin, args, what });
                reject(
                    new ExecError(
                        `Process ${pid} for '${what}' exited with code ${code}`,
                        code,
                        stdout,
                        stderr,
                        bin,
                        args,
                        what
                    )
                );
            }
        });

        RunningProcesses.push({ process, what, internal_pid: InternalPid++ });
        process.on("close", () => {
            const index = RunningProcesses.findIndex(
                (p) => p.process.pid == pid
            );
            if (index >= 0) {
                RunningProcesses.splice(index, 1);
            }
        });
    });
}

export function isExecReturn(
    execReturn: ExecReturn | unknown
): execReturn is ExecReturn {
    return (
        typeof execReturn === "object" &&
        execReturn !== null &&
        "code" in execReturn &&
        "stdout" in execReturn &&
        "stderr" in execReturn &&
        "bin" in execReturn &&
        "args" in execReturn &&
        "what" in execReturn
    );
}

export function isExecError(
    execError: ExecError | unknown
): execError is ExecError {
    return execError instanceof ExecError;
}

/**
 * Execute a command, make a job, and when it's done, return the output
 *
 * @param bin - The binary to execute
 * @param args - The arguments to pass to the binary
 * @param jobName - The name of the job to create
 * @param progressFunction - Return a number between 0 and 1 to set the progress of the job
 * @returns
 */
export function execAdvanced(
    bin: string,
    args: string[],
    jobName: string,
    progressFunction?: (log: string) => number | undefined
): Promise<ExecReturn> {
    return new Promise((resolve, reject) => {
        const stdout: string[] = [];
        const stderr: string[] = [];

        const process = spawn(bin, args || [], {
            // detached: true,
            // windowsHide: true,
        });

        process.on("error", (err) => {
            log(
                LOGLEVEL.ERROR,
                "helper.execAdvanced",
                `Process ${process.pid} error: ${err}`
            );
            // reject({ code: -1, stdout, stderr, bin, args, jobName });
        });

        log(
            LOGLEVEL.EXEC,
            "helper.execAdvanced",
            `Executing job '${jobName}': $ ${bin} ${args.join(" ")}`
        );

        let job: Job;

        if (process.pid) {
            log(
                LOGLEVEL.SUCCESS,
                "helper.execAdvanced",
                `Spawned process ${process.pid} for ${jobName}`
            );
            job = Job.create(jobName);
            job.setPid(process.pid);
            job.setExec(bin, args);
            job.setProcess(process);
            job.startLog(jobName, `$ ${bin} ${args.join(" ")}\n`);
            if (!job.save()) {
                log(
                    LOGLEVEL.ERROR,
                    "helper.execAdvanced",
                    `Failed to save job ${jobName}`
                );
            }
        } else {
            log(
                LOGLEVEL.ERROR,
                "helper.execAdvanced",
                `Failed to spawn process for ${jobName}`
            );
            // reject(new Error(`Failed to spawn process for ${jobName}`));
        }

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
                log(
                    LOGLEVEL.INFO,
                    "helper.execAdvanced",
                    `Process ${process.pid} for ${jobName} exited with code 0`
                );
                resolve({ code, stdout, stderr });
            } else {
                log(
                    LOGLEVEL.ERROR,
                    "helper.execAdvanced",
                    `Process ${process.pid} for ${jobName} exited with code ${code}`
                );
                // reject({ code, stdout, stderr });
                reject(
                    new ExecError(
                        `Process ${process.pid} for ${jobName} exited with code ${code}`,
                        code,
                        stdout,
                        stderr,
                        bin,
                        args,
                        jobName
                    )
                );
            }
        });

        RunningProcesses.push({
            process,
            what: jobName,
            internal_pid: InternalPid++,
        });
        process.on("close", () => {
            const index = RunningProcesses.findIndex(
                (p) => p.process.pid == process.pid
            );
            if (index >= 0) {
                RunningProcesses.splice(index, 1);
            }
        });

        log(
            LOGLEVEL.INFO,
            "helper.execAdvanced",
            `Attached to all streams for process ${process.pid} for ${jobName}`
        );
    });
}

/**
 * Spawns a new process with the given binary and arguments, and returns a Job object to track its progress.
 * @param jobName - The name of the job to be executed.
 * @param bin - The binary to be executed.
 * @param args - The arguments to be passed to the binary.
 * @param env - An optional object containing environment variables to be set for the process.
 * @returns A Job object representing the spawned process, or false if the process failed to spawn.
 */
export function startJob(
    jobName: string,
    bin: string,
    args: string[],
    env: Record<string, string> = {}
): Job | false {
    const envs = Object.keys(env).length > 0 ? env : process.env;

    const stdout: string[] = [];
    const stderr: string[] = [];

    const jobProcess = spawn(bin, args || [], {
        // detached: true,
        windowsHide: true,
        env: envs,
    });

    console.log("startJob process", jobProcess.spawnfile, jobProcess.spawnargs);

    jobProcess.on("error", (err) => {
        log(
            LOGLEVEL.ERROR,
            "exec.startJob",
            `Process '${jobProcess.pid}' on job '${jobName}' error: ${err}`,
            {
                bin,
                args,
                jobName,
                stdout,
                stderr,
            }
        );
    });

    log(LOGLEVEL.INFO, "exec.startJob", `Executing ${bin} ${args.join(" ")}`);

    let job: Job | false = false;

    if (jobProcess.pid) {
        log(
            LOGLEVEL.SUCCESS,
            "exec.startJob",
            `Spawned process ${jobProcess.pid} for ${jobName}`
        );
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
            log(
                LOGLEVEL.ERROR,
                "exec.startJob",
                `Failed to save job ${jobName}`
            );
        }
    } else {
        log(
            LOGLEVEL.ERROR,
            "exec.startJob",
            `Failed to spawn process for ${jobName}`
        );
        // reject(new Error(`Failed to spawn process for ${jobName}`));
    }

    jobProcess.stdout.on("data", (data: Stream) => {
        stdout.push(data.toString());
    });

    jobProcess.stderr.on("data", (data: Stream) => {
        stderr.push(data.toString());
    });

    jobProcess.on("close", (code) => {
        if (code == 0) {
            log(
                LOGLEVEL.SUCCESS,
                "exec.startJob",
                `Process ${jobProcess.pid} for ${jobName} closed with code 0`
            );
        } else {
            log(
                LOGLEVEL.ERROR,
                "exec.startJob",
                `Process ${jobProcess.pid} for ${jobName} closed with code ${code}`
            );
        }

        if (typeof job !== "boolean") {
            job.onClose(code);
            job.clear(); // ?
        }
    });

    RunningProcesses.push({
        process: jobProcess,
        what: jobName,
        internal_pid: InternalPid++,
    });
    jobProcess.on("close", () => {
        const index = RunningProcesses.findIndex(
            (p) => p.process.pid == jobProcess.pid
        );
        if (index >= 0) {
            RunningProcesses.splice(index, 1);
        }
    });

    log(
        LOGLEVEL.INFO,
        "exec.startJob",
        `Attached to all streams for process ${jobProcess.pid} for ${jobName}`
    );

    return job;
}

export function GetRunningProcesses(): RunningProcess[] {
    return RunningProcesses;
}

export function GetRunningProcessByPid(
    pid: number
): RunningProcess | undefined {
    return RunningProcesses.find((p) => p.process.pid == pid);
}
