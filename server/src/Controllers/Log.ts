import express from "express";
import fs from "fs";
import { BaseConfigFolder } from "../Core/BaseConfig";
import { TwitchLog } from "../Core/TwitchLog";

export function GetLog(req: express.Request, res: express.Response) {
    
    const filename = req.params.filename;
    
    const start_from = req.params.start_from ? parseInt(req.params.start_from) : 0;

    if (!filename) {
        res.status(400).send("Missing filename");
        return;
    }
    
    let log_lines;
    
    try {
        log_lines = TwitchLog.fetchLog(filename, start_from);
    } catch (error) {
        res.status(400).send({ status: "ERROR", message: (error as Error).message });
        return;
    }

    const line_num = log_lines.length;
    
    const logfiles = fs.readdirSync(BaseConfigFolder.logs).filter(f => f.endsWith(".jsonline")).map(f => f.replace(".log.jsonline", ""));

    res.send({
        "data" : {
            "lines" : log_lines,
            "last_line" : line_num,
            "logs" : logfiles,
        },
        "status" : "OK",
    });

}