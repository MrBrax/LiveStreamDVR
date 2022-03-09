import express from "express";
import path from "path";
import fs from "fs";
import { BaseConfigFolder } from "../Core/BaseConfig";
import { TwitchLog } from "../Core/TwitchLog";

export function GetLog(req: express.Request, res: express.Response) {
    
    const filename = req.params.filename;
    
    const last_line = req.params.last_line ? parseInt(req.params.last_line) : 0;

    if (!filename) {
        res.status(400).send("Missing filename");
        return;
    }
    
    const log_lines = TwitchLog.fetchLog(filename, last_line);
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