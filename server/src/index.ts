import chalk from "chalk";
import { Webhook } from "./Core/Webhook";
import express from "express";
import fs from "fs";
import { Auth } from "./Helpers/Auth";
import minimist from "minimist";
import morgan from "morgan";
import path from "path";
import { WebSocketServer } from "ws";
import { AppName, BaseConfigDataFolder, BaseConfigFolder } from "./Core/BaseConfig";
import { ClientBroker } from "./Core/ClientBroker";
import { Config } from "./Core/Config";
import ApiRouter from "./Routes/Api";
import dotenv from "dotenv";
import session from "express-session";

declare module "express-session" {
    interface SessionData {
        authenticated: boolean;
    }
}

dotenv.config();

const argv = minimist(process.argv.slice(2));

if (argv.help || argv.h) {
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
const override_port = argv.port ? parseInt(argv.port as string) : undefined;

// load all required config files and cache stuff
Config.init().then(() => {

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
        verify: (req, res, buf) => {
            (req as any).rawBody = buf;
        },
    }));

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
    baserouter.use(express.static(BaseConfigFolder.client));
    baserouter.use("/vodplayer", express.static(BaseConfigFolder.vodplayer));
    baserouter.use("/vods", express.static(BaseConfigDataFolder.vod));
    baserouter.use("/saved_vods", express.static(BaseConfigDataFolder.saved_vods));
    baserouter.use("/saved_clips", express.static(BaseConfigDataFolder.saved_clips));
    baserouter.use("/cache", express.static(BaseConfigDataFolder.public_cache));
    if (process.env.TCD_EXPOSE_LOGS_TO_PUBLIC == "1") {
        baserouter.use("/logs", express.static(BaseConfigDataFolder.logs));
    }

    // send index.html for all other routes, so that SPA routes are handled correctly
    baserouter.use("*", (req, res) => {
        res.sendFile(path.join(BaseConfigFolder.client, "index.html"));
    });

    // for the base path to work
    app.use(basepath, baserouter);

    const server = app.listen(port, () => {
        console.log(chalk.bgBlue.greenBright(`🥞 ${AppName} listening on port ${port}, mode ${process.env.NODE_ENV}. Base path: ${basepath || "/"} 🥞`));
        if (process.env.npm_lifecycle_script?.includes("index.ts")) {
            console.log(chalk.greenBright("~ Running with TypeScript ~"));
        } else {
            console.log(chalk.greenBright("~ Running with plain JS ~"));
            console.log(chalk.greenBright(`Build date: ${fs.statSync(__filename).mtime.toLocaleString()} (${path.basename(__filename)})`));
        }
        console.log(chalk.greenBright(`Version: ${process.env.npm_package_version} running on node ${process.version} ${process.platform} 🦄`));
    });

    server.on("error", (err) => {
        console.log(chalk.bgRed.whiteBright(`${AppName} fatal error: ${err.message}`));
        if (err.message.includes("EADDRINUSE")) {
            console.log(chalk.bgRed.whiteBright(`Port ${port} is already in use.`));
            process.exit(1);
        }
    });

    if (Config.getInstance().cfg<boolean>("websocket_enabled")) {

        // start websocket server and attach broker
        const websocketServer = new WebSocketServer({ server, path: `${basepath}/socket/` });
        ClientBroker.attach(websocketServer);

        Webhook.dispatch("init", {
            "hello": "world",
        });

    } else {
        console.log(chalk.yellow("WebSocket is disabled. Change the 'websocket_enabled' config to enable it."));
    }

});