import type { NotificationCategory } from "@common/Defs";
import axios from "axios";
import chalk from "chalk";
import { Config } from "../Config";
import { LOGLEVEL, log } from "../Log";

interface PushoverSendMessagePayload {
    token: string;
    user: string;
    message: string;
    attachment?: string;
    attachment_base64?: string;
    attachment_type?: string;
    device?: string;
    html?: 1;
    priority?: -2 | -1 | 0 | 1 | 2;
    sound?: string;
    timestamp?: number;
    title?: string;
    ttl?: number;
    url?: string;
    url_title?: string;
}

export default function notify(
    title: string,
    body = "",
    icon = "",
    category: NotificationCategory, // change this?
    url = "",
    tts = false
) {
    // escape with backslash
    // const escaped_title = title.replace(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/g, "\\$&");
    // const escaped_body = body.replace(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/g, "\\$&");

    axios
        .post("https://api.pushover.net/1/messages.json", {
            token: Config.getInstance().cfg("notifications.pushover.token"),
            user: Config.getInstance().cfg("notifications.pushover.user"),
            title: title,
            message: body,
            url: url,
            // html: 1,
        } as PushoverSendMessagePayload)
        .then((res) => {
            log(
                LOGLEVEL.DEBUG,
                "clientBroker.notify",
                "Pushover response",
                res.data
            );
        })
        .catch((err: Error) => {
            if (axios.isAxiosError(err)) {
                // const data = err.response?.data;
                // TwitchlogAdvanced(LOGLEVEL.ERROR, "notify", `Telegram axios error: ${err.message} (${data})`, { err: err, response: data });
                // console.error(chalk.bgRed.whiteBright(`Telegram axios error: ${err.message} (${data})`), JSON.stringify(err, null, 2));

                if (err.response) {
                    log(
                        LOGLEVEL.ERROR,
                        "clientBroker.notify",
                        `Pushover axios error response: ${err.message} (${err.response.data})`,
                        { err: err, response: err.response.data }
                    );
                    console.error(
                        chalk.bgRed.whiteBright(
                            `Pushover axios error response : ${err.message} (${err.response.data})`
                        ),
                        JSON.stringify(err, null, 2)
                    );
                } else if (err.request) {
                    log(
                        LOGLEVEL.ERROR,
                        "clientBroker.notify",
                        `Pushover axios error request: ${err.message} (${err.request})`,
                        { err: err, request: err.request }
                    );
                    console.error(
                        chalk.bgRed.whiteBright(
                            `Pushover axios error request: ${err.message} (${err.request})`
                        ),
                        JSON.stringify(err, null, 2)
                    );
                } else {
                    log(
                        LOGLEVEL.ERROR,
                        "clientBroker.notify",
                        `Pushover axios error: ${err.message}`,
                        err
                    );
                    console.error(
                        chalk.bgRed.whiteBright(
                            `Pushover axios error: ${err.message}`
                        ),
                        JSON.stringify(err, null, 2)
                    );
                }
            } else {
                log(
                    LOGLEVEL.ERROR,
                    "clientBroker.notify",
                    `Pushover error: ${err.message}`,
                    err
                );
                console.error(
                    chalk.bgRed.whiteBright(`Pushover error: ${err.message}`)
                );
            }
        });
}
