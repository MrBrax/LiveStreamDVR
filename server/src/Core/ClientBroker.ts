// const { cli } = require('webpack');
import axios, { AxiosError } from "axios";
import chalk from "chalk";
import { IncomingMessage } from "node:http";
import WebSocket from "ws";
import fs from "node:fs";
import express from "express";
import { NotificationCategories, NotificationCategory, NotificationProvider } from "../../../common/Defs";
import { NotifyData } from "../../../common/Webhook";
import { BaseConfigPath } from "./BaseConfig";
import { Config } from "./Config";
import { Log, LOGLEVEL } from "./Log";
import { LiveStreamDVR } from "./LiveStreamDVR";

interface Client {
    id: string;
    ws: WebSocket;
    ip: string;
    alive: boolean;
    userAgent: string;
    authenticated: boolean;
}

interface TelegramSendMessagePayload {
    chat_id: number;
    text: string;
    parse_mode?: "MarkdownV2" | "Markdown" | "HTML";
    entities?: any;
    disable_web_page_preview?: boolean;
    disable_notification?: boolean;
    protect_content?: boolean;
    reply_to_message_id?: number;
    allow_sending_without_reply?: boolean;
    reply_markup?: any;
}

interface DiscordSendMessagePayload {
    content: string;
    username?: string;
    avatar_url?: string;
    tts?: boolean;
    embeds?: any;
    allowed_mentions?: any;
    components?: any;
    files?: any;
    payload_json?: string;
    attachments?: any;
    flags?: number;
}

export class ClientBroker {

    static clients: Client[] = [];
    static wss: WebSocket.Server<WebSocket.WebSocket> | undefined = undefined;

    // bitmask of notification categories and providers
    static notificationSettings: Record<NotificationCategory, number> = {} as Record<NotificationCategory, number>;

    static attach(server: WebSocket.Server<WebSocket.WebSocket>): void {

        console.log(chalk.green("Attaching WebSocket server to broker..."));

        this.clients = [];

        this.wss = server;

        this.wss.on("listening", () => {
            console.log(chalk.green("Client broker now attached to websocket."));
        });

        this.wss.on("error", (error) => {
            console.log("Websocket server error", error);
        });

        this.wss.on("connection", (ws: WebSocket, req: express.Request) => {

            const has_password = Config.getInstance().cfg<string>("password", "") != "";
            const is_guest_mode = Config.getInstance().cfg<boolean>("guest_mode", false);

            if (!has_password) {
                this.onConnect(ws, req);
            } else {

                const sp = Config.getInstance().sessionParser;
                if (sp) {
                    sp(req, {} as any, () => {
                        const is_authenticated = req.session.authenticated;
                        if (is_authenticated) {
                            this.onConnect(ws, req, is_authenticated);
                        } else {
                            console.log(chalk.red("Client attempted to connect without authentication."));
                            // ws.write(JSON.stringify({ action: "alert", data: "Authentication required." }));
                            ws.close(3000, "Authentication required.");
                        }
                    });
                }

            }

        });

        this.wss.on("close", () => {
            console.log("Shutting down websocket server");
        });

    }

    private static onConnect(ws: WebSocket.WebSocket, req: IncomingMessage, is_authenticated = false) {

        const client: Client = {
            id: req.headers["sec-websocket-key"] || "",
            ws: ws,
            ip: (req.headers["x-real-ip"] || req.headers["x-forwarded-for"] || req.socket.remoteAddress) as string,
            alive: true,
            userAgent: req.headers["user-agent"] || "",
            authenticated: is_authenticated,
        };

        // console.debug(chalk.magenta(`Client ${client.id} connected from ${client.ip}, user-agent: ${client.userAgent}`));

        this.clients.push(client);

        ws.on("message", (raw_message: WebSocket.RawData): void => {

            if (!this.wss) return;

            // console.log("message", ws, message);

            const message = raw_message.toString();

            if (message == "ping") {
                // console.debug(`Pong to ${ws.clientIP}`);
                ws.send("pong");
                return;
            }

            let data: any;

            try {
                data = JSON.parse(message);
            } catch (error) {
                console.error(`Invalid data from ${client.ip}: ${message}`);
                return;
            }

            /*
            if(data.server){
                this.wss.clients.forEach((client) => {
                    client.send(JSON.stringify({
                        action: "server",
                        data: data.data,
                    }));
                });
            }
            */

            console.log(`JSON from ${client.ip}:`, data);
            // console.debug(`Clients: ${this.wss.clients.size}`);

        });

        ws.on("pong", () => {
            client.alive = true;
            // console.log(`Pong from ${client.ip}`);
        });

        ws.on("error", (err) => {
            console.error("Client error", err);
        });

        ws.on("close", (code, reason) => {
            // console.log(`Client ${client.id} disconnected from ${client.ip}`);
            this.clients = this.clients.filter((c) => c.id != client.id);
        });

        ws.send(JSON.stringify({ action: "connected" }));

    }

