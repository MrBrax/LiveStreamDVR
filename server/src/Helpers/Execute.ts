import { Config } from "@/Core/Config";
import { Job } from "@/Core/Job";
import { LOGLEVEL, log } from "@/Core/Log";
import chalk from "chalk";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { spawn } from "node:child_process";
import type { Stream } from "node:stream";
import type { ExecReturn } from "../Providers/Twitch";

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
 * @param bin
 * @param args
 * @param what
 * @throws Exception
 * @returns
 */
export function execSimple(
    bin: string,
    args: string[],
    what: string
): Promise<ExecReturn> {
    return new Promise((resolve, reject) => {
        const process = spawn(bin, args || [], {
            // detached: true,
            windowsHide: true,
        });

        process.on("error", (err) => {
            log(
                LOGLEVEL.ERROR,
                "helper.execSimple",
                `Process ${pid} for '${what}' error: ${err}`
            );
            reject({ code: -1, stdout, stderr, bin, args, what });
        });

        const pid = process.pid;

        log(
            LOGLEVEL.EXEC,
            "helper.execSimple",
            `Executing '${what}': $ ${bin} ${args.join(" ")}`
        );

        const stdout: string[] = [];
        const stderr: string[] = [];

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
                reject({ code, stdout, stderr, bin, args, what });
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

/**
 * Execute a command, make a job, and when it's done, return the output
 *
 * @param bin
 * @param args
 * @param jobName
 * @param progressFunction
 * @returns
 */
export function execAdvanced(
    bin: string,
    args: string[],
    jobName: string,
    progressFunction?: (log: string) => number | undefined
): Promise<ExecReturn> {
    return new Promise((resolve, reject) => {
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
            reject({ code: -1, stdout, stderr, bin, args, jobName });
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
                reject({ code, stdout, stderr });
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

export function startJob(
    jobName: string,
    bin: string,
    args: string[],
    env: Record<string, string> = {}
): Job | false {
    const envs = Object.keys(env).length > 0 ? env : process.env;

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
