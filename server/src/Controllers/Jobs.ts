import { TwitchAutomatorJob } from "../Core/TwitchAutomatorJob";
import express from "express";

export function ListJobs(req: express.Request, res: express.Response): void {
    
    const jobs = TwitchAutomatorJob.jobs;
    
    res.send({
        data: jobs,
        status: "OK",
    });
}