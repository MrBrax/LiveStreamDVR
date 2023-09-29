import express from "express";
import path from "node:path";
import {
    BaseConfigCacheFolder,
    BaseConfigDataFolder,
    BaseConfigFolder,
} from "./Core/BaseConfig";
import { Config } from "./Core/Config";
import { applyExpressApiFunction } from "./Extend/express-api";
import i18n from "./Helpers/i18n";
import ApiRouter from "./Routes/Api";

export function getApp() {
    const app = express();

    /**
     * https://flaviocopes.com/express-get-raw-body/
     *
     * apparently this is needed to get the raw body since express doesn't do it by default,
     * i read it takes up twice the memory, but it's required for signature verification
     */

    app.use(
        express.json({
            verify: (req, res, buf, encoding) => {
                (req as any).rawBody = buf;
            },
        })
    );

    applyExpressApiFunction(app);

    app.use(express.text({ type: "application/xml" }));
    app.use(express.text({ type: "application/atom+xml" }));

    // i18n
    app.use(i18n);

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

    return app;
}
