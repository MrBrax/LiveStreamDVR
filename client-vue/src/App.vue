<template>
    <div class="splitter">
        <side-menu />
        <div class="content">
            <section v-if="store.authentication && !store.authenticated && !store.guest_mode" class="section">
                <div class="errors">This site is only available to logged in users.</div>
            </section>
            <div v-if="errors" class="big-error">
                <div v-for="error in errors" :key="error" class="big-error-item">Error</div>
            </div>
            <router-view v-if="store.config !== null && store.favourite_games !== null" ref="view" />
            <div v-else>
                <div class="container">
                    <section class="section">
                        <div class="section-content">
                            <LoadingBox />
                        </div>
                    </section>
                </div>
            </div>
        </div>
        <job-status v-if="store.authElement" ref="jobstatus" />
        <websocket-status
            :websocket="websocket"
            :websocket-connected="websocketConnected"
            :websocket-connecting="websocketConnecting"
            :timer="timer"
            :ticker-interval="tickerInterval"
            :loading="loading"
        />
    </div>
    <dialog ref="mediaplayer" class="mediaplayer">
        <div>{{ mediaPlayerSource }}</div>
        <div>
            <video ref="mediaplayervideo" :src="mediaPlayerSource" controls autoplay />
        </div>
        <div class="buttons is-centered">
            <button
                class="button is-small is-danger"
                @click="
                    mediaPlayerSource = undefined;
                    ($refs.mediaplayer as HTMLDialogElement).close();
                "
            >
                <span class="icon"><font-awesome-icon icon="xmark" /></span>
                <span>Close</span>
            </button>
            <a :href="mediaPlayerSource" class="button is-small is-info" target="_blank" @click="($refs.mediaplayervideo as HTMLVideoElement).pause()">
                <span class="icon"><font-awesome-icon icon="arrow-up-right-from-square" /></span>
                <span>Open in new tab</span>
            </a>
        </div>
    </dialog>
</template>

