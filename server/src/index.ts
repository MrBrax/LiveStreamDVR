import chalk from "chalk";
import { TwitchWebhook } from "Core/TwitchWebhook";
import express from "express";
import fs from "fs";
import { Auth } from "Helpers/Auth";
import morgan from "morgan";
import path from "path";
import WebSocket from "ws";
import { AppName, BaseConfigFolder } from "./Core/BaseConfig";
import { ClientBroker } from "./Core/ClientBroker";
import { TwitchConfig } from "./Core/TwitchConfig";
import ApiRouter from "./Routes/Api";
// import WebSocketRouter from "./Routes/WebSocket";

// for overriding port if you can't or don't want to use the web gui to change it
const override_port = process.argv && process.argv.length > 2 && process.argv[2] ? parseInt(process.argv[2]) : undefined;

// load all required config files and cache stuff
TwitchConfig.init().then(() => {

    const app = express();
    const port = override_port || TwitchConfig.cfg<number>("server_port", 8080);

    const basepath = TwitchConfig.cfg<string>("basepath", "");

    // https://github.com/expressjs/morgan/issues/76#issuecomment-450552807
    if (TwitchConfig.cfg<boolean>("trust_proxy", false)) {
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

    app.use(Auth);

    const baserouter = express.Router();

    // bind the api routes
    baserouter.use("/api/v0", ApiRouter);

    // static files and storage
    baserouter.use(express.static(BaseConfigFolder.client));
    baserouter.use("/vodplayer", express.static(BaseConfigFolder.vodplayer));
    baserouter.use("/vods", express.static(BaseConfigFolder.vod));
    baserouter.use("/saved_vods", express.static(BaseConfigFolder.saved_vods));
    baserouter.use("/saved_clips", express.static(BaseConfigFolder.saved_clips));

    // send index.html for all other routes, so that SPA routes are handled correctly
    baserouter.use("*", (req, res) => {
        res.sendFile(path.join(BaseConfigFolder.client, "index.html"));
    });

    // for the base path to work
    app.use(basepath, baserouter);

    const server = app.listen(port, () => {
        console.log(chalk.bgBlue.greenBright(`🥞 ${AppName} listening on port ${port}, mode ${process.env.NODE_ENV}. Base path: ${basepath || "/"} 🥞`));
        if (process.env.npm_lifecycle_script?.includes("index.ts")){
            console.log(chalk.greenBright("~ Running with TypeScript ~"));
        } else {
            console.log(chalk.greenBright("~ Running with plain JS ~"));
            console.log(chalk.greenBright(`Build date: ${fs.statSync(__filename).mtime.toISOString()}`));
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

    // start websocket server and attach broker
    const websocketServer = new WebSocket.Server({ server, path: `${basepath}/socket/` });
    ClientBroker.attach(websocketServer);
    
    TwitchWebhook.dispatch("init", {
        "hello": "world",
    });

});