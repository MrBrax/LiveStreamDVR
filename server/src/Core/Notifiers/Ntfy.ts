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

type NtfyPublish = {
    topic: string;
    message?: string;
    title?: string;
    tags?: string[];
    priority?: number;
    actions?: Action[];
    click?: string;
    attach?: string;
    markdown?: boolean;
    icon?: string;
    filename?: string;
    delay?: string;
    email?: string;
    call?: string;
};

// action=<action1>, label=<label1>, paramN=... [; action=<action2>, label=<label2>, ...]/*

export default async function notify({
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
    const ntfyTopic = Config.getInstance().cfg<string>(
        "notifications.ntfy.topic"
    );

    if (url) {
        actions.push({
            action: "http",
            label: "Open",
            url: url,
        });
    }

    const bodyData: NtfyPublish = {
        topic: ntfyTopic,
        title: title,
        message: body,
        actions: actions,
        icon: icon ?? undefined,
        tags: emoji ? [emoji, category] : [category],
    };

    if (ntfyUrl) {
        let response;

        try {
            response = await axios.request({
                url: ntfyUrl,
                data: bodyData,
                headers: {
                    "Content-Type": "application/json",
                },
                method: "POST",
            });
        } catch (err) {
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
                    `Ntfy error: ${(err as Error).message}`,
                    { err: err }
                );
                console.error(
                    chalk.bgRed.whiteBright(
                        `Ntfy error : ${(err as Error).message}`
                    ),
                    JSON.stringify(err, null, 2)
                );
            }
            return;
        }

        log(
            LOGLEVEL.DEBUG,
            "clientBroker.notify",
            "Ntfy response",
            response.data
        );
    }
}
