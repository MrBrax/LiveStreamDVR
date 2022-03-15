import express from "express";
import { TwitchConfig } from "./Core/TwitchConfig";
import history from "connect-history-api-fallback";
import path from "path";
import morgan from "morgan";
import ApiRouter from "./Routes/Api";
import { AppRoot } from "./Core/BaseConfig";

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
        console.log(`TA listening on port ${port}`);
    });

});