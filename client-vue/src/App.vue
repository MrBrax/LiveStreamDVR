<template>
    <div class="splitter">
        <side-menu />
        <div class="content">
            <div v-if="errors" class="big-error">
                <div v-for="error in errors" :key="error" class="big-error-item">Error</div>
            </div>
            <router-view v-if="store.config !== null && store.favourite_games !== null" ref="view" />
            <div v-else>
                <div class="container">
                    <section class="section">
                        <div class="section-content">
                            <span class="icon"><fa icon="sync" spin></fa></span> Loading...
                        </div>
                    </section>
                </div>
            </div>
        </div>
        <job-status ref="jobstatus" />
        <websocket-status
            :websocket="websocket"
            :websocketConnected="websocketConnected"
            :websocketConnecting="websocketConnecting"
            :timer="timer"
            :tickerInterval="tickerInterval"
            :loading="loading"
        />
    </div>
</template>

<style lang="scss"></style>

<script lang="ts">
import { defineComponent, reactive, ref } from "vue";

import SideMenu from "@/components/SideMenu.vue";
import { useStore } from "./store";
import type { ApiSettingsResponse } from "@common/Api/Api";
import JobStatus from "./components/JobStatus.vue";
// import { connectWebsocket, eventListener, WebsocketJSON } from "./websocket";
import { ChapterUpdateData, EndCaptureData, EndConvertData, JobClear, JobSave, NotifyData, VodRemoved, VodUpdated, WebhookAction } from "@common/Webhook";
import { ApiLogLine } from "@common/Api/Client";
import { parseISO } from "date-fns";
import { WebsocketJSON } from "./websocket";
import WebsocketStatus from "./components/WebsocketStatus.vue";
// import websocket from "./websocket";

const faviconCanvas = document.createElement("canvas");
faviconCanvas.width = 32;
faviconCanvas.height = 32;
const faviconCtx = faviconCanvas.getContext("2d");

const faviconElement = document.querySelector("link[rel='icon']") as HTMLLinkElement;
const faviconTempImage = new Image();
faviconTempImage.src = faviconElement.href;
faviconTempImage.onload = () => {
    if (!faviconCtx) return;
    faviconCtx.drawImage(faviconTempImage, 0, 0, 32, 32);
};

