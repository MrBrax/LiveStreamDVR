import { TwitchAutomatorJob } from "../Core/TwitchAutomatorJob";
import express from "express";
import { ApiErrorResponse } from "../../../common/Api/Api";

export function ListJobs(req: express.Request, res: express.Response): void {

    const jobs = TwitchAutomatorJob.jobs;

    jobs.forEach((job) => { job.getStatus(); });

    res.send({
        data: jobs,
        status: "OK",
    });

}

export async function KillJob(req: express.Request, res: express.Response): Promise<void> {

    const job = TwitchAutomatorJob.jobs.find(j => j.name === req.params.name);

    if (!job) {
        res.status(400).send({
            status: "ERROR",
            message: "Job not found",
        } as ApiErrorResponse);
        return;
    }

    const success = await job.kill();

    if (success) {
        res.send({
            status: "OK",
        });
    } else {
        res.status(400).send({
            status: "ERROR",
            message: "Job could not be killed.",
        } as ApiErrorResponse);
    }
}