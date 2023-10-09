import {
    BaseConfigCacheFolder,
    BaseConfigDataFolder,
    BaseConfigFolder,
} from "@/Core/BaseConfig";
import { Config } from "@/Core/Config";
import type { Express } from "express";
import express from "express";
import path from "node:path";
import ApiRouter from "./Api";

export function applyRoutes(app: Express) {
    const baserouter = express.Router();

    // bind the api routes
    baserouter.use("/api/v0", ApiRouter);

    // static files and storage
    // baserouter.use("/vodplayer", express.static(BaseConfigFolder.vodplayer));
    baserouter.use("/vods", express.static(BaseConfigDataFolder.vod));
    baserouter.use(
        "/saved_vods",
        express.static(BaseConfigDataFolder.saved_vods)
    );
    baserouter.use(
        "/saved_clips",
        express.static(BaseConfigDataFolder.saved_clips)
    );
    baserouter.use(
        "/cache",
        express.static(BaseConfigCacheFolder.public_cache)
    );
    if (process.env.TCD_EXPOSE_LOGS_TO_PUBLIC == "1") {
        baserouter.use("/logs", express.static(BaseConfigDataFolder.logs));
    }

    baserouter.use(express.static(BaseConfigFolder.client));

    // send index.html for all other routes, so that SPA routes are handled correctly
    baserouter.use((req, res, next) => {
        const fpath = req.path;
        const basepath = Config.getBasePath();

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

        res.sendFile(path.join(BaseConfigFolder.client, "index.html"));
    });

    // 404 handler
    baserouter.use((req, res) => {
        res.status(404).send(`404 - Not Found - ${req.url}`);
    });

    // for the base path to work
    app.use(Config.getBasePath(), baserouter);
}