export default defineComponent({
    name: "App",
    setup() {
        const store = useStore();
        return { store };
    },
    data(): {
        loading: boolean;
        errors: string[];
        websocket: WebSocket | undefined;
        websocketConnected: boolean;
        websocketConnecting: boolean;
        websocketKeepalive: number;
        websocketKeepaliveTime: number;
        websocketLastPing: number;
        vodUpdateInterval: number; // interval
        timer: number;
        timerMax: number;
        tickerInterval: number; // interval
        faviconSub: () => void;
    } {
        return {
            loading: false,
            errors: [],
            websocket: undefined,
            websocketConnected: false,
            websocketConnecting: false,
            websocketKeepalive: 0,
            websocketKeepaliveTime: 20 * 1000,
            websocketLastPing: 0,
            vodUpdateInterval: 0,
            timer: 120,
            timerMax: 120,
            tickerInterval: 0,
            faviconSub: () => {
                console.log("faviconSub");
            },
        };
    },
    provide() {
        return {
            websocket: this.websocket,
        };
    },
    created() {
        console.debug("App created");
        this.store.fetchClientConfig();
        this.watchFaviconBadgeSub();
        this.fetchData().then(() => {
            this.updateTitle();
            if (this.store.cfg("websocket_enabled") && this.store.clientCfg('useWebsockets')) {
                console.debug("Connecting websocket...");
                this.connectWebsocket();
            } else {
                console.debug("Websocket disabled");
                if (this.store.clientCfg('useBackgroundTicker')) {
                    console.debug("Starting background ticker...");
                    this.tickerInterval = setInterval(() => {
                        this.tickTicker();
                    }, 1000);
                }
            }

            // update vods every 15 minutes
            if (this.store.clientCfg('useBackgroundRefresh')) {
                this.vodUpdateInterval = setInterval(() => {
                    this.store.updateCapturingVods();
                }, 1000 * 60 * 15);
            }

        }).catch((error) => {
            console.error("fetchData error", error);
        });
    },
    unmounted() {
        console.debug("App unmounted");
        this.disconnectWebsocket();
        if (this.faviconSub) this.faviconSub();
        if (this.vodUpdateInterval) clearTimeout(this.vodUpdateInterval);
        if (this.tickerInterval) clearTimeout(this.tickerInterval);
    },
    methods: {
        async fetchData() {
            // clear config
            this.store.updateConfig(null);

            let response;

            try {
                response = await this.$http.get(`/api/v0/settings`);
            } catch (error) {
                alert(error);
                return;
            }

            if (response.status !== 200) {
                alert("Non-200 response from server");
                return;
            }

            if (!response.data || !response.data.data) {
                alert("No data received for settings");
                return;
            }

            const data: ApiSettingsResponse = response.data;

            console.log(`Server type: ${data.data.server ?? "unknown"}`);

            this.store.updateConfig(data.data.config);
            this.store.updateVersion(data.data.version);
            this.store.updateServerType(data.data.server);
            this.store.updateFavouriteGames(data.data.favourite_games);
            this.store.updateErrors(data.data.errors ?? []);
            this.store.websocketUrl = data.data.websocket_url;
            this.store.app_name = data.data.app_name;

            await this.store.fetchAndUpdateStreamerList();
            await this.store.fetchAndUpdateJobs();

        },
        connectWebsocket(): WebSocket | undefined {

            let websocket_url = "";

            if (this.store.clientCfg('websocketAddressOverride')) {
                websocket_url = this.store.clientCfg('websocketAddressOverride');
                console.debug(`Overriding generated websocket URL with client config '${this.store.clientCfg('websocketAddressOverride')}'`);
            } else {
                if (!this.store.websocketUrl || this.store.websocketUrl == "") {
                    console.error("No websocket URL found");
                    return;
                }
                websocket_url = this.store.websocketUrl;
            }

            console.log(`Connecting to ${websocket_url}`);
            this.websocketConnecting = true;
            this.websocket = new WebSocket(websocket_url);

            this.websocket.addEventListener("open", (ev: Event) => {
                console.log("Connected to websocket!");
                if (!this.websocket) return;
                this.websocket.send(JSON.stringify({ action: "helloworld" }));
                // this.websocketConnected = true;
                this.websocketConnecting = false;
                this.websocketKeepalive = setInterval(() => {
                    if (!this.websocket) return;
                    this.websocket.send("ping");
                }, this.websocketKeepaliveTime);
            });

            this.websocket.addEventListener("message", (ev: MessageEvent) => {

                let text: string = ev.data;

                if (text == "pong") {
                    // console.log("pong recieved");
                    this.websocketLastPing = Date.now();
                    return;
                }

                let json: WebsocketJSON;

                try {
                    json = JSON.parse(text);
                } catch (error) {
                    console.error("Couldn't parse json", text);
                    return;
                }

                this.handleWebsocketMessage(json.action, json.data);
            });

            this.websocket.addEventListener("error", (ev: Event) => {
                console.error(`Websocket error!`, ev);
                this.websocketConnected = false;
                this.websocketConnecting = false;
                clearInterval(this.websocketKeepalive);
            });

            this.websocket.addEventListener("close", (ev: CloseEvent) => {
                console.log(`Disconnected from websocket! (${ev.code}/${ev.reason})`);
                this.websocketConnecting = false;
                setTimeout(() => {
                    if (!ev.wasClean) {
                        this.connectWebsocket();
                    }
                }, 10000);
                this.websocketConnected = false;
                clearInterval(this.websocketKeepalive);
            });

            return this.websocket;

        },
        disconnectWebsocket() {
            if (!this.websocket) return;
            this.websocket.close();
            this.websocket = undefined;
            if (this.websocketKeepalive) clearInterval(this.websocketKeepalive);
        },
        handleWebsocketMessage(action: WebhookAction, data: any) {

            // const { action, data } = event.detail;

            if (action) {
                if (
                    action == "vod_updated" ||
                    action == "start_capture" ||
                    action == "start_download" ||
                    action == "start_convert" ||
                    // action == "end_capture" ||
                    // action == "end_convert"
                    action == "end_download"
                ) {
                    const _data: VodUpdated = data;
                    this.store.updateVodFromData(_data.vod);
                } else if (action == "vod_removed") {
                    const _data: VodRemoved = data;
                    this.store.removeVod(_data.basename);
                    // } else if (action == "start_download") {
                    //     const _data: StartDownloadData = data;
                    //     this.store.updateVod(data.vod);
                } else if (action == "end_capture") {
                    const _data: EndCaptureData = data;
                    this.store.updateVodFromData(_data.vod);
                } else if (action == "end_convert") {
                    const _data: EndConvertData = data;
                    this.store.updateVodFromData(_data.vod);
                } else if (action == "init") {
                    new Notification("Server connected to broker");
                } else if (action == "notify") {
                    const _data: NotifyData = data;
                    this.onNotify(_data.title, _data.body, _data.icon, _data.url, _data.tts);
                } else if (action == "log") {
                    // merge log lines
                    const newLines: ApiLogLine[] = data;

                    if (newLines.some((line) => line.date_string && parseISO(line.date_string).getDay() != new Date().getDay())) {
                        // new day, clear log
                        this.store.clearLog();
                        this.store.addLog(newLines);
                    } else {
                        this.store.addLog(newLines);
                    }

                    // FIXME: dashboard scroll
                    // setTimeout(() => {
                    //     this.logviewer?.scrollLog();
                    // }, 100);
                } else if (action == "job_save" || action == "job_update") {
                    const _data: JobSave = data;
                    this.store.updateJob(_data.job);
                } else if (action == "job_clear") {
                    const _data: JobClear = data;
                    this.store.removeJob(_data.job_name);
                } else if (action == "chapter_update") {
                    const _data: ChapterUpdateData = data;
                    console.log("chapter_update", data);
                    this.store.updateVodFromData(_data.vod);
                } else if (action == "connected") {
                    this.websocketConnected = true;
                    console.log("Got connection event");
                } else {
                    console.warn("Unknown action", action, data);
                }

                /*
                const downloader_actions = [
                    x "start_download",
                    x "end_download",
                    x "start_capture",
                    x "end_capture",
                    x "start_convert",
                    x "end_convert",
                    "chapter_update",
                    x "vod_removed",
                ];

                x const job_actions = ["job_save", "job_clear"];

                if (downloader_actions.includes(action)) {
                    console.log("Websocket update", action);

                    this.fetchStreamers().then((sl) => {
                        if ("streamer_list" in sl) this.store.updateStreamerList(sl.streamer_list);
                        this.loading = false;
                    });
                } else if (job_actions.includes(action)) {
                    console.log(`Websocket jobs update: ${action}`, json.data.job_name, json.data.job);
                    this.fetchJobs();
                x } else if (action == "notify") {
                    this.onNotify(json.data.title, json.data.body, json.data.icon, json.data.url, json.data.tts);
                x } else if (action == "init") {
                    const toast = new Notification("Server connected to broker");
                    console.log("Init", toast);
                x } else if (action == "log") {
                    // merge log lines
                    const newLines: ApiLogLine[] = json.data;

                    if (newLines.some((line) => line.date_string && parseISO(line.date_string).getDay() != new Date().getDay())) {
                        // new day, clear log
                        this.logLines = json.data;
                        // this.logFilename =
                    } else {
                        this.logLines = [...this.logLines, ...json.data];
                    }

                    setTimeout(() => {
                        this.scrollLog();
                    }, 100);
                x } else if (action == "vod_updated") {
                    const vod_data: ApiVod = json.data.vod;
                    this.store.updateVod(vod_data);
                } else {
                    console.log(`Websocket wrong action (${action})`);
                }
                */
            } else {
                console.log(`Websocket unknown data`, action, data);
            }
        },
        onNotify(title: string, body: string, icon: string, url: string, tts: boolean) {
            const toast = new Notification(title, {
                body: body,
                icon: icon,
            });

            if (url) {
                toast.onclick = () => {
                    window.open(url);
                };
            }

            if (tts || this.store.clientCfg('useSpeech')) {
                const utterance = new SpeechSynthesisUtterance(`${title} ${body}`);
                utterance.lang = "en-US";
                speechSynthesis.speak(utterance);
            }

            // flash icon in favicon 5 times
            // cors issue, so we can't use this
            /*
            if (icon) {
                const image = new Image();
                image.src = icon;
                image.onload = () => {
                    const tmp_canvas = document.createElement("canvas");
                    tmp_canvas.width = 32;
                    tmp_canvas.height = 32;
                    const tmp_ctx = tmp_canvas.getContext("2d");
                    if (tmp_ctx) {
                        tmp_ctx.drawImage(image, 0, 0, 32, 32);

                        let flash = 0;
                        let interval = setInterval(() => {
                            if (flash == 5) {
                                clearInterval(interval);
                                return;
                            }
                            if (flash % 2 == 0) {
                                faviconElement.href = tmp_canvas.toDataURL();
                            } else {
                                faviconElement.href = faviconCanvas.toDataURL();
                            }
                            flash++;
                        }, 700);
                    }
                };
            }
            */

            console.log(`Notify: ${title}: ${body}`);
        },
        watchFaviconBadgeSub() {
            this.faviconSub = this.store.$onAction(({ name, store, args, after, onError }) => {
                if (!args) return;
                if (name !== "updateStreamerList" && name !== "updateVod") return;
                after(() => {
                    this.setFaviconBadgeState(this.store.isAnyoneLive);
                });
            });
        },
        setFaviconBadgeState(state: boolean) {
            // draw favicon into canvas and add badge
            const canvas = document.createElement("canvas");
            canvas.width = 32;
            canvas.height = 32;

            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.drawImage(faviconCanvas, 0, 0);
                if (state) {
                    ctx.fillStyle = "red";

                    // draw circle badge
                    ctx.beginPath();
                    ctx.arc(26, 26, 6, 0, 2 * Math.PI);
                    ctx.fill();
                }

                faviconElement.href = canvas.toDataURL();
            }
        },
        updateTitle() {
            const channelsOnline = this.store.channelsOnline;
            const title = this.$route.meta.title || this.$route.name;
            const app_name = this.store.app_name;
            if (channelsOnline > 0) {
                document.title = `[${channelsOnline}] ${title} - ${app_name}`;
                this.setFaviconBadgeState(true);
            } else{
                document.title = `${title} - ${app_name}`;
                this.setFaviconBadgeState(false);
            }
        },
        async tickTicker() {
            if (this.timer <= 0 && !this.loading) {
                this.loading = true;
                const streamerResult = await this.store.fetchStreamerList();

                if (streamerResult && "streamer_list" in streamerResult) {
                    if (!this.store.isAnyoneLive) {
                        if (this.timerMax < 1800 /* 30 minutes */) {
                            this.timerMax += 10;
                        }
                    } else {
                        this.timerMax = 120;
                    }

                    this.store.updateStreamerList(streamerResult.streamer_list);

                    // this.logviewer?.fetchLog(); // can't do this in app, logviewer can't be accessed here
                    this.store.fetchAndUpdateJobs();
                }

                this.loading = false;

                this.timer = this.timerMax;
            } else {
                this.timer -= 1;
            }
            console.debug(`Ticker: ${this.timer}/${this.timerMax}`);
        },
    },
    components: {
        SideMenu,
        JobStatus,
        WebsocketStatus
    },
    watch: {
        // watch for title changes
        $route(to, from) {
            this.updateTitle();
        },
        "store.channelsOnline"(v) {
            this.updateTitle();
        },
    },
});

</script>
