<template>
    <div class="container vertical">
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
            <div class="section-content" v-if="logVisible">
                <div>
                    <select v-model="logFilename">
                        <option v-for="fn in logFilenames" :key="fn">{{ fn }}</option>
                    </select>
                    <button type="button" @click="fetchLog(true)">Fetch</button>
                </div>

                <div class="log_viewer" ref="logViewer">
                    <table>
                        <tr v-for="(line, lineIndex) in logFiltered" :key="lineIndex" :class="'log-line log-line-' + line.level.toLowerCase()">
                            <td v-if="line.date_string">{{ line.date_string }}</td>
                            <td v-else>{{ formatTimestamp(line.date / 1000, "yyyy-MM-dd HH:ii:ss.SSS") }}</td>
                            <td>
                                <a @click="logSetFilter(line.module)">{{ line.module }}</a>
                            </td>
                            <td>{{ line.level }}</td>
                            <td @click="expandLog(lineIndex)">{{ line.text }}</td>
                        </tr>
                    </table>
                </div>
            </div>
        </section>
    </div>

    <div id="js-status" :class="{ disconnected: ws && !wsConnected }" ref="js-status" @click="timer = 0">
        <template v-if="ws">
            {{ wsConnected ? "Connected" : wsConnecting ? "Connecting..." : "Disconnected" }}
        </template>
        <template v-else-if="tickerInterval">
            {{ loading ? "Loading..." : `Refreshing in ${timer} seconds.` }}
        </template>
        <template v-else>Disabled</template>
    </div>
    <div id="jobs-status" v-if="store.jobList !== undefined">
        <table>
            <tr v-for="job in store.jobList" :key="job.name">
                <td>
                    <span class="icon">
                        <fa icon="sync" spin v-if="job.status"></fa>
                        <fa icon="exclamation-triangle" v-else></fa>
                    </span>
                    <span class="text-overflow px-1">{{ job.name }}</span>
                </td>
                <td>{{ job.pid }}</td>
                <td><!-- {{ job.status }}-->{{ job.status ? "Running" : "Unexpected exit" }}</td>
            </tr>
        </table>

        <em v-if="store.jobList.length == 0">None</em>
    </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import Streamer from "@/components/StreamerItem.vue";
import type { ApiLogLine, ApiChannel } from "@common/Api/Client";
import { format } from "date-fns";
import { useStore } from "@/store";
import { nonGameCategories } from "@/defs";

interface DashboardData {
    loading: boolean;
    timer: number;
    timerMax: number;
    tickerInterval: number; // interval?
    vodUpdateInterval: number;
    totalSize: number;
    freeSize: number;
    logFilename: string;
    logFilenames: string[];
    logLines: ApiLogLine[];
    logVisible: boolean;
    logModule: string;
    logFromLine: number;
    ws: WebSocket | null;
    wsConnected: boolean;
    wsConnecting: boolean;
    wsKeepalive: number;
    wsKeepaliveTime: number;
    wsLastPing: number;
    oldData: Record<string, ApiChannel>;
    notificationSub: () => void;
}

