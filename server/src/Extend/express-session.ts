import { Config } from "@/Core/Config";
import type { Express } from "express";
import session from "express-session";

export function applySessionParser(app: Express) {
    const sessionParser = session({
        secret: Config.getInstance().cfg<string>("eventsub_secret", ""), // TODO make this unique from eventsub_secret
        resave: false,
        saveUninitialized: true,
        // cookie: {
        //     secure: true,
        //     httpOnly: true,
        //     maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        // },
    }); // bad

    // session
    app.use(sessionParser);

    return sessionParser;
}