    static broadcast(data: unknown) {

        if (LiveStreamDVR.shutting_down) return;

        const d = JSON.stringify(data);
        if (!this.wss) {
            console.error(chalk.bgRed.whiteBright(`No WebSocket server attached to broker for data: ${d.length > 64 ? d.substring(0, 64) + "..." : d}`));
            return;
        }

        if (this.wss.clients.size == 0) {
            console.error(chalk.grey(`No clients connected to broker for data: ${d.length > 64 ? d.substring(0, 64) + "..." : d}`));
            return;
        }

        // const has_password = Config.getInstance().cfg<string>("password", "") != "";
        // const is_guest_mode = Config.getInstance().cfg<boolean>("guest_mode", false);
        // 
        // const clients = this.clients.filter((c) => {
        //     if (has_password && !is_guest_mode) {
        //         return c.authenticated;
        //     } else if (has_password && is_guest_mode) {
        //         // filter each type
        //     }

        console.log(chalk.blueBright(`Broadcasting data to ${this.wss.clients.size} clients: ${d.length > 64 ? d.substring(0, 64) + "..." : d}`));
        this.wss.clients.forEach((client) => {
            client.send(d);
        });

    }

    /**
     * Send a notification to all browsers/clients
     * 
     * @param title 
     * @param body 
     * @param icon 
     */
    static notify(
        title: string,
        body = "",
        icon = "",
        category: NotificationCategory, // change this?
        url = "",
        tts = false
    ) {

        console.log(chalk.bgBlue.whiteBright(`Notifying clients: ${title}: ${body}, category ${category}`));

        if (ClientBroker.getNotificationSettingForProvider(category, NotificationProvider.WEBSOCKET)) {
            this.broadcast({
                action: "notify",
                data: {
                    title: title,
                    body: body,
                    icon: icon,
                    url: url,
                    tts: tts,
                } as NotifyData,
            });
        }

        if (Config.getInstance().cfg("telegram_enabled") && ClientBroker.getNotificationSettingForProvider(category, NotificationProvider.TELEGRAM)) {

            // escape with backslash
            // const escaped_title = title.replace(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/g, "\\$&");
            // const escaped_body = body.replace(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/g, "\\$&");

            const token = Config.getInstance().cfg("telegram_token");
            const chat_id = Config.getInstance().cfg("telegram_chat_id");

            if (token && chat_id) {

                axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
                    chat_id: chat_id,
                    text:
                        `<strong>${title}</strong>\n` +
                        `${body}` +
                        `${url ? `\n\n<a href="${url}">${url}</a>` : ""}`
                    ,
                    parse_mode: "HTML",
                } as TelegramSendMessagePayload).then((res) => {
                    Log.logAdvanced(LOGLEVEL.DEBUG, "notify", "Telegram response", res.data);
                }).catch((err: Error) => {
                    if (axios.isAxiosError(err)) {
                        // const data = err.response?.data;
                        // TwitchLog.logAdvanced(LOGLEVEL.ERROR, "notify", `Telegram axios error: ${err.message} (${data})`, { err: err, response: data });
                        // console.error(chalk.bgRed.whiteBright(`Telegram axios error: ${err.message} (${data})`), JSON.stringify(err, null, 2));

                        if (err.response) {
                            Log.logAdvanced(LOGLEVEL.ERROR, "notify", `Telegram axios error response: ${err.message} (${err.response.data})`, { err: err, response: err.response.data });
                            console.error(chalk.bgRed.whiteBright(`Telegram axios error response : ${err.message} (${err.response.data})`), JSON.stringify(err, null, 2));
                        } else if (err.request) {
                            Log.logAdvanced(LOGLEVEL.ERROR, "notify", `Telegram axios error request: ${err.message} (${err.request})`, { err: err, request: err.request });
                            console.error(chalk.bgRed.whiteBright(`Telegram axios error request: ${err.message} (${err.request})`), JSON.stringify(err, null, 2));
                        } else {
                            Log.logAdvanced(LOGLEVEL.ERROR, "notify", `Telegram axios error: ${err.message}`, err);
                            console.error(chalk.bgRed.whiteBright(`Telegram axios error: ${err.message}`), JSON.stringify(err, null, 2));
                        }

                    } else {
                        Log.logAdvanced(LOGLEVEL.ERROR, "notify", `Telegram error: ${err.message}`, err);
                        console.error(chalk.bgRed.whiteBright(`Telegram error: ${err.message}`));
                    }
                });

            } else if (!token && chat_id) {
                Log.logAdvanced(LOGLEVEL.ERROR, "notify", "Telegram token not set");
                console.error(chalk.bgRed.whiteBright("Telegram token not set"));
            } else if (!chat_id && token) {
                Log.logAdvanced(LOGLEVEL.ERROR, "notify", "Telegram chat ID not set");
                console.error(chalk.bgRed.whiteBright("Telegram chat ID not set"));
            } else {
                Log.logAdvanced(LOGLEVEL.ERROR, "notify", "Telegram token and chat ID not set");
                console.error(chalk.bgRed.whiteBright("Telegram token and chat ID not set"));
            }
        }

        if (Config.getInstance().cfg("discord_enabled") && ClientBroker.getNotificationSettingForProvider(category, NotificationProvider.DISCORD)) {
            axios.post(Config.getInstance().cfg("discord_webhook"), {
                content: `**${title}**\n${body}${url ? `\n\n${url}` : ""}`,
                avatar_url: icon,
                tts: tts,
            } as DiscordSendMessagePayload).then((res) => {
                Log.logAdvanced(LOGLEVEL.DEBUG, "notify", "Discord response", res.data);
            }).catch((err: AxiosError) => {
                if (axios.isAxiosError(err)) {
                    Log.logAdvanced(LOGLEVEL.ERROR, "notify", `Discord axios error: ${err.message} (${JSON.stringify(err.response?.data)})`, { err: err, response: err.response?.data });
                } else {
                    Log.logAdvanced(LOGLEVEL.ERROR, "notify", `Discord error: ${(err as Error).message}`, err);
                }
            });
        }

        if (Config.getInstance().cfg("notifications.pushover.enabled") && ClientBroker.getNotificationSettingForProvider(category, NotificationProvider.PUSHOVER)) {

            // escape with backslash
            // const escaped_title = title.replace(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/g, "\\$&");
            // const escaped_body = body.replace(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/g, "\\$&");

            axios.post("https://api.pushover.net/1/messages.json", {
                token: Config.getInstance().cfg("notifications.pushover.token"),
                user: Config.getInstance().cfg("notifications.pushover.user"),
                title: title,
                message: body,
                url: url,
                // html: 1,
            }).then((res) => {
                Log.logAdvanced(LOGLEVEL.DEBUG, "notify", "Pushover response", res.data);
            }).catch((err: Error) => {
                if (axios.isAxiosError(err)) {
                    // const data = err.response?.data;
                    // TwitchLog.logAdvanced(LOGLEVEL.ERROR, "notify", `Telegram axios error: ${err.message} (${data})`, { err: err, response: data });
                    // console.error(chalk.bgRed.whiteBright(`Telegram axios error: ${err.message} (${data})`), JSON.stringify(err, null, 2));

                    if (err.response) {
                        Log.logAdvanced(LOGLEVEL.ERROR, "notify", `Pushover axios error response: ${err.message} (${err.response.data})`, { err: err, response: err.response.data });
                        console.error(chalk.bgRed.whiteBright(`Pushover axios error response : ${err.message} (${err.response.data})`), JSON.stringify(err, null, 2));
                    } else if (err.request) {
                        Log.logAdvanced(LOGLEVEL.ERROR, "notify", `Pushover axios error request: ${err.message} (${err.request})`, { err: err, request: err.request });
                        console.error(chalk.bgRed.whiteBright(`Pushover axios error request: ${err.message} (${err.request})`), JSON.stringify(err, null, 2));
                    } else {
                        Log.logAdvanced(LOGLEVEL.ERROR, "notify", `Pushover axios error: ${err.message}`, err);
                        console.error(chalk.bgRed.whiteBright(`Pushover axios error: ${err.message}`), JSON.stringify(err, null, 2));
                    }

                } else {
                    Log.logAdvanced(LOGLEVEL.ERROR, "notify", `Pushover error: ${err.message}`, err);
                    console.error(chalk.bgRed.whiteBright(`Pushover error: ${err.message}`));
                }
            });
        }

    }

    static getNotificationSettingForProvider(category: NotificationCategory, provider: NotificationProvider): boolean {
        if (!this.notificationSettings[category]) return false;
        return this.notificationSettings[category] & provider ? true : false;
    }

    static setNotificationSettingForProvider(category: NotificationCategory, provider: NotificationProvider, value: boolean) {
        if (!this.notificationSettings[category]) this.notificationSettings[category] = 0;
        if (value) {
            this.notificationSettings[category] |= provider;
        } else {
            this.notificationSettings[category] &= ~provider;
        }
    }

    static resetNotificationSettings() {
        this.notificationSettings = {} as Record<NotificationCategory, number>;
        for (const category of NotificationCategories) {
            this.notificationSettings[category.id as NotificationCategory] = 0;
        }
    }

    static loadNotificationSettings() {
        if (!fs.existsSync(BaseConfigPath.notifications)) {
            this.resetNotificationSettings();
            return;
        }

        const data = fs.readFileSync(BaseConfigPath.notifications, "utf8");
        const settings = JSON.parse(data);

        for (const category of NotificationCategories) {
            if (settings[category.id as NotificationCategory]) {
                this.notificationSettings[category.id as NotificationCategory] = settings[category.id as NotificationCategory];
            } else {
                this.notificationSettings[category.id as NotificationCategory] = 0;
            }
        }

    }

    static saveNotificationSettings() {
        const data = JSON.stringify(this.notificationSettings);
        fs.writeFileSync(BaseConfigPath.notifications, data);
    }

}
