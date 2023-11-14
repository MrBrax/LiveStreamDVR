import { LOGLEVEL, log } from "@/Core/Log";
import type express from "express";

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Response {
            api<T>(status: number, data: T): void;
        }
    }
}

export function applyExpressApiFunction(app: express.Express) {
    (app.response as any).api = function <T>(
        this: express.Response,
        status: number,
        data: T
    ) {
        if (data == undefined) {
            this.status(status).end();
            log(
                LOGLEVEL.ERROR,
                "http.api",
                `API error ${status} returned blank`
            );
            console.trace(`API error ${status} returned blank`);
            return;
        }
        this.status(status).json(data);
        if (status >= 400) {
            log(
                LOGLEVEL.ERROR,
                "http.api",
                `API error ${status} returned: ${JSON.stringify(data)}`
            );
            console.trace(
                `API error ${status} returned: ${JSON.stringify(data)}`
            );
        }
    };
}
