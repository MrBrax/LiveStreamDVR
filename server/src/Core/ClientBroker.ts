// const { cli } = require('webpack');
import chalk from "chalk";
import { IncomingMessage } from "http";
import WebSocket from "ws";

interface Client {
    id: string;
    ws: WebSocket;
    ip: string;
    alive: boolean;
    userAgent: string;
}

export class ClientBroker {
    
    static clients: Client[] = [];
    static wss: WebSocket.Server<WebSocket.WebSocket> | undefined = undefined;
    
    static attach(server: WebSocket.Server<WebSocket.WebSocket>){

        console.log(chalk.bgGreen.whiteBright("Attaching WebSocket server to broker"));
        
        this.clients = [];

        this.wss = server;

        this.wss.on("listening", () => {
            console.log(chalk.bgGreen.whiteBright("Websocket server now listening for connections."));
        });

        this.wss.on("error", (error) => {
            console.log("Websocket server error", error);
        });

        this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
            this.onConnect(ws, req);
        });

    }

    private static onConnect(ws: WebSocket.WebSocket, req: IncomingMessage){

        const client: Client = {
            id: req.headers["sec-websocket-key"] || "",
            ws: ws,
            ip: (req.headers["x-real-ip"] || req.headers["x-forwarded-for"] || req.socket.remoteAddress) as string,
            alive: true,
            userAgent: req.headers["user-agent"] || "",
        };

        console.debug(chalk.magenta(`Client ${client.id} connected from ${client.ip}, user-agent: ${client.userAgent}`));

        this.clients.push(client);

        ws.on("message", (raw_message: WebSocket.RawData): void => {

            if (!this.wss) return;

            // console.log("message", ws, message);

            const message = raw_message.toString();

            if(message == "ping"){
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
            console.log(`Pong from ${client.ip}`);
        });

        ws.on("error", (err) => {
            console.error("Client error", err);
        });

        ws.on("close", (code, reason) => {
            console.log(`Client ${client.id} disconnected from ${client.ip}`);
            this.clients = this.clients.filter((c) => c.id != client.id);
        });

    }

    static broadcast(data: any){
        if (!this.wss) return;
        this.wss.clients.forEach((client) => {
            client.send(JSON.stringify(data));
        });
    }

}
