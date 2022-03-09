import { TwitchAutomatorJob } from "../Core/TwitchAutomatorJob";
import express from "express";

export function ListJobs(req: express.Request, res: express.Response): void {
    
    const jobs = TwitchAutomatorJob.jobs;
    
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
        });
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
        });
    }
}