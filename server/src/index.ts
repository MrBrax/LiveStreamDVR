#!/usr/bin/env node
import chalk from "chalk";
import { LiveStreamDVR } from "./Core/LiveStreamDVR";
import dotenv from "dotenv";
import express from "express";
import session from "express-session";
import minimist from "minimist";
import morgan from "morgan";
import fs from "node:fs";
import path from "node:path";
import { WebSocketServer } from "ws";
import { version } from "../package.json";
import { AppName, BaseConfigDataFolder, BaseConfigFolder } from "./Core/BaseConfig";
import { ClientBroker } from "./Core/ClientBroker";
import { Config } from "./Core/Config";
import { Webhook } from "./Core/Webhook";
import i18n from "./Helpers/i18n";
import ApiRouter from "./Routes/Api";
import { debugLog } from "./Helpers/Console";

declare module "express-session" {
    interface SessionData {
        authenticated: boolean;
    }
}

dotenv.config();

LiveStreamDVR.argv = minimist(process.argv.slice(2));

if (LiveStreamDVR.argv.help || LiveStreamDVR.argv.h) {
    console.log(`
    Usage:
        yarn run start [options]

    Options:
        --help, -h: Show this help
        --port <number>: Set the port to listen on
        --debug: Enable debug mode
        --home: Use the home directory instead of the data directory
        --dataroot <path>: Use the specified data directory instead of the default
    `);
    process.exit(0);
}

// for overriding port if you can't or don't want to use the web gui to change it
const override_port = LiveStreamDVR.argv.port ? parseInt(LiveStreamDVR.argv.port as string) : undefined;

try {
    LiveStreamDVR.checkVersion();
} catch (error) {
    console.error(`Check version error: ${(error as Error).message}`);
}

