import { TwitchAutomatorJob } from "../Core/TwitchAutomatorJob";
import express from "express";
import { ApiErrorResponse, ApiJobsResponse } from "../../../common/Api/Api";

export async function ListJobs(req: express.Request, res: express.Response): Promise<void> {

    const jobs = TwitchAutomatorJob.jobs;

    for (const job of jobs) {
        await job.getStatus();
    }

    res.send({
        data: jobs.map(job => job.toAPI()),
        status: "OK",
    } as ApiJobsResponse);

}

export async function KillJob(req: express.Request, res: express.Response): Promise<void> {

    const job = TwitchAutomatorJob.jobs.find(j => j.name === req.params.name);
    const clear = req.query.clear;

    if (!job) {
        res.status(400).send({
            status: "ERROR",
            message: "Job not found",
        } as ApiErrorResponse);
        return;
    }

    if (clear) {

        const success = job.clear();

        if (success) {
            res.send({
                status: "OK",
                message: "Job cleared",
            });
        } else {
            res.status(400).send({
                status: "ERROR",
                message: "Job could not be cleared.",
            } as ApiErrorResponse);
        }

        return;

    }

    const success = await job.kill();

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