import { Job } from "@/Core/Job";
import { LOGLEVEL, log } from "@/Core/Log";
import type { ApiErrorResponse, ApiJobsResponse } from "@common/Api/Api";
import type express from "express";

export async function ListJobs(
    req: express.Request,
    res: express.Response
): Promise<void> {
    const jobs = Job.jobs;

    for (const job of jobs) {
        await job.getStatus();
    }

    res.api<ApiJobsResponse>(200, {
        data: jobs.map((job) => job.toAPI()),
        status: "OK",
    });
}

export async function KillJob(
    req: express.Request,
    res: express.Response
): Promise<void> {
    let job: Job | boolean;

    if (req.params.name.endsWith("*")) {
        const name = req.params.name.slice(0, -1);
        job = Job.findJobThatStartsWith(name);
    } else {
        job = Job.getJob(req.params.name);
    }

    const clear = req.query.clear;
    const method: NodeJS.Signals =
        req.query.method !== undefined && req.query.method !== ""
            ? (req.query.method as NodeJS.Signals)
            : "SIGTERM";

    if (!job) {
        res.api(404, {
            status: "ERROR",
            message: `Job '${req.params.name}' not found`,
        } as ApiErrorResponse);
        return;
    }

    log(
        LOGLEVEL.INFO,
        "route.jobs.kill",
        `Killing job ${job.name} with clear=${clear} and method=${method}`
    );

    if (clear) {
        const success = job.clear();

        if (success) {
            res.api(200, {
                status: "OK",
                message: "Job cleared",
            });
        } else {
            res.api(500, {
                status: "ERROR",
                message: "Job could not be cleared.",
            } as ApiErrorResponse);
        }

        return;
    }

    const success = await job.kill(method);

    if (success) {
        res.api(200, {
            status: "OK",
            message: "Job killed",
        });
    } else {
        res.api(400, {
            status: "ERROR",
            message: "Job could not be killed.",
        } as ApiErrorResponse);
    }
}

export function DetachJobProcess(
    req: express.Request,
    res: express.Response
): void {
    const job = Job.getJob(req.params.name);

    if (!job) {
        res.api(400, {
            status: "ERROR",
            message: `Job '${req.params.name}' not found`,
        } as ApiErrorResponse);
        return;
    }

    job.detachProcess();

    res.api(200, {
        status: "OK",
        message: `Job ${req.params.name} detached`,
    });
}