export default defineComponent({
    name: "DashboardView",
    setup() {
        const store = useStore();
        return { store };
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
            logFilename: "",
            logFilenames: [],
            logLines: [],
            logFromLine: 0,
            logVisible: false,
            logModule: "",
            oldData: {},
            notificationSub: () => {
                console.log("notificationSub");
            },
            ws: null,
            wsConnected: false,
            wsConnecting: false,
            wsKeepalive: 0,
            wsLastPing: 0,
            wsKeepaliveTime: 20000,
        };
    },
    created() {
        this.loading = true;
        this.fetchStreamers()
            .then((sl) => {
                if ("streamer_list" in sl) this.store.updateStreamerList(sl.streamer_list);
                this.loading = false;
            })
            .then(() => {
                this.fetchLog();
            })
            .then(() => {
                this.fetchJobs();
            });
    },
    mounted() {
        this.processNotifications();

        if (this.store.cfg("websocket_enabled") && this.store.clientConfig?.useWebsockets) {
            console.debug("Websockets enabled");
            this.connectWebsocket();
        } else {
            if (this.store.clientConfig?.useBackgroundTicker) {
                console.debug("Websockets disabled");
                this.tickerInterval = setInterval(() => {
                    this.fetchTicker();
                }, 1000);
            }
        }

        // update vods every 15 minutes
        if (this.store.clientConfig?.useBackgroundRefresh) {
            this.vodUpdateInterval = setInterval(() => {
                this.store.updateCapturingVods();
            }, 1000 * 60 * 15);
        }
    },
    unmounted() {
        if (this.tickerInterval) clearTimeout(this.tickerInterval);
        if (this.vodUpdateInterval) clearTimeout(this.vodUpdateInterval);

        // unsub
        if (this.notificationSub) {
            console.log("unsubscribing from notifications, unmounted");
            this.notificationSub();
        }

        if (this.ws) {
            this.disconnectWebsocket();
        }
    },
    methods: {
        connectWebsocket() {
            if (this.ws) this.disconnectWebsocket();
            if (!this.store.config) return;
            const proto = window.location.protocol === "https:" ? "wss://" : "ws://";
            const websocket_url_public = proto + window.location.host + this.store.cfg("basepath") + "/socket/";
            let websocket_url = process.env.NODE_ENV === "development" ? "ws://localhost:8765/socket/" : websocket_url_public;

            if (this.store.cfg("websocket_client_address")) {
                console.log(`Overriding generated websocket URL '${websocket_url}' with config '${this.store.cfg("websocket_client_address")}'`);
                websocket_url = this.store.cfg("websocket_client_address") ?? "";
            }

            console.log(`Connecting to ${websocket_url}`);
            this.wsConnecting = true;
            this.ws = new WebSocket(websocket_url);
            this.ws.onopen = (ev: Event) => {
                console.log(`Connected to websocket!`, ev);
                if (!this.ws) return;
                this.ws.send(JSON.stringify({ action: "helloworld" }));
                this.wsConnected = true;
                this.wsConnecting = false;
                this.wsKeepalive = setInterval(() => {
                    if (!this.ws) return;
                    this.ws.send("ping");
                }, this.wsKeepaliveTime);
            };
            this.ws.onmessage = (ev: MessageEvent) => {
                // console.log("ws message", ev);
                let text = ev.data;

                if (text == "pong") {
                    // console.log("pong recieved");
                    this.wsLastPing = Date.now();
                    return;
                }

                let json;

                try {
                    json = JSON.parse(text);
                } catch (error) {
                    console.error("Couldn't parse json", text);
                    return;
                }

                const action = json.data.action;

                if (action) {
                    const downloader_actions = [
                        "start_download",
                        "end_download",
                        "start_capture",
                        "end_capture",
                        "start_convert",
                        "end_convert",
                        "chapter_update",
                    ];
                    const job_actions = ["job_save", "job_clear"];
                    if (downloader_actions.indexOf(action) !== -1) {
                        console.log("Websocket update");
                        // const vod = json.data.vod;
                        this.fetchStreamers().then((sl) => {
                            if ("streamer_list" in sl) this.store.updateStreamerList(sl.streamer_list);
                            this.loading = false;
                        });

                        // this.fetchLog();
                    } else if (job_actions.indexOf(action) !== -1) {
                        console.log(`Websocket jobs update: ${action}`, json.data.job_name, json.data.job);
                        this.fetchJobs();
                    } else if (action == "notify") {
                        // alert(json.data.text);
                        const toast = new Notification(json.data.text);
                        console.log(`Notify: ${json.data.text}`, toast);
                    } else {
                        console.log(`Websocket wrong action (${action})`);
                    }
                } else {
                    console.log(`Websocket unknown data`, json.data);
                }
            };
            this.ws.onerror = (ev: Event) => {
                console.error(`Websocket error!`, ev);
                this.wsConnected = false;
                this.wsConnecting = false;
                clearInterval(this.wsKeepalive);
            };
            this.ws.onclose = (ev: CloseEvent) => {
                console.log(`Disconnected from websocket! (${ev.code}/${ev.reason})`);
                this.wsConnecting = false;
                setTimeout(() => {
                    if (!ev.wasClean) {
                        this.connectWebsocket();
                    }
                }, 10000);
                this.wsConnected = false;
                clearInterval(this.wsKeepalive);
            };
            return this.ws;
        },
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
        async fetchJobs() {
            let response;

            try {
                response = await this.$http.get(`/api/v0/jobs`);
            } catch (error) {
                console.error(error);
                return;
            }

            const json = response.data;
            console.debug("Update jobs list", json.data);
            this.store.updateJobList(json.data);
        },
        async fetchLog(clear = false) {
            // today's log file
            if (this.logFilename == "") {
                this.logFilename = format(new Date(), "yyyy-MM-dd");
            }

            if (clear) {
                this.logFromLine = 0;
                this.logLines = [];
            }

            let response;
            try {
                response = await this.$http.get(`/api/v0/log/${this.logFilename}/${this.logFromLine}`);
            } catch (error) {
                console.error(error);
                return;
            }

            // console.debug("log data", response.data);

            if (!response.data.data) {
                console.error("fetchLog invalid data", response.data);
                return;
            }

            if (!response.data.data.lines) return;

            this.logFromLine = response.data.data.last_line;

            this.logFilenames = response.data.data.logs;

            this.logLines = this.logLines.concat(response.data.data.lines);

            // scroll to bottom
            setTimeout(() => {
                const lv = this.$refs.logViewer as HTMLDivElement;
                if (!lv) return;
                lv.scrollTop = lv.scrollHeight;
            }, 100);
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

                    this.fetchLog();

                    this.fetchJobs();
                }

                this.loading = false;

                this.timer = this.timerMax;
            } else {
                this.timer -= 1;
            }
        },
        processNotifications() {
            if (!this.store.clientConfig?.enableNotifications) {
                return;
            }

            console.log("Notifications enabled");

            this.notificationSub = this.store.$onAction(({ name, store, args, after, onError }) => {
                // unsub if changed
                if (!this.store.clientConfig?.enableNotifications) {
                    console.log("Notification setting disabled, stopping subscription.");
                    this.notificationSub();
                    return;
                }

                if (!args) {
                    // console.error("No payload for notification sub");
                    return;
                }

                if (name !== "updateStreamerList") {
                    // console.debug(`Streamer list notification check payload was ${name}, abort.`);
                    return;
                }

                const payload = args[0] as ApiChannel[];

                if (payload.length === 0) {
                    console.debug("Streamer list notification check payload was empty, abort.");
                    return;
                }

                // if (!("streamer_list" in args)) {
                //     console.error("Streamer list notification payload is invalid", name, args);
                //     return;
                // }

                // console.log("subscribe", mutation.payload, this.store.streamerList);
                /*
                if( mutation.payload[0].current_game !== state.streamerList[0].current_game ){
                    alert( mutation.payload[0].display_name + ": " + mutation.payload[0].current_game );
                }*/
                // console.log( "values", Object.(mutation.payload[0]));
                const streamerPronounciation: { [key: string]: string } = {
                    pokelawls: "pookelawls",
                    xQcOW: "eckscueseeow",
                };

                console.debug("notification payload", name, args);

                for (const streamer of payload) {
                    const login = streamer.login;

                    if (this.oldData && this.oldData[streamer.login]) {
                        const oldStreamer = this.oldData[streamer.login];

                        if (!streamer.channel_data) {
                            console.warn(`No channel data for ${login}`);
                        }

                        const opt = {
                            icon: streamer.channel_data.profile_image_url,
                            image: streamer.channel_data.profile_image_url,
                            body: streamer.current_game ? streamer.current_game.game_name : "No game",
                        };

                        let text = "";

                        if (!oldStreamer.is_live && streamer.is_live) {
                            text = `${login} is live!`;
                        }

                        if (streamer.is_live) {
                            // console.log("notification compare games", streamer.login, oldStreamer.current_game, streamer.current_game );

                            if (
                                (!oldStreamer.current_game && streamer.current_game) || // from no game to new game
                                (oldStreamer.current_game && streamer.current_game && oldStreamer.current_game.game_name !== streamer.current_game.game_name) // from old game to new game
                            ) {
                                if (nonGameCategories.includes(streamer.current_game.game_name)) {
                                    if (streamer.current_game.favourite) {
                                        text = `${login} is online with one of your favourite categories: ${streamer.current_game.game_name}!`;
                                    } else if (streamer.current_game.game_name) {
                                        text = `${login} is now streaming ${streamer.current_game.game_name}!`;
                                    } else {
                                        text = `${login} is now streaming without a category!`;
                                    }
                                } else {
                                    if (streamer.current_game.favourite) {
                                        text = `${login} is now playing one of your favourite games: ${streamer.current_game.game_name}!`;
                                    } else if (streamer.current_game.game_name) {
                                        text = `${login} is now playing ${streamer.current_game.game_name}!`;
                                    } else {
                                        text = `${login} is now streaming without a category!`;
                                    }
                                }
                            }
                        }

                        if (oldStreamer.is_live && !streamer.is_live) {
                            text = `${login} has gone offline!`;
                        }

                        if (text !== "") {
                            console.log(`Notify: ${text}`);

                            if (Notification.permission === "granted") {
                                const toast = new Notification(text, opt);
                                console.log(`Granted notification`, toast);
                            }

                            const useSpeech = true;
                            if (useSpeech) {
                                let speakText = text;

                                if (streamerPronounciation[login]) {
                                    console.debug(`Using pronounciation for ${login}`);
                                    speakText = speakText.replace(login, streamerPronounciation[login]);
                                }
                                const utterance = new SpeechSynthesisUtterance(speakText);
                                window.speechSynthesis.speak(utterance);
                            }
                        } else {
                            // console.debug(`No notification text for ${streamer.login}`);
                        }
                    }

                    this.oldData[streamer.login] = streamer;
                }
            });
        },
        logSetFilter(val: string) {
            this.logModule = this.logModule ? "" : val;
            console.log(`Log filter set to ${this.logModule}`);
        },
        logToggle() {
            this.logVisible = !this.logVisible;
            setTimeout(() => {
                const lv = this.$refs.logViewer as HTMLDivElement;
                if (!lv) return;
                lv.scrollTop = lv.scrollHeight;
            }, 100);
        },
        expandLog(lineNumber: number) {
            if (!this.logLines[lineNumber]) return;
            if (this.logLines[lineNumber].metadata) {
                alert(JSON.stringify(this.logLines[lineNumber].metadata, undefined, 2));
                console.log(this.logLines[lineNumber].metadata);
            }
        },
    },
    computed: {
        sortedStreamers() {
            const streamers: ApiChannel[] = this.store.streamerList;
            return streamers.sort((a, b) => a.display_name.localeCompare(b.display_name));
        },
        logFiltered(): ApiLogLine[] {
            if (!this.logModule) return this.logLines;
            return this.logLines.filter((val) => val.module == this.logModule);
        },
        streamersOnline(): number {
            if (!this.store.streamerList) return 0;
            return this.store.streamerList.filter((a) => a.is_live).length;
        },
        singleStreamer(): ApiChannel | undefined {
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
        // HelloWorld
    },
    watch: {
        streamersOnline() {
            document.title = this.streamersOnline > 0 ? `[${this.streamersOnline}] Dashboard - TwitchAutomator` : `Dashboard - TwitchAutomator`;
        },
    },
});
</script>
