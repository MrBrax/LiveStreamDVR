import auth from "basic-auth";
import chalk from "chalk";
import express from "express";
import { AppName } from "../Core/BaseConfig";
import { Config } from "../Core/Config";

/* TODO: guest and admin roles
export function Auth(req: express.Request, res: express.Response, next: express.NextFunction): void {

    // password protect
    const password = Config.getInstance().cfg<string>("password");
    const basepath = Config.getInstance().cfg<string>("basepath", "");
    const guest_mode = Config.getInstance().cfg<boolean>("guest_mode", false);
    const client_password = req.header("X-Password");

    const public_paths = [
        `${basepath}/api/v0/hook`,
        `${basepath}/api/v0/cron/sub`,
        `${basepath}/api/v0/cron/check_muted_vods`,
        `${basepath}/api/v0/cron/check_deleted_vods`,
        `${basepath}/api/v0/cron/playlist_dump`,
    ];

    const guest_paths = [
        [`${basepath}/api/v0/vod`, "GET"],
        [`${basepath}/api/v0/vod/:basename`, "GET"],
        [`${basepath}/api/v0/channels`, "GET"],
        [`${basepath}/api/v0/settings`, "GET"],
    ];

    (req as any).user = client_password == password ? "admin" : "guest"; // bad hack

    if (Config.getInstance().cfg<string>("password", "") != "") {
        if (public_paths.includes(req.path)) {
            next();
        } else {
            if (guest_mode && guest_paths.some(p => p[0] == req.path && p[1] == req.method)) {
                next();
            } else {
                if (client_password == password) {
                    next();
                } else if (client_password == "" || !client_password) {
                    res.status(401).send({
                        status: "ERROR",
                        message: "Password required",
                    }).end();
                } else {
                    res.status(401).send({
                        status: "ERROR",
                        message: "Invalid password",
                    }).end();
                }
            }
        }
    } else {
        next();
    }

}
*/

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

export function AuthGuest(req: express.Request, res: express.Response, next: express.NextFunction): void {

    /*
    console.debug(`${req.ip} accessed ${req.path} with guest`);

    // password protect
    const password = Config.getInstance().cfg<string>("password");
    const basepath = Config.getInstance().cfg<string>("basepath", "");

    next();
    */
    
    next();

}

export function AuthAdmin(req: express.Request, res: express.Response, next: express.NextFunction): void {

    /*
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
                console.log(chalk.bgRed.whiteBright(`${req.ip} attempted to access admin route '${req.path}' without proper credentials`));
                res.statusCode = 401;
                res.setHeader("WWW-Authenticate", `Basic realm="${AppName}"`);
                res.end("Access denied");
            }
        }
    } else {
        next();
    }
    */

    next();

}