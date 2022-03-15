import express from "express";
import { TwitchConfig } from "./Core/TwitchConfig";
import history from "connect-history-api-fallback";
import path from "path";
import morgan from "morgan";
import ApiRouter from "./Routes/Api";
import { AppName, AppRoot } from "./Core/BaseConfig";
import chalk from "chalk";

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
    app.use(history());
    app.use(express.static( path.join(AppRoot, "client-vue", "dist")));

    app.listen(port, () => {
        console.log(chalk.greenBright(`${AppName} listening on port ${port}, mode ${process.env.NODE_ENV}`));
        if (process.env.npm_lifecycle_script?.includes("index.ts")){
            console.log(chalk.greenBright("Running with TypeScript"));
        } else {
            console.log(chalk.greenBright("Running with plain JS"));
        }
    });

    console.log(process.env);

});