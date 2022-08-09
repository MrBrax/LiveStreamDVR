<template>
    <div class="splitter">
        <side-menu />
        <div class="content">
            <section class="section" v-if="(store.authentication && !store.authenticated && !store.guest_mode)">
                <div class="errors">
                    This site is only available to logged in users.
                </div>
            </section>
            <div v-if="errors" class="big-error">
                <div v-for="error in errors" :key="error" class="big-error-item">Error</div>
            </div>
            <router-view v-if="store.config !== null && store.favourite_games !== null" ref="view" />
            <div v-else>
                <div class="container">
                    <section class="section">
                        <div class="section-content">
                            <span class="icon"><fa icon="sync" spin></fa></span> {{ $t("messages.loading") }}
                        </div>
                    </section>
                </div>
            </div>
        </div>
        <job-status ref="jobstatus" v-if="store.authElement" />
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
import { ChannelUpdated, ChapterUpdateData, EndCaptureData, EndConvertData, JobClear, JobProgress, JobSave, NotifyData, VodRemoved, VodUpdated, WebhookAction } from "@common/Webhook";
import { ApiLogLine } from "@common/Api/Client";
import { parseISO } from "date-fns";
import { WebsocketJSON } from "./websocket";
import WebsocketStatus from "./components/WebsocketStatus.vue";
import axios from "axios";
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
        this.$i18n.locale = this.store.clientConfig?.language ?? "en";
        // this.applyAuthentication();
        this.watchFaviconBadgeSub();
        this.checkLoginStatus().then((s) => {
            
            this.store.authentication = s.authentication;
            this.store.authenticated = s.status;
            this.store.guest_mode = s.guest_mode;
            console.log("checkLoginStatus", s);

            if ((this.store.authentication && this.store.authenticated) || this.store.guest_mode || !this.store.authentication) {
                this.fetchInitialData();
            }
            
        });

        const wantsReducedMotion = this.prefersReducedMotion();
        const hasSeenPopup = localStorage.getItem("hasSeenReducedMotionPopup") === "true";
        if (!hasSeenPopup && wantsReducedMotion && this.store.clientConfig) {
            const choice = window.confirm("You have enabled reduced motion in your browser/OS.\nDo you want to disable animations in the app?");
            if (choice) {
                localStorage.setItem("hasSeenReducedMotionPopup", "true");
                this.store.clientConfig.animationsEnabled = false;
                this.store.saveClientConfig();
                alert("Animations have been disabled.\nYou can enable them in the client settings.");
            }
        }

        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") {
                console.debug("Visibility change: visible");
                this.store.fetchAndUpdateStreamerList();
            }
        });

        document.documentElement.style.setProperty("--sidemenu-width", `${this.store.clientCfg("sidemenuWidth", 330)}px`);
    },
    mounted() {
        const theme = this.store.clientCfg("theme");
        if (theme !== "" && theme !== "auto"){
            document.body.classList.add(`is-${theme}`);
        }
    },
    unmounted() {
        console.debug("App unmounted");
        this.disconnectWebsocket();
        if (this.faviconSub) this.faviconSub();
        if (this.vodUpdateInterval) clearTimeout(this.vodUpdateInterval);
        if (this.tickerInterval) clearTimeout(this.tickerInterval);
        const theme = this.store.clientCfg("theme");
        if (theme !== "" && theme !== "auto"){
            document.body.classList.remove(`is-${theme}`);
        }
    },
    methods: {
        fetchInitialData() {
            console.debug("App fetchInitialData");
            this.store.fetchData().then(() => {
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
                this.websocketConnected = false;
                clearInterval(this.websocketKeepalive);
                if (ev.code === 3000) {
                    alert("Websockets are only for authenticated users.");
                    return;
                }
                setTimeout(() => {
                    if (!ev.wasClean) {
                        this.connectWebsocket();
                    }
                }, 10000);
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
                } else if (action == "channel_updated") {
                    const _data: ChannelUpdated = data;
                    this.store.updateStreamerFromData(_data.channel);
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
                } else if (action == "job_progress") {
                    const _data: JobProgress = data;
                    this.store.updateJobProgress(_data.job_name, _data.progress);
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
                } else if (action == "alert") {
                    alert(data.text);
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

            if (tts && this.store.clientCfg('useSpeech')) {
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
        // applyAuthentication() {
        //     const password = this.store.clientCfg("password");
        //     if (password) {
        //         axios.defaults.headers.common["X-Password"] = password;
        //     } else {
        //         delete axios.defaults.headers.common["X-Password"];
        //     }
        // }
        checkLoginStatus(): Promise<{ authentication: boolean; status: boolean; guest_mode: boolean; }> {
            return this.$http.get("/api/v0/auth/check").then((response) => {
                // console.debug("Check login status", response.data);
                return { authentication: response.data.authentication as boolean, status: true, guest_mode: response.data.guest_mode as boolean };
            }).catch((error) => {
                // console.debug("Check login error", error);    
                return { authentication: error.response.data.authentication as boolean, status: false, guest_mode: error.response.data.guest_mode as boolean };       
            });
        }
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
