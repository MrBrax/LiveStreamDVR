import type { NotificationCategory } from "@common/Defs";
import axios from "axios";
import chalk from "chalk";
import { Config } from "../Config";
import { LOGLEVEL, log } from "../Log";

type Action = {
    action: "view" | "http";
    label: string;
    url: string;
    clear?: boolean;
    body?: string;
};

// action=<action1>, label=<label1>, paramN=... [; action=<action2>, label=<label2>, ...]
function buildActions(actions: Action[]) {
    return actions
        .map((action) => {
            return `action=${action.action}, label=${action.label}, ${
                action.url ? `url=${action.url}, ` : ""
            }${action.clear ? `clear=${action.clear}, ` : ""}${
                action.body ? `body='${action.body}', ` : ""
            }`;
        })
        .join("; ");
}

export default function notify({
    title,
    body = "",
    icon = "",
    category, // change this?
    url = "",
    emoji = "",
    actions = [],
}: {
    title: string;
    body?: string;
    icon?: string;
    category: NotificationCategory;
    url?: string;
    emoji?: string;
    actions?: Action[];
}) {
    const ntfyUrl = Config.getInstance().cfg<string>("notifications.ntfy.url");

    if (url) {
        actions.push({
            action: "http",
            label: "Open",
            url: url,
        });
    }

    if (ntfyUrl) {
        axios
            .request({
                url: ntfyUrl,
                headers: {
                    Title: title,
                    // Actions: url ? `view, Open, ${url}` : undefined,
                    Actions: buildActions(actions),
                    Icon: icon ?? undefined,
                    Tags: emoji ? `${emoji},${category}` : category,
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
