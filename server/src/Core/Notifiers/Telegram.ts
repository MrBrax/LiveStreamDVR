import type { NotificationCategory } from "@common/Defs";
import axios from "axios";
import chalk from "chalk";
import { Config } from "../Config";
import { LOGLEVEL, log } from "../Log";

interface TelegramSendMessagePayload {
    chat_id: number;
    text: string;
    parse_mode?: "MarkdownV2" | "Markdown" | "HTML";
    entities?: unknown;
    disable_web_page_preview?: boolean;
    disable_notification?: boolean;
    protect_content?: boolean;
    reply_to_message_id?: number;
    allow_sending_without_reply?: boolean;
    reply_markup?: unknown;
}

export default function notify(
    title: string,
    body = "",
    icon = "",
    category: NotificationCategory, // change this?
    url = ""
) {
    // escape with backslash
    // const escaped_title = title.replace(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/g, "\\$&");
    // const escaped_body = body.replace(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/g, "\\$&");

    const token = Config.getInstance().cfg<string>("telegram_token");
    const chatId = Config.getInstance().cfg<number>("telegram_chat_id");

    if (token && chatId) {
        axios
            .post(`https://api.telegram.org/bot${token}/sendMessage`, {
                chat_id: chatId,
                text:
                    `<strong>${title}</strong>\n` +
                    `${body}` +
                    `${url ? `\n\n<a href="${url}">${url}</a>` : ""}`,
                parse_mode: "HTML",
            } as TelegramSendMessagePayload)
            .then((res) => {
                log(
                    LOGLEVEL.DEBUG,
                    "clientBroker.notify",
                    "Telegram response",
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
                            `Telegram axios error response: ${err.message} (${err.response.data})`,
                            { err: err, response: err.response.data }
                        );
                        console.error(
                            chalk.bgRed.whiteBright(
                                `Telegram axios error response : ${err.message} (${err.response.data})`
                            ),
                            JSON.stringify(err, null, 2)
                        );
                    } else if (err.request) {
                        log(
                            LOGLEVEL.ERROR,
                            "clientBroker.notify",
                            `Telegram axios error request: ${err.message} (${err.request})`,
                            { err: err, request: err.request }
                        );
                        console.error(
                            chalk.bgRed.whiteBright(
                                `Telegram axios error request: ${err.message} (${err.request})`
                            ),
                            JSON.stringify(err, null, 2)
                        );
                    } else {
                        log(
                            LOGLEVEL.ERROR,
                            "clientBroker.notify",
                            `Telegram axios error: ${err.message}`,
                            err
                        );
                        console.error(
                            chalk.bgRed.whiteBright(
                                `Telegram axios error: ${err.message}`
                            ),
                            JSON.stringify(err, null, 2)
                        );
                    }
                } else {
                    log(
                        LOGLEVEL.ERROR,
                        "clientBroker.notify",
                        `Telegram error: ${err.message}`,
                        err
                    );
                    console.error(
                        chalk.bgRed.whiteBright(
                            `Telegram error: ${err.message}`
                        )
                    );
                }
            });
    } else if (!token && chatId) {
        log(LOGLEVEL.ERROR, "clientBroker.notify", "Telegram token not set");
        console.error(chalk.bgRed.whiteBright("Telegram token not set"));
    } else if (!chatId && token) {
        log(LOGLEVEL.ERROR, "clientBroker.notify", "Telegram chat ID not set");
        console.error(chalk.bgRed.whiteBright("Telegram chat ID not set"));
    } else {
        log(
            LOGLEVEL.ERROR,
            "clientBroker.notify",
            "Telegram token and chat ID not set"
        );
        console.error(
            chalk.bgRed.whiteBright("Telegram token and chat ID not set")
        );
    }
}
