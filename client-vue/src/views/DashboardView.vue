<template>
    <div class="container vertical">
        <section class="section" v-if="store.errors && store.errors.length > 0">
            <div class="errors">
                <ul>
                    <li v-for="error in store.errors" :key="error">
                        {{ error }}
                    </li>
                </ul>
            </div>
        </section>
        <section class="section" data-section="vods">
            <div class="section-title"><h1>Recorded VODs</h1></div>
            <div class="section-content" v-if="store.streamerList && store.streamerList.length > 0">
                <template v-if="!store.clientConfig?.singlePage">
                    <streamer v-for="streamer in sortedStreamers" v-bind:key="streamer.userid" v-bind:streamer="streamer" />
                </template>
                <template v-else>
                    <streamer v-bind:streamer="singleStreamer" @refresh="fetchStreamers" />
                </template>
                <hr />
                <div class="dashboard-stats">
                    <strong>Total size: {{ formatBytes(totalSize) }}</strong>
                    <br />
                    <strong>Free space: {{ formatBytes(freeSize) }}</strong>
                </div>
            </div>
            <div class="section-content" v-else>
                <span class="icon"><fa icon="sync" spin></fa></span> Loading...
            </div>
        </section>

        <section class="section">
            <div class="section-title" @click="logToggle"><h1>Logs</h1></div>
            <div class="section-content" v-show="logVisible">
                <log-viewer ref="logviewer" />
            </div>
        </section>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref } from "vue";
import Streamer from "@/components/StreamerItem.vue";
import type { ApiLogLine, ApiChannel } from "@common/Api/Client";
import type { ChapterUpdateData, EndCaptureData, EndConvertData, JobClear, JobSave, NotifyData, VodRemoved, VodUpdated, WebhookAction } from "@common/Webhook";
import { format, parseISO } from "date-fns";
import { useStore } from "@/store";
import TwitchChannel from "@/core/channel";
import { ApiLogResponse, ApiResponse } from "@common/Api/Api";
import LogViewer from "@/components/LogViewer.vue";
import { eventListener } from "@/websocket";

interface DashboardData {
    loading: boolean;
    timer: number;
    timerMax: number;
    tickerInterval: number; // interval?
    vodUpdateInterval: number;
    totalSize: number;
    freeSize: number;
    ws: WebSocket | null;
    wsConnected: boolean;
    wsConnecting: boolean;
    wsKeepalive: number;
    wsKeepaliveTime: number;
    wsLastPing: number;
    oldData: Record<string, ApiChannel>;
    notificationSub: () => void;
    faviconSub: () => void;
    logVisible: boolean;
}

