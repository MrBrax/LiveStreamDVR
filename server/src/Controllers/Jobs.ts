import { Job } from "../Core/Job";
import express from "express";
import { ApiErrorResponse, ApiJobsResponse } from "../../../common/Api/Api";
import { Log, LOGLEVEL } from "../Core/Log";

export async function ListJobs(req: express.Request, res: express.Response): Promise<void> {

    const jobs = Job.jobs;

    for (const job of jobs) {
        await job.getStatus();
    }

    res.send({
        data: jobs.map(job => job.toAPI()),
        status: "OK",
    } as ApiJobsResponse);

}

export async function KillJob(req: express.Request, res: express.Response): Promise<void> {

    let job: Job | boolean = false;

    if (req.params.name.endsWith("*")) {
        const name = req.params.name.slice(0, -1);
        job = Job.findJobThatStartsWith(name);
    } else {
        job = Job.getJob(req.params.name);
    }

    const clear = req.query.clear;
    const method: NodeJS.Signals = req.query.method !== undefined && req.query.method !== "" ? req.query.method as NodeJS.Signals : "SIGTERM";

    if (!job) {
        res.status(404).send({
            status: "ERROR",
            message: `Job '${req.params.name}' not found`,
        } as ApiErrorResponse);
        return;
    }

    Log.logAdvanced(LOGLEVEL.INFO, "route.jobs.kill", `Killing job ${job.name} with clear=${clear} and method=${method}`);

    if (clear) {

        const success = job.clear();

        if (success) {
            res.send({
                status: "OK",
                message: "Job cleared",
            });
        } else {
            res.status(500).send({
                status: "ERROR",
                message: "Job could not be cleared.",
            } as ApiErrorResponse);
        }

        return;

    }

    const success = await job.kill(method);

    if (success) {
        res.send({
            status: "OK",
            message: "Job killed",
        });
    } else {
        res.status(400).send({
            status: "ERROR",
            message: "Job could not be killed.",
        } as ApiErrorResponse);
    }

}