import type { Express } from "express";
import express from "express";
import { applyExpressApiFunction } from "./Extend/express-api";
import i18n from "./Helpers/i18n";

export function getApp(): Express {
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

    return app;
}
