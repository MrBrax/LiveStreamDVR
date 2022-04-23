import auth from "basic-auth";
import chalk from "chalk";
import express from "express";
import { AppName } from "../Core/BaseConfig";
import { Config } from "../Core/Config";

export function Auth(req: express.Request, res: express.Response, next: express.NextFunction): void {

    // password protect
    const password = Config.getInstance().cfg<string>("password");
    const basepath = Config.getInstance().cfg<string>("basepath", "");

    const ignored_paths = [
        `${basepath}/api/v0/hook`,
        `${basepath}/api/v0/cron/sub`,
        `${basepath}/api/v0/cron/check_muted_vods`,
        `${basepath}/api/v0/cron/check_deleted_vods`,
        `${basepath}/api/v0/cron/playlist_dump`,
    ];

    if (Config.getInstance().cfg<string>("password", "") != "") {

        if (ignored_paths.includes(req.path)) {
            next();
        } else {
            const credentials = auth(req);
            if (credentials && credentials.name == "admin" && credentials.pass == password) {
                next();
            } else {
                console.log(chalk.bgRed.whiteBright(`${req.ip} attempted to access ${req.path} without proper credentials`));
                res.statusCode = 401;
                res.setHeader("WWW-Authenticate", `Basic realm="${AppName}"`);
                res.end("Access denied");
            }
        }
    } else {
        next();
    }

}