interface WebsocketJSON {
    action: string;
    data: any;
}

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
    name: "DashboardView",
    setup() {
        const store = useStore();
        const logviewer = ref<InstanceType<typeof LogViewer>>();
        return { store, logviewer };
    },
    title(): string {
        if (this.streamersOnline > 0) return `[${this.streamersOnline}] Dashboard`;
        return "Dashboard";
    },
    data(): DashboardData {
        return {
            loading: false,
            timer: 120,
            timerMax: 120,
            tickerInterval: 0,
            vodUpdateInterval: 0,
            totalSize: 0,
            freeSize: 0,
            oldData: {},
            notificationSub: () => {
                console.log("notificationSub");
            },
            faviconSub: () => {
                console.log("faviconSub");
            },
            ws: null,
            wsConnected: false,
            wsConnecting: false,
            wsKeepalive: 0,
            wsLastPing: 0,
            wsKeepaliveTime: 20000,
            logVisible: false,
        };
    },
    created() {
        console.debug("Dashboard created");
        this.loading = true;
        this.watchFaviconBadgeSub();
        this.fetchStreamers()
            .then((sl) => {
                if ("streamer_list" in sl) this.store.updateStreamerList(sl.streamer_list);
                this.loading = false;
            })
            .then(() => {
                console.debug(this.logviewer);
                this.logviewer?.fetchLog();
            })
            .then(() => {
                this.store.fetchAndUpdateJobs();
            });
    },
    mounted() {

        /*
        if (this.store.cfg("websocket_enabled") && this.store.clientConfig?.useWebsockets) {
            this.connectWebsocket();
        } else {
            if (this.store.clientConfig?.useBackgroundTicker) {
                this.tickerInterval = setInterval(() => {
                    this.fetchTicker();
                }, 1000);
            }
        }
        */

        // update vods every 15 minutes
        if (this.store.clientConfig?.useBackgroundRefresh) {
            this.vodUpdateInterval = setInterval(() => {
                this.store.updateCapturingVods();
            }, 1000 * 60 * 15);
        }

        /*
        let options = {
            // root: document.body,
            // rootMargin: "0px",
            threshold: 0.5,
        };

        let observer = new IntersectionObserver((entries, observer) => {
            console.debug("IntersectionObserver", entries[0].target, entries[0].isIntersecting, entries[0].intersectionRatio);
        }, options);

        for (let streamer of this.store.streamerList) {
            let streamerItem = this.$refs[`streamer-${streamer.name}`] as HTMLElement;
            if (streamerItem) {
                for (let vod of streamer.vods) {
                    let vodItem = this.$refs[`vod-${vod.id}`] as HTMLElement;
                    if (vodItem) {
                        observer.observe(vodItem);
                    }
                }
            }
        }
        */

        //observer.observe(this.$refs.vod as HTMLDivElement);
    },
    unmounted() {
        if (this.tickerInterval) clearTimeout(this.tickerInterval);
        if (this.vodUpdateInterval) clearTimeout(this.vodUpdateInterval);

        // unsub
        // if (this.notificationSub) {
        //     console.log("unsubscribing from notifications, unmounted");
        //     this.notificationSub();
        // }

        if (this.faviconSub) {
            // console.log("unsubscribing from favicon, unmounted");
            this.faviconSub();
        }

        this.setFaviconBadgeState(false);

        if (this.ws) {
            this.disconnectWebsocket();
        }
    },
    methods: {
        // addWebsocketMessageListener() {
        //     const ev = eventListener();
        // 
        //     ev.addEventListener("message", ()
        // }
        /*
        connectWebsocket() {
            if (this.ws) this.disconnectWebsocket();
            if (!this.store.config) return;

            let websocket_url = "";

            if (this.store.clientConfig?.websocketAddressOverride) {
                websocket_url = this.store.clientConfig.websocketAddressOverride;
                console.debug(`Overriding generated websocket URL with client config '${this.store.clientConfig.websocketAddressOverride}'`);
            } else {
                if (!this.store.websocketUrl || this.store.websocketUrl == "") {
                    console.error("No websocket URL found");
                    return;
                }
                websocket_url = this.store.websocketUrl;
            }

            console.log(`Connecting to ${websocket_url}`);
            this.wsConnecting = true;
            this.ws = new WebSocket(websocket_url);

            this.ws.addEventListener("open", (ev: Event) => {
                console.log(`Connected to websocket!`, ev);
                if (!this.ws) return;
                this.ws.send(JSON.stringify({ action: "helloworld" }));
                this.wsConnected = true;
                this.wsConnecting = false;
                this.wsKeepalive = setInterval(() => {
                    if (!this.ws) return;
                    this.ws.send("ping");
                }, this.wsKeepaliveTime);
            });

            this.ws.addEventListener("message", (ev: MessageEvent) => {
                // console.log("ws message", ev);
                let text = ev.data;

                if (text == "pong") {
                    // console.log("pong recieved");
                    this.wsLastPing = Date.now();
                    return;
                }

                let json: WebsocketJSON;

                try {
                    json = JSON.parse(text);
                } catch (error) {
                    console.error("Couldn't parse json", text);
                    return;
                }

                this.handleWebsocketMessage(json);
            });

            this.ws.addEventListener("error", (ev: Event) => {
                console.error(`Websocket error!`, ev);
                this.wsConnected = false;
                this.wsConnecting = false;
                clearInterval(this.wsKeepalive);
            });

            this.ws.addEventListener("close", (ev: CloseEvent) => {
                console.log(`Disconnected from websocket! (${ev.code}/${ev.reason})`);
                this.wsConnecting = false;
                setTimeout(() => {
                    if (!ev.wasClean) {
                        this.connectWebsocket();
                    }
                }, 10000);
                this.wsConnected = false;
                clearInterval(this.wsKeepalive);
            });

            return this.ws;
        },
        
        */
        disconnectWebsocket() {
            if (this.ws && this.ws.close) {
                console.log("Closing websocket...");
                this.wsConnecting = false;
                this.ws.close(undefined, "pageleave");
                if (this.wsKeepalive) clearInterval(this.wsKeepalive);
            }
        },
        async fetchStreamers() {
            const rest = await this.store.fetchStreamerList();
            if (rest) {
                this.totalSize = rest.total_size;
                this.freeSize = rest.free_size;
                return rest;
            } else {
                console.warn("No data returned from fetchStreamerList");
            }
            return [];
        },
        async fetchTicker() {
            if (this.timer <= 0 && !this.loading) {
                this.loading = true;
                const streamerResult = await this.fetchStreamers();

                if (streamerResult && "streamer_list" in streamerResult) {
                    const isAnyoneLive = streamerResult.streamer_list.find((el) => el.is_live == true) !== undefined;

                    if (!isAnyoneLive) {
                        if (this.timerMax < 1800 /* 30 minutes */) {
                            this.timerMax += 10;
                        }
                    } else {
                        this.timerMax = 120;
                    }

                    this.store.updateStreamerList(streamerResult.streamer_list);

                    this.logviewer?.fetchLog();
                    this.store.fetchAndUpdateJobs();
                }

                this.loading = false;

                this.timer = this.timerMax;
            } else {
                this.timer -= 1;
            }
        },
        watchFaviconBadgeSub() {
            this.faviconSub = this.store.$onAction(({ name, store, args, after, onError }) => {
                if (!args) {
                    // console.error("No payload for notification sub");
                    return;
                }

                if (name !== "updateStreamerList" && name !== "updateVod") {
                    // console.debug(`Favicon update check got ${name}, abort.`);
                    return;
                }

                // console.debug(`Favicon update check got ${name}`);
                after(() => {
                    const isAnyoneLive = this.store.streamerList.some((el) => el.is_live == true);
                    this.setFaviconBadgeState(isAnyoneLive);
                });
            });
        },
        setFaviconBadgeState(state: boolean) {
            // console.log("Set favicon badge state", state);
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
                // console.log("favicon updated", faviconElement);
                // document.body.appendChild(canvas);
            }
        },
        logToggle() {
            this.logVisible = !this.logVisible;
            this.logviewer?.scrollLog();
        },
    },
    computed: {
        sortedStreamers(): TwitchChannel[] {
            const streamers: TwitchChannel[] = [...this.store.streamerList];
            return streamers.sort((a, b) => a.display_name.localeCompare(b.display_name));
        },
        // logFiltered(): ApiLogLine[] {
        //     if (!this.logModule) return this.store.log;
        //     return this.store.log.filter((val) => val.module == this.logModule);
        // },
        streamersOnline(): number {
            if (!this.store.streamerList) return 0;
            return this.store.streamerList.filter((a) => a.is_live).length;
        },
        singleStreamer(): TwitchChannel | undefined {
            if (!this.store.streamerList) return undefined;

            const current = this.$route.query.channel as string;
            if (current !== undefined) {
                return this.store.streamerList.find((u) => u.login === current);
            } else {
                // this.$route.query.channel = this.store.streamerList[0].display_name;
                return this.store.streamerList[0];
            }
        },
    },
    components: {
        Streamer,
        LogViewer,
    },
    watch: {
        streamersOnline() {
            document.title = this.streamersOnline > 0 ? `[${this.streamersOnline}] Dashboard - ${this.store.app_name}` : `Dashboard - ${this.store.app_name}`;
        },
    },
});
</script>
