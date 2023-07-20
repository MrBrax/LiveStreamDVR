import auth from "basic-auth";
import chalk from "chalk";
import type express from "express";
import { AppName } from "@/Core/BaseConfig";
import { Config } from "@/Core/Config";

export function Auth(req: express.Request, res: express.Response, next: express.NextFunction): void {

    // password protect
    const password = Config.getInstance().cfg<string>("password");
    const basepath = Config.getInstance().cfg<string>("basepath", "");

    const ignored_paths = [
        `${basepath}/api/v0/hook`,
        `${basepath}/api/v0/hook/twitch`,
        `${basepath}/api/v0/hook/youtube`,
        `${basepath}/api/v0/cron/sub`,
        `${basepath}/api/v0/cron/check_muted_vods`,
        `${basepath}/api/v0/cron/check_deleted_vods`,
        `${basepath}/api/v0/cron/playlist_dump`,
    ];

    if (Config.getInstance().hasValue("password")) {

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

    const guest_mode = Config.getInstance().cfg<boolean>("guest_mode", false);

    if (!Config.getInstance().cfg<boolean>("password")) {
        next();
    } else if (guest_mode) {
        next();
    } else if (req.session.authenticated) {
        next();
    } else {
        res.status(401).send({
            status: "ERROR",
            message: "Access denied",
        }).end();
        // next("route");
    }

}

export function AuthAdmin(req: express.Request, res: express.Response, next: express.NextFunction): void {

    if (!Config.getInstance().cfg<boolean>("password")) {
        next();
    } else if (req.session.authenticated) {
        next();
    } else {
        res.status(401).send({
            status: "ERROR",
            message: "Access denied",
        }).end();
        // next("route");
    }

}

export function AuthCore(req: express.Request, res: express.Response, next: express.NextFunction): void {
    // this is for curl and other tools that don't use authentication
    next();
}