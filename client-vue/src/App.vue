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
        <!-- broken until there's a way to make imported variables reactive
        <div id="js-status" :class="{ disconnected: websocketConnected }" ref="js-status">
            <template v-if="websocketObject">
                {{ websocketConnected ? "Connected" : websocketConnecting ? "Connecting..." : "Disconnected" }}
            </template>
            <template v-else>Disabled</template>
        </div>
        -->
    </div>
</template>

<style lang="scss"></style>

<script lang="ts">
import { defineComponent, ref } from "vue";

import SideMenu from "@/components/SideMenu.vue";
import { useStore } from "./store";
import type { ApiSettingsResponse } from "@common/Api/Api";
import JobStatus from "./components/JobStatus.vue";
import { connectWebsocket, eventListener, WebsocketJSON } from "./websocket";
import { ChapterUpdateData, EndCaptureData, EndConvertData, JobClear, JobSave, NotifyData, VodRemoved, VodUpdated, WebhookAction, WebhookData } from "@common/Webhook";
import { ApiLogLine } from "@common/Api/Client";
import { parseISO } from "date-fns";

export default defineComponent({
    name: "App",
    setup() {
        const store = useStore();
        return { store };
    },
    data() {
        return {
            errors: [],
        };
    },
    created() {
        this.store.fetchClientConfig();
        this.fetchData().then(() => {
            if (this.store.cfg("websocket_enabled") && this.store.clientConfig?.useWebsockets) {
                connectWebsocket();
            }
        });

        // websocket messages
        const ev = eventListener();
        // ev.addEventListener("message", this.handleWebsocketMessage);
        ev.addEventListener("message", this.handleWebsocketMessage as unknown as EventListener);
        console.debug("Added websocket event listener");

    },
    unmounted() {
        eventListener().removeEventListener("message", this.handleWebsocketMessage as unknown as EventListener);
        console.debug("Removed websocket listener");
    },
    mounted() {

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
        },
        handleWebsocketMessage(event: CustomEvent<WebsocketJSON>) {

            const { action, data } = event.detail;

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

            if (tts || this.store.clientConfig?.useSpeech) {
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
    },
    components: {
        SideMenu,
        JobStatus
    },
});

</script>
