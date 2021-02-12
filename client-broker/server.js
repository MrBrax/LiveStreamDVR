// const { cli } = require('webpack');
const WebSocket = require('ws');

class ClientBroker {
    constructor(){
        this.clients = [];
        this.wss = null;
    }
    start () {
        const a = process.argv.slice(2);
        const serverPort = a[0] ? parseInt(a[0]) : 8765;
        
        console.log(`Starting on port ${serverPort}...`);
        try {
            this.wss = new WebSocket.Server({ port: serverPort });
        } catch (error) {
            console.error("Fatal error when starting broker server", error);
            return false;
        }

        this.wss.on("listening", () => {
            console.log("Websocket server now listening for connections.");
        });

        this.wss.on('error', (error) => {
            console.log("Websocket server error", error);
        });

        this.wss.on('connection', this.onConnect.bind(this));
    }

    onConnect(ws, req){
        // const clientIP = req.connection.remoteAddress;
        const clientIP = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || req.connection.socket.remoteAddress;
        ws.clientIP = clientIP;
        // console.log(clientIP);
        this.clients.push(ws);

        ws.on("message", (message) => this.onMessage(ws, message));
        ws.on("pong", (heartbeat) => {
            ws.isAlive = true;
            console.log(`Pong from ${clientIP}`);
        });
        ws.on("error", (err) => {
            console.error("Client error", err)
        });
    }

    onMessage(ws, message){
        // console.log("message", ws, message);

        if(message == "ping"){
            // console.debug(`Pong to ${ws.clientIP}`);
            ws.send("pong");
            return;
        }

        let data;

        try {
            data = JSON.parse(message);
        } catch (error) {
            console.error(`Invalid data from ${ws.clientIP}: ${message}`)
            return;
        }

        if(data.server){
            this.wss.clients.forEach((client) => {
                client.send(JSON.stringify({
                    action: "server",
                    data: data.data
                }));
            });
        }

        console.log(`JSON from ${ws.clientIP}:`, data);
        console.debug(`Clients: ${this.wss.clients.size}`);
    }
}

const cb = new ClientBroker();
cb.start();