<script lang="ts" setup>
import SideMenu from "@/components/SideMenu.vue";
import type { ApiAuthResponse } from "@common/Api/Api";
import type { ApiLogLine } from "@common/Api/Client";
import type {
    ChannelUpdated,
    ChapterUpdateData,
    EndCaptureData,
    EndConvertData,
    JobClear,
    JobProgress,
    JobSave,
    NotifyData,
    VodRemoved,
    VodUpdated,
    WebhookAction,
} from "@common/Webhook";
import { library } from "@fortawesome/fontawesome-svg-core";
import { faArrowUpRightFromSquare } from "@fortawesome/free-solid-svg-icons";
import axios from "axios";
import { parseISO } from "date-fns";
import { onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import JobStatus from "./components/JobStatus.vue";
import WebsocketStatus from "./components/WebsocketStatus.vue";
import { prefersReducedMotion } from "./mixins/newhelpers";
import { useStore } from "./store";
import type { WebsocketJSON } from "./websocket";
import type { WinstonLogLine } from "@common/Log";

/**
 * LiveStreamDVR Client
 * Written in Vue 3 & TypeScript
 * @author Braxen
 * @created 2021-01-17
 */

library.add(faArrowUpRightFromSquare);

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

// provide() {
//     return {
//         websocket: this.websocket,
//     };
// },

// setup
const store = useStore();
const route = useRoute();
const { t, locale } = useI18n({ useScope: "global" });

// data
const loading = ref(false);
const errors = ref<string[]>([]);
const websocket = ref<WebSocket>();
const websocketConnected = ref(false);
const websocketConnecting = ref(false);
const websocketKeepalive = ref(0);
const websocketKeepaliveTime = ref(20 * 1000);
const websocketLastPing = ref(0);
const vodUpdateInterval = ref(0);
const timer = ref(120);
const timerMax = ref(120);
const tickerInterval = ref(0);
const faviconSub = ref<() => void>(() => {
    console.log("faviconSub");
});
const mediaPlayerSource = ref<string | undefined>(undefined);
const actionSub = ref<() => void>(() => {
    console.log("action");
});

// refs
const mediaplayer = ref<HTMLDialogElement>();
const mediaplayervideo = ref<HTMLVideoElement>();

// watch
watch(
    () => route.name,
    () => {
        updateTitle();
    },
);

watch(
    () => store.channelsOnline,
    () => {
        updateTitle();
    },
);

// mounted
onMounted(() => {
    // created
    console.debug("App created");
    store.fetchClientConfig();
    locale.value = store.clientConfig?.language ?? "en";
    // this.applyAuthentication();
    watchFaviconBadgeSub();
    checkLoginStatus().then((s) => {
        store.authentication = s.authentication;
        store.authenticated = s.status;
        store.guest_mode = s.guest_mode;
        console.log("checkLoginStatus", s);

        if ((store.authentication && store.authenticated) || store.guest_mode || !store.authentication) {
            fetchInitialData();
        }
    });

    const wantsReducedMotion = prefersReducedMotion();
    const hasSeenPopup = localStorage.getItem("hasSeenReducedMotionPopup") === "true";
    if (!hasSeenPopup && wantsReducedMotion && store.clientConfig) {
        const choice = window.confirm("You have enabled reduced motion in your browser/OS.\nDo you want to disable animations in the app?");
        if (choice) {
            localStorage.setItem("hasSeenReducedMotionPopup", "true");
            store.clientConfig.animationsEnabled = false;
            store.saveClientConfig();
            alert("Animations have been disabled.\nYou can enable them in the client settings.");
        }
    }

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            // console.debug("Visibility change: visible");
            store.fetchAndUpdateStreamerList();
        }
    });

    document.documentElement.style.setProperty("--sidemenu-width", `${store.clientCfg("sidemenuWidth", 330)}px`);

    // mounted
    const theme = store.clientCfg("theme");
    if (theme !== "" && theme !== "auto") {
        document.body.classList.add(`is-${theme}`);
    }

    actionSub.value = store.$onAction(({ name, args }) => {
        if (name !== "playMedia" || !mediaplayer.value) return;
        const full_path = args[0];
        console.log("onaction", name, args);
        mediaPlayerSource.value = full_path;
        mediaplayer.value.showModal();

        // json metadata from full_path replacing the extension with .json
        /*
        const json_path = full_path.replace(/\.[^/.]+$/, ".info.json");
        axios.get(json_path).then((res) => {
            const json = res.data as any;
            console.log("json ok", json);
        }).catch((err) => {
            console.error("json error", err);
        });
        */
    });
    document.addEventListener("keyup", keyEvent);
});

onUnmounted(() => {
    console.debug("App unmounted");
    disconnectWebsocket();
    if (faviconSub.value) faviconSub.value();
    if (vodUpdateInterval.value) clearTimeout(vodUpdateInterval.value);
    if (tickerInterval.value) clearTimeout(tickerInterval.value);
    const theme = store.clientCfg("theme");
    if (theme !== "" && theme !== "auto") {
        document.body.classList.remove(`is-${theme}`);
    }
    if (actionSub.value) actionSub.value(); // unsub
    document.removeEventListener("keyup", keyEvent);
});

// methods
function fetchInitialData() {
    console.debug("App fetchInitialData");
    store
        .fetchData()
        .then(() => {
            updateTitle();
            if (store.cfg("websocket_enabled") && store.clientCfg("useWebsockets")) {
                console.debug("Connecting websocket...");
                connectWebsocket();
            } else {
                console.debug("Websocket disabled");
                if (store.clientCfg("useBackgroundTicker")) {
                    console.debug("Starting background ticker...");
                    tickerInterval.value = window.setInterval(() => {
                        tickTicker();
                    }, 1000);
                }
            }

            // update vods every 15 minutes
            if (store.clientCfg("useBackgroundRefresh")) {
                vodUpdateInterval.value = window.setInterval(
                    () => {
                        store.updateCapturingVods();
                    },
                    1000 * 60 * 15,
                );
            }
        })
        .catch((error) => {
            console.error("fetchData error", error);
        });
}

