import { useStore } from '@/store';

let websocket: WebSocket | undefined;

let connecting = false;
let connected = false;
let keepalive = 0; // interval
let keepaliveTime = 20000;
let lastPing = 0;
let events = new EventTarget();

export function connectWebsocket() {
    const store = useStore();

    let websocket_url = "";

    if (store.clientConfig?.websocketAddressOverride) {
        websocket_url = store.clientConfig.websocketAddressOverride;
        console.debug(`Overriding generated websocket URL with client config '${store.clientConfig.websocketAddressOverride}'`);
    } else {
        if (!store.websocketUrl || store.websocketUrl == "") {
            console.error("No websocket URL found");
            return;
        }
        websocket_url = store.websocketUrl;
    }

    console.log(`Connecting to ${websocket_url}`);
    connecting = true;
    websocket = new WebSocket(websocket_url);

    websocket.addEventListener("open", (ev: Event) => {
        console.log(`Connected to websocket!`, ev);
        if (!websocket) return;
        websocket.send(JSON.stringify({ action: "helloworld" }));
        connected = true;
        connecting = false;
        keepalive = setInterval(() => {
            if (!websocket) return;
            websocket.send("ping");
        }, keepaliveTime);
    });

    websocket.addEventListener("message", (ev: MessageEvent) => {

        let text: string = ev.data;

        if (text == "pong") {
            // console.log("pong recieved");
            lastPing = Date.now();
            return;
        }

        let json: WebsocketJSON;

        try {
            json = JSON.parse(text);
        } catch (error) {
            console.error("Couldn't parse json", text);
            return;
        }

        handleWebsocketMessage(json);
    });

    websocket.addEventListener("error", (ev: Event) => {
        console.error(`Websocket error!`, ev);
        connected = false;
        connecting = false;
        clearInterval(keepalive);
    });

    websocket.addEventListener("close", (ev: CloseEvent) => {
        console.log(`Disconnected from websocket! (${ev.code}/${ev.reason})`);
        connecting = false;
        setTimeout(() => {
            if (!ev.wasClean) {
                connectWebsocket();
            }
        }, 10000);
        connected = false;
        clearInterval(keepalive);
    });

}

function handleWebsocketMessage(json: WebsocketJSON) {
    console.debug(`Handle websocket message: ${JSON.stringify(json)}`);
    events.dispatchEvent(new CustomEvent<WebsocketJSON>("message", { detail: { action: json.action, data: json.data } }));
}

export function disconnectWebsocket() {
    if (websocket) {
        websocket.close();
        websocket = undefined;
    }
}

export function getWebSocket() {
    return websocket;
}

export function eventListener() {
    return events;
}

export interface WebsocketJSON {
    action: string;
    data: any;
}

// export websocket
export default {
    websocket,
    connecting,
    connected,
};