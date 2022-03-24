import auth from "basic-auth";
import chalk from "chalk";
import express from "express";
import { AppName } from "Core/BaseConfig";
import { TwitchConfig } from "Core/TwitchConfig";

export function Auth(req: express.Request, res: express.Response, next: express.NextFunction): void {

    // password protect
    const password = TwitchConfig.cfg<string>("password");
    const basepath = TwitchConfig.cfg<string>("basepath", "");

    const ignored_paths = [
        `${basepath}/api/v0/hook`,
        `${basepath}/api/v0/cron/sub`,
        `${basepath}/api/v0/cron/check_muted_vods`,
        `${basepath}/api/v0/cron/check_deleted_vods`,
        `${basepath}/api/v0/cron/playlist_dump`,
    ];


    console.log(chalk.yellow(`${req.method} ${req.url}`));
    
    if (TwitchConfig.cfg<string>("password", "") != "") {

        if (ignored_paths.includes(req.path)) {
            console.debug(chalk.yellow(`Ignoring path ${req.path} for password protection.`));
            next();
        } else {
            const credentials = auth(req);
            if (credentials && credentials.name == "admin" && credentials.pass == password) {
                console.debug(chalk.green(`Authenticated ${credentials.name} for path ${req.path}`));
                next();
            } else {
                console.debug(chalk.red(`Failed to authenticate ${credentials?.name} for path ${req.path}`));
                res.statusCode = 401;
                res.setHeader("WWW-Authenticate", `Basic realm="${AppName}"`);
                res.end("Access denied");
            }
        }
    } else {
        console.debug(chalk.yellow("No password set"));
        next();
    }

}