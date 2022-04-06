// const { cli } = require('webpack');
import axios, { AxiosError } from "axios";
import chalk from "chalk";
import { IncomingMessage } from "http";
import WebSocket from "ws";
import { NotificationProvider, TwitchConfig } from "./TwitchConfig";
import { TwitchLog, LOGLEVEL } from "./TwitchLog";

interface Client {
    id: string;
    ws: WebSocket;
    ip: string;
    alive: boolean;
    userAgent: string;
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

    static attach(server: WebSocket.Server<WebSocket.WebSocket>) {

        console.log(chalk.green("Attaching WebSocket server to broker..."));

        this.clients = [];

        this.wss = server;

        this.wss.on("listening", () => {
            console.log(chalk.green("Client broker now attached to websocket."));
        });

        this.wss.on("error", (error) => {
            console.log("Websocket server error", error);
        });

        this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
            this.onConnect(ws, req);
        });

    }

    private static onConnect(ws: WebSocket.WebSocket, req: IncomingMessage) {

        const client: Client = {
            id: req.headers["sec-websocket-key"] || "",
            ws: ws,
            ip: (req.headers["x-real-ip"] || req.headers["x-forwarded-for"] || req.socket.remoteAddress) as string,
            alive: true,
            userAgent: req.headers["user-agent"] || "",
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

    }

    static broadcast(data: any) {
        const d = JSON.stringify(data);
        if (!this.wss) {
            console.error(chalk.bgRed.whiteBright(`No WebSocket server attached to broker for data: ${d.length > 64 ? d.substring(0, 64) + "..." : d}`));
            return;
        }
        
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
        category: NotificationProvider, // change this?
        url = "",
        tts = false
    ) {
        
        console.log(chalk.bgBlue.whiteBright(`Notifying clients: ${title}: ${body}, category ${category}`));
        
        if (category & NotificationProvider.WEBSOCKET) {
            this.broadcast({
                action: "notify",
                data: {
                    title: title,
                    body: body,
                    icon: icon,
                    url: url,
                    tts: tts,
                },
            });
        }
        
        if (TwitchConfig.cfg("telegram_enabled") && category & NotificationProvider.TELEGRAM) {

            // escape with backslash
            // const escaped_title = title.replace(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/g, "\\$&");
            // const escaped_body = body.replace(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/g, "\\$&");

            axios.post(`https://api.telegram.org/bot${TwitchConfig.cfg("telegram_token")}/sendMessage`, {
                chat_id: TwitchConfig.cfg<number>("telegram_chat_id"),
                text:
                    `<strong>${title}</strong><br>` +
                    `${body}` +
                    `${url ? `<br><br><a href="${url}">${url}</a>` : ""}`
                ,
                parse_mode: "HTML",
            } as TelegramSendMessagePayload).then((res) => {
                // console.debug("Telegram response", res);
            }).catch((err: Error) => {
                if (axios.isAxiosError(err)) {
                    // const data = err.response?.data;
                    // TwitchLog.logAdvanced(LOGLEVEL.ERROR, "webhook", `Telegram axios error: ${err.message} (${data})`, { err: err, response: data });
                    // console.error(chalk.bgRed.whiteBright(`Telegram axios error: ${err.message} (${data})`), JSON.stringify(err, null, 2));

                    if (err.response) {
                        TwitchLog.logAdvanced(LOGLEVEL.ERROR, "webhook", `Telegram axios error response: ${err.message} (${err.response.data})`, { err: err, response: err.response.data });
                        console.error(chalk.bgRed.whiteBright(`Telegram axios error response : ${err.message} (${err.response.data})`), JSON.stringify(err, null, 2));
                    } else if (err.request) {
                        TwitchLog.logAdvanced(LOGLEVEL.ERROR, "webhook", `Telegram axios error request: ${err.message} (${err.request})`, { err: err, request: err.request });
                        console.error(chalk.bgRed.whiteBright(`Telegram axios error request: ${err.message} (${err.request})`), JSON.stringify(err, null, 2));
                    } else {
                        TwitchLog.logAdvanced(LOGLEVEL.ERROR, "webhook", `Telegram axios error: ${err.message}`, err);
                        console.error(chalk.bgRed.whiteBright(`Telegram axios error: ${err.message}`), JSON.stringify(err, null, 2));
                    }

                } else {
                    TwitchLog.logAdvanced(LOGLEVEL.ERROR, "webhook", `Telegram error: ${err.message}`, err);
                    console.error(chalk.bgRed.whiteBright(`Telegram error: ${err.message}`));
                }
            });
        }

        if (TwitchConfig.cfg("discord_enabled") && category & NotificationProvider.DISCORD) {
            axios.post(TwitchConfig.cfg("discord_webhook"), {
                content: `**${title}**\n${body}${url ? `\n\n${url}` : ""}`,
                avatar_url: icon,
                tts: tts,
            } as DiscordSendMessagePayload).then((res) => {
                // console.debug("Discord response", res);
            }).catch((err: AxiosError) => {
                TwitchLog.logAdvanced(LOGLEVEL.ERROR, "webhook", `Discord error: ${err.message}`);
            });
        }
        
    }

}