function connectWebsocket(): WebSocket | undefined {
    let websocket_url = "";

    if (store.clientCfg("websocketAddressOverride")) {
        websocket_url = store.clientCfg("websocketAddressOverride");
        console.debug(`Overriding generated websocket URL with client config '${store.clientCfg("websocketAddressOverride")}'`);
    } else {
        if (!store.websocketUrl || store.websocketUrl == "") {
            console.error("No websocket URL found");
            return;
        }
        websocket_url = store.websocketUrl;
    }

    console.log(`Connecting to ${websocket_url}`);
    websocketConnecting.value = true;
    websocket.value = new WebSocket(websocket_url);

    websocket.value.addEventListener("open", (ev: Event) => {
        console.log("Connected to websocket!");
        if (!websocket.value) return;
        websocket.value.send(JSON.stringify({ action: "helloworld" }));
        websocketConnecting.value = false;
        websocketKeepalive.value = window.setInterval(() => {
            if (!websocket.value) return;
            websocket.value.send("ping");
        }, websocketKeepaliveTime.value);
    });

    websocket.value.addEventListener("message", (ev: MessageEvent) => {
        const text: string = ev.data;

        if (text == "pong") {
            // console.log("pong recieved");
            websocketLastPing.value = Date.now();
            return;
        }

        let json: WebsocketJSON;

        try {
            json = JSON.parse(text);
        } catch (error) {
            console.error("Couldn't parse json", text);
            return;
        }

        handleWebsocketMessage(json.action, json.data);
    });

    websocket.value.addEventListener("error", (ev: Event) => {
        console.error("Websocket error!", ev);
        websocketConnected.value = false;
        websocketConnecting.value = false;
        clearInterval(websocketKeepalive.value);
    });

    websocket.value.addEventListener("close", (ev: CloseEvent) => {
        console.log(`Disconnected from websocket! (${ev.code}/${ev.reason})`);
        websocketConnecting.value = false;
        websocketConnected.value = false;
        clearInterval(websocketKeepalive.value);
        if (ev.code === 3000) {
            alert("Websockets are only for authenticated users.");
            return;
        }
        setTimeout(() => {
            if (!ev.wasClean) {
                connectWebsocket();
            }
        }, 10000);
    });

    return websocket.value;
}

function disconnectWebsocket() {
    if (!websocket.value) return;
    websocket.value.close();
    websocket.value = undefined;
    if (websocketKeepalive.value) clearInterval(websocketKeepalive.value);
}

function handleWebsocketMessage(action: WebhookAction, data: any) {
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
            store.updateVodFromData(_data.vod);
        } else if (action == "channel_updated") {
            const _data: ChannelUpdated = data;
            store.updateStreamerFromData(_data.channel);
        } else if (action == "vod_removed") {
            const _data: VodRemoved = data;
            store.removeVod(_data.basename);
            // } else if (action == "start_download") {
            //     const _data: StartDownloadData = data;
            //     store.updateVod(data.vod);
        } else if (action == "end_capture") {
            const _data: EndCaptureData = data;
            store.updateVodFromData(_data.vod);
        } else if (action == "end_convert") {
            const _data: EndConvertData = data;
            store.updateVodFromData(_data.vod);
        } else if (action == "init") {
            new Notification("Server connected to broker");
        } else if (action == "notify") {
            const _data: NotifyData = data;
            onNotify(_data.title, _data.body, _data.icon, _data.url, _data.tts);
        } else if (action == "log") {
            // merge log lines
            const newLines: WinstonLogLine[] = data;

            if (newLines.some((line) => line.timestamp && parseISO(line.timestamp).getDay() != new Date().getDay())) {
                // new day, clear log
                store.clearLog();
                store.addLog(newLines);
                console.log("New day, clearing log");
            } else {
                store.addLog(newLines);
            }

            // FIXME: dashboard scroll
            // setTimeout(() => {
            //     this.logviewer?.scrollLog();
            // }, 100);
        } else if (action == "job_save" || action == "job_update") {
            const _data: JobSave = data;
            store.updateJob(_data.job);
        } else if (action == "job_progress") {
            const _data: JobProgress = data;
            store.updateJobProgress(_data.job_name, _data.progress);
        } else if (action == "job_clear") {
            const _data: JobClear = data;
            store.removeJob(_data.job_name);
        } else if (action == "chapter_update") {
            const _data: ChapterUpdateData = data;
            console.log("chapter_update", data);
            store.updateVodFromData(_data.vod);
        } else if (action == "connected") {
            websocketConnected.value = true;
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
                if ("streamer_list" in sl) store.updateStreamerList(sl.streamer_list);
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
            store.updateVod(vod_data);
        } else {
            console.log(`Websocket wrong action (${action})`);
        }
        */
    } else {
        console.log("Websocket unknown data", action, data);
    }
}