// load all required config files and cache stuff
LiveStreamDVR.init().then(() => {

    // if (fs.existsSync(path.join(BaseConfigDataFolder.cache, "lock"))) {
    //     Log.logAdvanced(Log.Level.WARNING, "index", "Seems like the server was not shut down gracefully...");
    // }

    const app = express();
    const port = override_port || Config.getInstance().cfg<number>("server_port", 8080);

    const basepath = Config.getInstance().cfg<string>("basepath", "");

    // https://github.com/expressjs/morgan/issues/76#issuecomment-450552807
    if (Config.getInstance().cfg<boolean>("trust_proxy", false)) {
        app.set("trust proxy", true);
        console.log(chalk.yellow("Setting trust proxy to true."));
    }


    /**
     * https://flaviocopes.com/express-get-raw-body/
     * 
     * apparently this is needed to get the raw body since express doesn't do it by default,
     * i read it takes up twice the memory, but it's required for signature verification
     */

    app.use(express.json({
        verify: (req, res, buf, encoding) => {
            (req as any).rawBody = buf;
        },
    }));

    app.use(express.text({ type: "application/xml" }));
    app.use(express.text({ type: "application/atom+xml" }));

    // i18n
    app.use(i18n);

    // logging
    if (process.env.NODE_ENV == "development") {
        app.use(morgan("dev"));
    } else {
        app.use(morgan("combined"));
    }

    const sessionParser = session({
        secret: Config.getInstance().cfg<string>("eventsub_secret", ""), // TODO: make this unique from eventsub_secret
        resave: false,
        saveUninitialized: true,
        // cookie: {
        //     secure: true,
        //     httpOnly: true,
        //     maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        // },
    }); // bad

    Config.getInstance().sessionParser = sessionParser;

    // session
    app.use(sessionParser);

    // authentication
    // app.use(Auth);

    const baserouter = express.Router();

    // bind the api routes
    baserouter.use("/api/v0", ApiRouter);

    // static files and storage
    // baserouter.use("/vodplayer", express.static(BaseConfigFolder.vodplayer));
    baserouter.use("/vods", express.static(BaseConfigDataFolder.vod));
    baserouter.use("/saved_vods", express.static(BaseConfigDataFolder.saved_vods));
    baserouter.use("/saved_clips", express.static(BaseConfigDataFolder.saved_clips));
    baserouter.use("/cache", express.static(BaseConfigDataFolder.public_cache));
    if (process.env.TCD_EXPOSE_LOGS_TO_PUBLIC == "1") {
        baserouter.use("/logs", express.static(BaseConfigDataFolder.logs));
    }

    baserouter.use(express.static(BaseConfigFolder.client));

    // send index.html for all other routes, so that SPA routes are handled correctly
    baserouter.use((req, res, next) => {
        /*const ext = path.extname(req.path);

        if (!([ ".js", ".css", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".ico", ".woff", ".woff2", ".ttf", ".otf", ".eot", ".map", ".webmanifest", ".xml", ".json", ".mp4", ".mkv", ".ts" ].includes(ext))) {
            // vodplayer
            if (req.path.includes("/vodplayer/")) {
                res.sendFile(path.join(BaseConfigFolder.vodplayer, "index.html"));
            } else {
                res.sendFile(path.join(BaseConfigFolder.client, "index.html"));
            }
        } else {
            next();
        }*/

        const fpath = req.path;

        // console.log(fpath, fpath.startsWith(`${basepath}/api/`), `${basepath}/api/`);
        // console.log(fpath.startsWith(`${basepath}/vodplayer/`), fpath, `${basepath}/vodplayer/`);

        if (
            fpath.startsWith(`${basepath}/api/`) ||
            fpath.startsWith(`${basepath}/vods/`) ||
            fpath.startsWith(`${basepath}/saved_vods/`) ||
            fpath.startsWith(`${basepath}/saved_clips/`) ||
            fpath.startsWith(`${basepath}/cache/`) ||
            fpath.startsWith(`${basepath}/logs/`)
        ) {
            next();
            return;
        }

        // if (fpath.startsWith(`${basepath}/vodplayer/`)) {
        //     res.sendFile(path.join(BaseConfigFolder.vodplayer, "index.html"));
        //     return;
        // }

        res.sendFile(path.join(BaseConfigFolder.client, "index.html"));
        // next();
    });

    // 404 handler
    baserouter.use((req, res) => {
        res.status(404).send(`404 - Not Found - ${req.url}`);
    });

    // for the base path to work
    app.use(basepath, baserouter);

    const server = app.listen(port, () => {
        console.log(chalk.bgBlue.greenBright(`🥞 ${AppName} listening on port ${port}, mode ${process.env.NODE_ENV}. Base path: ${basepath || "/"} 🥞`));
        console.log(chalk.yellow(`Local: http://localhost:${port}${basepath}`));
        console.log(chalk.yellow(`Public: ${Config.getInstance().cfg("app_url")}`));
        if (process.env.HTTP_PROXY) console.log(chalk.yellow(`HTTP Proxy: ${process.env.HTTP_PROXY}`));
        if (process.env.npm_lifecycle_script?.includes("index.ts")) {
            console.log(chalk.greenBright("~ Running with TypeScript ~"));
        } else {
            console.log(chalk.greenBright("~ Running with plain JS ~"));
            console.log(chalk.greenBright(`Build date: ${fs.statSync(__filename).mtime.toLocaleString()} (${path.basename(__filename)})`));
        }
        console.log(chalk.greenBright(`Version: ${process.env.npm_package_version} running on node ${process.version} ${process.platform} 🦄`));

        if (process.env.BUILD_DATE) {
            console.log(chalk.greenBright("~ Detected CI build ~"));
            console.log(chalk.greenBright(`Development: ${process.env.IS_DEV}`));
            console.log(chalk.greenBright(`Build date: ${process.env.BUILD_DATE}`));
            console.log(chalk.greenBright(`Version: ${process.env.VERSION}`));
            console.log(chalk.greenBright(`VCS ref: ${process.env.VCS_REF}`));
        } else {
            console.log(chalk.greenBright("~ Detected local build ~"));
        }

    });

    server.on("error", (err) => {
        console.log(chalk.bgRed.whiteBright(`${AppName} fatal error: ${err.message}`));
        if (err.message.includes("EADDRINUSE")) {
            console.log(chalk.bgRed.whiteBright(`Port ${port} is already in use.`));
            process.exit(1);
        }
    });

    server.on("close", () => {
        debugLog("Express server closed");
    });

    let websocketServer: WebSocketServer | undefined = undefined;
    if (Config.getInstance().cfg<boolean>("websocket_enabled")) {

        // start websocket server and attach broker
        websocketServer = new WebSocketServer({ server, path: `${basepath}/socket/` });
        ClientBroker.attach(websocketServer);

        Webhook.dispatchAll("init", {
            "hello": "world",
        });

    } else {
        console.log(chalk.yellow("WebSocket is disabled. Change the 'websocket_enabled' config to enable it."));
    }

    // handle uncaught exceptions, not sure if this is a good idea
    if (Config.getInstance().cfg<boolean>("debug.catch_global_exceptions")) {
        process.on("uncaughtException", function (err, origin) {
            console.error("Fatal error; Uncaught exception");
            console.error(err);
            console.error(origin);
            ClientBroker.broadcast({
                action: "alert",
                data: "Uncaught exception, server will exit.",
            });
            ClientBroker.notify(
                "Uncaught exception, server will exit.",
                err + "\n" + origin,
                undefined,
                "system"
            );
            const errorText = `[${AppName} ${version} ${Config.getInstance().gitHash}]\nUNCAUGHT EXCEPTION\n${err.name}: ${err.message}\n${err.stack}`;
            fs.writeFileSync(path.join(BaseConfigDataFolder.logs, "crash.log"), errorText);
            LiveStreamDVR.shutdown("uncaught exception");
            // throw err;
        });

    }

    if (Config.getInstance().cfg<boolean>("debug.catch_global_rejections")) {
        process.on("unhandledRejection", function(reason: Error, promise) {
            console.error("Fatal error; Uncaught rejection");
            console.error("Error: ");
            console.error(reason);
            console.error("\nPromise: ");
            console.error(promise);
            console.error("\nStack: ");
            console.error(reason.stack);
            ClientBroker.broadcast({
                action: "alert",
                data: "Uncaught rejection, server will exit.",
            });
            ClientBroker.notify(
                "Uncaught rejection, server will exit.",
                reason + "\n" + promise,
                undefined,
                "system"
            );
            const errorText = `[${AppName} ${version} ${Config.getInstance().gitHash}]\nUNCAUGHT REJECTION\n${reason.name}: ${reason.message}\n${reason.stack}\n\n${promise}`;
            fs.writeFileSync(path.join(BaseConfigDataFolder.logs, "crash.log"), errorText);
            LiveStreamDVR.shutdown("uncaught rejection");
            // throw err;
        });
        // Promise.reject("test");
    }

    LiveStreamDVR.server = server;
    if (websocketServer) LiveStreamDVR.websocketServer = websocketServer;

    process.on("SIGINT", (signal) => {
        console.log(`Sigint received, shutting down (signal ${signal})`);
        LiveStreamDVR.shutdown("sigint");
    });

    LiveStreamDVR.postInit();

    // fs.writeFileSync(path.join(BaseConfigDataFolder.cache, "lock"), "1");

    /*
    process.on("beforeExit", (code) => {
        if (code == 0) {
            if (fs.existsSync(path.join(BaseConfigDataFolder.cache, "lock"))) fs.unlinkSync(path.join(BaseConfigDataFolder.cache, "lock"));
        } else {
            console.log(`Not removing lock, beforeExit code ${code}`);
        }
    });

    process.on("exit", (code) => {
        if (code == 0) {
            if (fs.existsSync(path.join(BaseConfigDataFolder.cache, "lock"))) fs.unlinkSync(path.join(BaseConfigDataFolder.cache, "lock"));
        } else {
            console.log(`Not removing lock, exit code ${code}`);
        }
    });

    process.on("SIGINT", (signal) => {
        if (signal) {
            if (fs.existsSync(path.join(BaseConfigDataFolder.cache, "lock"))) fs.unlinkSync(path.join(BaseConfigDataFolder.cache, "lock"));
        } else {
            console.log(`Not removing lock, sigint signal ${signal}`);
        }
    });
    */

});