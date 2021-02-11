// const { cli } = require('webpack');
const WebSocket = require('ws');

class ClientBroker {
    constructor(){
        this.clients = [];
        this.wss = null;
    }
    start () {
        console.log('Starting...');
        this.wss = new WebSocket.Server({ port: 8765 });

        this.wss.on('connection', this.onConnect.bind(this));
    }

    onConnect(ws, req){
        const clientIP = req.connection.remoteAddress;
        ws.clientIP = clientIP;
        // console.log(clientIP);
        this.clients.push(ws);

        ws.on("message", (message) => this.onMessage(ws, message));
        ws.on("pong", (heartbeat) => {
            ws.isAlive = true;
            console.log(`Pong from ${clientIP}`);
        });
        ws.on("error", (err) => {
            console.error('Client error', err)
        });
    }

    onMessage(ws, message){
        // console.log("message", ws, message);
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

        console.log("json", data);
        console.debug(`Clients: ${this.wss.clients.size}`);
    }
}

const cb = new ClientBroker();
cb.start();