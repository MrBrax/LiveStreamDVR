// const { cli } = require('webpack');
import { debugLog } from "@/Helpers/Console";
import type { NotificationCategory } from "@common/Defs";
import { NotificationCategories, NotificationProvider } from "@common/Defs";
import type { NotifyData } from "@common/Webhook";
import chalk from "chalk";
import type express from "express";
import fs from "node:fs";
import type { IncomingMessage } from "node:http";
import type WebSocket from "ws";
import { BaseConfigPath } from "./BaseConfig";
import { Config } from "./Config";
import { LiveStreamDVR } from "./LiveStreamDVR";
import { LOGLEVEL, log } from "./Log";
import DiscordNotify from "./Notifiers/Discord";
import NtfyNotify from "./Notifiers/Ntfy";
import PushoverNotify from "./Notifiers/Pushover";
import TelegramNotify from "./Notifiers/Telegram";

interface Client {
    id: string;
    ws: WebSocket;
    ip: string;
    alive: boolean;
    userAgent: string;
    authenticated: boolean;
}

export class ClientBroker {
    public static clients: Client[] = [];
    public static wss: WebSocket.Server<WebSocket.WebSocket> | undefined =
        undefined;

    // bitmask of notification categories and providers
    public static notificationSettings: Record<NotificationCategory, number> = {
        offlineStatusChange: 0,
        streamOnline: 0,
        streamOffline: 0,
        streamStatusChange: 0,
        streamStatusChangeFavourite: 0,
        vodMuted: 0,
        vodDeleted: 0,
        debug: 0,
        system: 0,
    };

    public static attach(server: WebSocket.Server<WebSocket.WebSocket>): void {
        log(
            LOGLEVEL.INFO,
            "clientBroker.attach",
            "Attaching WebSocket server to broker..."
        );

        this.clients = [];

        this.wss = server;

        this.wss.on("listening", () => {
            log(
                LOGLEVEL.INFO,
                "clientBroker.attach",
                "Client broker now attached to websocket."
            );
        });

        this.wss.on("error", (error) => {
            log(
                LOGLEVEL.ERROR,
                "clientBroker.attach",
                "Websocket server error",
                error
            );
        });

        this.wss.on("connection", (ws: WebSocket, req: express.Request) => {
            const hasPassword =
                Config.getInstance().cfg<string>("password", "") != "";
            // const is_guest_mode = Config.getInstance().cfg<boolean>(
            //     "guest_mode",
            //     false
            // );

            if (!hasPassword) {
                this.onConnect(ws, req);
            } else {
                const sp = Config.getInstance().sessionParser;
                if (sp) {
                    sp(req, {} as any, () => {
                        const isAuthenticated = req.session.authenticated;
                        if (isAuthenticated) {
                            this.onConnect(ws, req, isAuthenticated);
                        } else {
                            console.log(
                                chalk.red(
                                    "Client attempted to connect without authentication."
                                )
                            );
                            // ws.write(JSON.stringify({ action: "alert", data: "Authentication required." }));
                            ws.close(3000, "Authentication required.");
                        }
                    });
                }
            }
        });

        this.wss.on("close", () => {
            debugLog("Shutting down websocket server");
        });
    }

