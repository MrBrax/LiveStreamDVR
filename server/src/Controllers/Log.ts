import { format } from "date-fns";
import express from "express";
import fs from "fs";
import { ApiErrorResponse, ApiLogResponse } from "../../../common/Api/Api";
import { ApiLogLine } from "../../../common/Api/Client";
import { BaseConfigDataFolder } from "../Core/BaseConfig";
import { Log } from "../Core/Log";

export function GetLog(req: express.Request, res: express.Response) {

    const filename = req.params.filename;

    const start_from = req.params.start_from ? parseInt(req.params.start_from) : 0;

    if (!filename) {
        res.status(400).send("Missing filename");
        return;
    }

    let log_lines: ApiLogLine[] = [];

    try {
        log_lines = Log.fetchLog(filename, start_from) as ApiLogLine[];
    } catch (error) {
        res.status(400).send({ status: "ERROR", message: (error as Error).message } as ApiErrorResponse);
        return;
    }

    for (const i in log_lines) {
        if (log_lines[i].time) {
            log_lines[i].date_string = format(new Date(log_lines[i].time), "yyyy-MM-dd HH:mm:ss");
            log_lines[i].date = new Date(log_lines[i].time).toISOString();
        }
    }

    const line_num = log_lines.length;

    const logfiles = fs.readdirSync(BaseConfigDataFolder.logs).filter(f => f.endsWith(".jsonline")).map(f => f.replace(".log.jsonline", ""));

    res.send({
        data: {
            lines: log_lines,
            last_line: line_num,
            logs: logfiles,
        },
        status: "OK",
    } as ApiLogResponse);

}