#!/usr/bin/env node
import chalk from "chalk";
import dotenv from "dotenv";
import minimist from "minimist";
import morgan from "morgan";
import fs from "node:fs";
import path from "node:path";
import { WebSocketServer } from "ws";
import { version } from "../package.json";
import { AppName, BaseConfigDataFolder } from "./Core/BaseConfig";
import { ClientBroker } from "./Core/ClientBroker";
import { Config } from "./Core/Config";
import { LiveStreamDVR } from "./Core/LiveStreamDVR";
import { Webhook } from "./Core/Webhook";
import { applySessionParser } from "./Extend/express-session";
import { debugLog } from "./Helpers/Console";
import { applyRoutes } from "./Routes/Routes";
import { getApp } from "./app";

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
const overridePort = LiveStreamDVR.argv.port
    ? parseInt(LiveStreamDVR.argv.port as string)
    : undefined;

try {
    LiveStreamDVR.checkVersion();
} catch (error) {
    console.error(`Check version error: ${(error as Error).message}`);
}

// load all required config files and cache stuff
void LiveStreamDVR.init().then(() => {
    // if (fs.existsSync(path.join(BaseConfigDataFolder.cache, "lock"))) {
    //     logAdvanced(LOGLEVEL.WARNING, "index", "Seems like the server was not shut down gracefully...");
    // }

    // const app = express();
    const app = getApp();

    const port =
        overridePort || Config.getInstance().cfg<number>("server_port", 8080);

    // const basepath = Config.getInstance().cfg<string>("basepath", "");

    // https://github.com/expressjs/morgan/issues/76#issuecomment-450552807
    if (Config.getInstance().cfg<boolean>("trust_proxy", false)) {
        app.set("trust proxy", true);
        console.log(chalk.yellow("Setting trust proxy to true."));
    }

    // extend express req object with an api function that takes a status code and a generic object as arguments
    // this is used to send json responses
    // app.use((req, res, next) => {
    //     res.api = <T>(status: number, data: T) => {
    //         res.status(status).json(data);
    //     };
    //     next();
    // });

    // logging
    /** @TODO not sure if to continue using morgan since we now use winston for main logging **/
    if (process.env.NODE_ENV == "development") {
        app.use(morgan("dev"));
    } else {
        app.use(morgan("combined"));
    }

    Config.getInstance().sessionParser = applySessionParser(app);

    // authentication
    // app.use(Auth);

    applyRoutes(app);

    const server = app.listen(port, () => {
        console.log(
            chalk.bgBlue.greenBright(
                `🥞 ${AppName} listening on port ${port}, mode ${
                    process.env.NODE_ENV
                }. Base path: ${Config.getBasePath() || "/"} 🥞`
            )
        );
        console.log(
            chalk.yellow(
                `Local: http://localhost:${port}${Config.getBasePath()}`
            )
        );
        console.log(
            chalk.yellow(`Public: ${Config.getInstance().cfg("app_url", "")}`)
        );
        if (process.env.HTTP_PROXY) {
            console.log(chalk.yellow(`HTTP Proxy: ${process.env.HTTP_PROXY}`));
        }

        if (
            process.env.npm_lifecycle_event == "start:dev" ||
            process.env.NODE_ENV == "development" // probably not legit
        ) {
            console.log(chalk.greenBright("Type: Live TypeScript"));
        } else {
            console.log(chalk.greenBright("Type: Compiled JavaScript"));
            console.log(
                chalk.greenBright(
                    `Build date: ${fs
                        .statSync(__filename)
                        .mtime.toLocaleString()} (${path.basename(__filename)})`
                )
            );
        }

        console.log(
            chalk.greenBright(
                `Version: ${process.env.npm_package_version} running on node ${process.version} ${process.platform} 🦄`
            )
        );

        console.log(chalk.greenBright(`Debug: ${Config.debug}`));

        if (process.env.BUILD_DATE) {
            console.log(chalk.greenBright("Build: CI"));
            console.log(
                chalk.greenBright(`Development: ${process.env.IS_DEV}`)
            );
            console.log(
                chalk.greenBright(`Build date: ${process.env.BUILD_DATE}`)
            );
            console.log(chalk.greenBright(`Version: ${process.env.VERSION}`));
            console.log(chalk.greenBright(`VCS ref: ${process.env.VCS_REF}`));
        } else {
            console.log(chalk.greenBright("Build: Local"));
        }
    });

    server.on("error", (err) => {
        console.log(
            chalk.bgRed.whiteBright(`${AppName} fatal error: ${err.message}`)
        );
        if (err.message.includes("EADDRINUSE")) {
            console.log(
                chalk.bgRed.whiteBright(`Port ${port} is already in use.`)
            );
            process.exit(1);
        }
    });

    server.on("close", () => {
        debugLog("Express server closed");
    });

    let websocketServer: WebSocketServer | undefined = undefined;
    if (Config.getInstance().cfg<boolean>("websocket_enabled")) {
        // start websocket server and attach broker
        websocketServer = new WebSocketServer({
            server,
            path: `${Config.getBasePath()}/socket/`,
        });
        ClientBroker.attach(websocketServer);

        Webhook.dispatchAll("init", {
            hello: "world",
        });
    } else {
        console.log(
            chalk.yellow(
                "WebSocket is disabled. Change the 'websocket_enabled' config to enable it."
            )
        );
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
                `${err.message}\n${err.stack}\n${origin}`,
                undefined,
                "system"
            );
            const errorText = `[${AppName} ${version} ${
                Config.getInstance().gitHash
            }]\nUNCAUGHT EXCEPTION\n${err.name}: ${err.message}\n${err.stack}`;
            fs.writeFileSync(
                path.join(BaseConfigDataFolder.logs, "crash.log"),
                errorText
            );
            LiveStreamDVR.shutdown("uncaught exception");
            // throw err;
        });
    }

    if (Config.getInstance().cfg<boolean>("debug.catch_global_rejections")) {
        process.on("unhandledRejection", function (reason: Error, promise) {
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
                `${reason.message}\n${reason.stack}\n${promise}`,
                undefined,
                "system"
            );
            const errorText = `[${AppName} ${version} ${
                Config.getInstance().gitHash
            }]\nUNCAUGHT REJECTION\n${reason.name}: ${reason.message}\n${
                reason.stack
            }\n\n${promise}`;
            fs.writeFileSync(
                path.join(BaseConfigDataFolder.logs, "crash.log"),
                errorText
            );
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
});
