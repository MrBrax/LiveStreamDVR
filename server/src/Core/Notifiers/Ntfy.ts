import type { NotificationCategory } from "@common/Defs";
import axios from "axios";
import chalk from "chalk";
import { Config } from "../Config";
import { LOGLEVEL, log } from "../Log";

export default function notify(
    title: string,
    body = "",
    icon = "",
    category: NotificationCategory, // change this?
    url = "",
    tts = false
) {
    const ntfyUrl = Config.getInstance().cfg<string>("notifications.ntfy.url");

    if (ntfyUrl) {
        axios
            .request({
                url: ntfyUrl,
                headers: {
                    Title: title,
                    Actions: url ? `view, Open, ${url}` : undefined,
                    Icon: icon ?? undefined,
                },
                data: body,
                method: "POST",
            })
            .then((res) => {
                log(
                    LOGLEVEL.DEBUG,
                    "clientBroker.notify",
                    "Ntfy response",
                    res.data
                );
            })
            .catch((err: Error) => {
                if (axios.isAxiosError(err)) {
                    if (err.response) {
                        log(
                            LOGLEVEL.ERROR,
                            "clientBroker.notify",
                            `Ntfy axios error response: ${err.message} (${err.response.data})`,
                            { err: err, response: err.response.data }
                        );
                        console.error(
                            chalk.bgRed.whiteBright(
                                `Ntfy axios error response : ${err.message} (${err.response.data})`
                            ),
                            JSON.stringify(err, null, 2)
                        );
                    } else if (err.request) {
                        log(
                            LOGLEVEL.ERROR,
                            "clientBroker.notify",
                            `Ntfy axios error request: ${err.message} (${err.request})`,
                            { err: err, request: err.request }
                        );
                        console.error(
                            chalk.bgRed.whiteBright(
                                `Ntfy axios error request : ${err.message} (${err.request})`
                            ),
                            JSON.stringify(err, null, 2)
                        );
                    } else {
                        log(
                            LOGLEVEL.ERROR,
                            "clientBroker.notify",
                            `Ntfy axios error: ${err.message}`,
                            { err: err }
                        );
                        console.error(
                            chalk.bgRed.whiteBright(
                                `Ntfy axios error : ${err.message}`
                            ),
                            JSON.stringify(err, null, 2)
                        );
                    }
                } else {
                    log(
                        LOGLEVEL.ERROR,
                        "clientBroker.notify",
                        `Ntfy error: ${err.message}`,
                        { err: err }
                    );
                    console.error(
                        chalk.bgRed.whiteBright(`Ntfy error : ${err.message}`),
                        JSON.stringify(err, null, 2)
                    );
                }
            });
    }
}