function onNotify(title: string, body: string, icon: string, url: string, tts: boolean) {
    const toast = new Notification(title, {
        body: body,
        icon: icon,
    });

    if (url) {
        toast.onclick = () => {
            window.open(url);
        };
    }

    if (tts && store.clientCfg("useSpeech")) {
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
}

function watchFaviconBadgeSub() {
    faviconSub.value = store.$onAction(({ name, store, args, after, onError }) => {
        if (!args) return;
        if (name !== "updateStreamerList" && name !== "updateVod") return;
        after(() => {
            setFaviconBadgeState(store.isAnyoneLive, store.isAnyoneCapturing ? "red" : "limegreen");
        });
    });
}

function setFaviconBadgeState(state: boolean, color = "red") {
    // draw favicon into canvas and add badge
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;

    const ctx = canvas.getContext("2d");
    if (ctx) {
        ctx.drawImage(faviconCanvas, 0, 0);
        if (state) {
            ctx.fillStyle = color;

            // draw circle badge
            ctx.beginPath();
            ctx.arc(26, 26, 6, 0, 2 * Math.PI);
            ctx.fill();
            ctx.closePath();
        }

        faviconElement.href = canvas.toDataURL();
    }
}

function updateTitle() {
    const channelsOnline = store.channelsOnline;
    const title = route.meta.title || route.name;
    const app_name = store.app_name;
    if (channelsOnline > 0) {
        document.title = `[${channelsOnline}] ${title} - ${app_name}`;
        setFaviconBadgeState(true, store.isAnyoneCapturing ? "red" : "limegreen");
    } else {
        document.title = `${title} - ${app_name}`;
        setFaviconBadgeState(false);
    }
}

async function tickTicker() {
    if (timer.value <= 0 && !loading.value) {
        loading.value = true;
        const streamerResult = await store.fetchStreamerList();

        if (streamerResult && "streamer_list" in streamerResult) {
            if (!store.isAnyoneLive) {
                if (timerMax.value < 1800 /* 30 minutes */) {
                    timerMax.value += 10;
                }
            } else {
                timerMax.value = 120;
            }

            store.updateStreamerList(streamerResult.streamer_list);

            // this.logviewer?.fetchLog(); // can't do this in app, logviewer can't be accessed here
            store.fetchAndUpdateJobs();
        }

        loading.value = false;

        timer.value = timerMax.value;
    } else {
        timer.value -= 1;
    }
    console.debug(`Ticker: ${timer.value}/${timerMax.value}`);
}

// applyAuthentication() {
//     const password = store.clientCfg("password");
//     if (password) {
//         axios.defaults.headers.common["X-Password"] = password;
//     } else {
//         delete axios.defaults.headers.common["X-Password"];
//     }
// }
function checkLoginStatus(): Promise<{ authentication: boolean; status: boolean; guest_mode: boolean }> {
    return axios
        .get<ApiAuthResponse>("/api/v0/auth/check")
        .then((response) => {
            // console.debug("Check login status", response.data);
            return { authentication: response.data.authentication as boolean, status: true, guest_mode: response.data.guest_mode as boolean };
        })
        .catch((error) => {
            // console.debug("Check login error", error);
            return { authentication: error.response.data.authentication as boolean, status: false, guest_mode: error.response.data.guest_mode as boolean };
        });
}

function keyEvent(event: KeyboardEvent) {
    if (event.target && ["text", "textarea", "number"].includes((event.target as HTMLInputElement).type)) return;
    store.keyEvent(event.key);
}
</script>