    public static broadcast(broadcastData: unknown) {
        if (LiveStreamDVR.shutting_down) return;

        // const jsonData = JSON.stringify(data);
        let jsonData: string;

        try {
            jsonData = JSON.stringify(broadcastData);
        } catch (error) {
            console.error(
                chalk.bgRed.whiteBright(
                    `Error stringifying data: ${(error as Error).message}`
                )
            );
            return;
        }

        if (!this.wss) {
            console.error(
                chalk.bgRed.whiteBright(
                    `No WebSocket server attached to broker for data: ${
                        jsonData.length > 64
                            ? jsonData.substring(0, 64) + "..."
                            : jsonData
                    }`
                )
            );
            return;
        }

        if (this.wss.clients.size == 0) {
            debugLog(
                chalk.grey(
                    `No clients connected to broker for data: ${
                        jsonData.length > 64
                            ? jsonData.substring(0, 64) + "..."
                            : jsonData
                    }`
                )
            );
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

        debugLog(
            chalk.blueBright(
                `Broadcasting data to ${this.wss.clients.size} clients: ${
                    jsonData.length > 64
                        ? jsonData.substring(0, 64) + "..."
                        : jsonData
                }`
            )
        );
        this.wss.clients.forEach((client) => {
            client.send(jsonData);
        });
    }

    /**
     * Send a notification to all browsers/clients
     *
     * @param title
     * @param body
     * @param icon
     * @param category
     * @param url
     * @param tts
     */
    public static notify(
        title: string,
        body = "",
        icon = "",
        category: NotificationCategory, // change this?
        url = "",
        tts = false
    ) {
        // console.log(chalk.bgBlue.whiteBright(`Notifying clients: ${title}: ${body}, category ${category}`));

        log(
            LOGLEVEL.INFO,
            "clientBroker.notify",
            `(${category}) ${title}: ${body}`,
            {
                title: title,
                body: body,
                icon: icon,
                category: category,
                url: url,
                tts: tts,
            }
        );

        if (!title) {
            log(LOGLEVEL.WARNING, "clientBroker.notify", "No title specified", {
                title: title,
                body: body,
                icon: icon,
                category: category,
                url: url,
                tts: tts,
            });
        }

        if (!body) {
            log(LOGLEVEL.WARNING, "clientBroker.notify", "No body specified", {
                title: title,
                body: body,
                icon: icon,
                category: category,
                url: url,
                tts: tts,
            });
        }

        if (
            ClientBroker.getNotificationSettingForProvider(
                category,
                NotificationProvider.WEBSOCKET
            )
        ) {
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

        if (
            ClientBroker.getNotificationSettingForProvider(
                category,
                NotificationProvider.TELEGRAM
            )
        ) {
            TelegramNotify(title, body, icon, category, url);
        }

        if (
            ClientBroker.getNotificationSettingForProvider(
                category,
                NotificationProvider.NTFY
            )
        ) {
            NtfyNotify({ title, body, icon, category, url });
        }

        if (
            ClientBroker.getNotificationSettingForProvider(
                category,
                NotificationProvider.DISCORD
            )
        ) {
            DiscordNotify(title, body, icon, category, url, tts);
        }

        if (
            ClientBroker.getNotificationSettingForProvider(
                category,
                NotificationProvider.PUSHOVER
            )
        ) {
            PushoverNotify(title, body, icon, category, url, tts);
        }
    }

    public static getNotificationSettingForProvider(
        category: NotificationCategory,
        provider: NotificationProvider
    ): boolean {
        if (!this.notificationSettings[category]) return false;
        return this.notificationSettings[category] & provider ? true : false;
    }

    public static setNotificationSettingForProvider(
        category: NotificationCategory,
        provider: NotificationProvider,
        value: boolean
    ) {
        if (!this.notificationSettings[category])
            this.notificationSettings[category] = 0;
        if (value) {
            this.notificationSettings[category] |= provider;
        } else {
            this.notificationSettings[category] &= ~provider;
        }
    }

    public static resetNotificationSettings() {
        this.notificationSettings = {} as Record<NotificationCategory, number>;
        for (const category of NotificationCategories) {
            this.notificationSettings[category.id as NotificationCategory] = 0;
        }
    }

    public static loadNotificationSettings() {
        if (!fs.existsSync(BaseConfigPath.notifications)) {
            this.resetNotificationSettings();
            return;
        }

        const data = fs.readFileSync(BaseConfigPath.notifications, "utf8");
        const settings = JSON.parse(data);

        for (const category of NotificationCategories) {
            if (!category.id || !category.name) continue;
            if (settings[category.id]) {
                this.notificationSettings[category.id] = settings[category.id];
            } else {
                this.notificationSettings[category.id] = 0;
            }
        }
    }

    public static saveNotificationSettings() {
        fs.writeFileSync(
            BaseConfigPath.notifications,
            JSON.stringify(this.notificationSettings)
        );
    }

    private static onConnect(
        ws: WebSocket.WebSocket,
        req: IncomingMessage,
        is_authenticated = false
    ) {
        const client: Client = {
            id: req.headers["sec-websocket-key"] || "",
            ws: ws,
            ip: (req.headers["x-real-ip"] ||
                req.headers["x-forwarded-for"] ||
                req.socket.remoteAddress) as string,
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

            let data: unknown;

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

            debugLog(`JSON from ${client.ip}:`, data);
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
}
