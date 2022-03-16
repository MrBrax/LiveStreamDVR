import chalk from "chalk";
import history from "connect-history-api-fallback";
import fs from "fs";
import express from "express";
import morgan from "morgan";
import path from "path";
import { AppName, AppRoot, BaseConfigFolder } from "./Core/BaseConfig";
import { TwitchConfig } from "./Core/TwitchConfig";
import ApiRouter from "./Routes/Api";

if (!fs.existsSync(path.join(BaseConfigFolder.client, "index.html"))) {
    console.log(chalk.red("Client is not built. Please run yarn build inside the client-vue folder."));
    process.exit(1);
}

TwitchConfig.init().then(() => {

    const app = express();
    const port = TwitchConfig.cfg<number>("server_port", 8080);

    app.use(express.json());
    app.use(morgan("dev"));

    // app.get("/", (req, res) => {
    //     // res.send(TwitchConfig.cfg<string>("app_url", "test"));
    //     res.send(TwitchConfig.config);
    // });

    app.use("/api/v0", ApiRouter);

    // single page app
    // app.use(history());
    app.use(express.static(BaseConfigFolder.client));
    app.use("/vodplayer", express.static(BaseConfigFolder.vodplayer));
    app.use("/vods", express.static(BaseConfigFolder.vod));
    app.use("/saved_vods", express.static(BaseConfigFolder.saved_vods));
    app.use("/saved_clips", express.static(BaseConfigFolder.saved_clips));

    app.use("*", (req, res) => {
        res.sendFile(path.join(BaseConfigFolder.client, "index.html"));
    });

    app.listen(port, () => {
        console.log(chalk.greenBright(`${AppName} listening on port ${port}, mode ${process.env.NODE_ENV}`));
        if (process.env.npm_lifecycle_script?.includes("index.ts")){
            console.log(chalk.greenBright("Running with TypeScript"));
        } else {
            console.log(chalk.greenBright("Running with plain JS"));
        }
    });

});