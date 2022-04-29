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
            <div class="section-content" v-if="store.streamerListLoaded && store.streamerList.length > 0">
                <template v-if="!store.clientConfig?.singlePage">
                    <streamer v-for="streamer in sortedStreamers" v-bind:key="streamer.userid" v-bind:streamer="streamer" />
                </template>
                <template v-else>
                    <streamer v-bind:streamer="singleStreamer" @refresh="store.fetchAndUpdateStreamerList" />
                </template>
                <hr />
                <div class="dashboard-stats">
                    <strong>Total size: {{ formatBytes(totalSize) }}</strong>
                    <br />
                    <strong>Free space: {{ formatBytes(freeSize) }}</strong>
                </div>
            </div>
            <div class="section-content" v-else-if="!store.streamerListLoaded">
                <span class="icon"><fa icon="sync" spin></fa></span> Loading...
            </div>
            <div class="section-content" v-else>
                <span class="icon"><fa icon="exclamation-triangle"></fa></span>
                No channels found. Add some at <router-link :to="{ name: 'Settings', params: { tab: 'newchannel' } }">New Channel</router-link> to start.
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

interface DashboardData {
    loading: boolean;
    timer: number;
    timerMax: number;
    tickerInterval: number; // interval?
    vodUpdateInterval: number;
    totalSize: number;
    freeSize: number;
    oldData: Record<string, ApiChannel>;
    notificationSub: () => void;
    logVisible: boolean;
}

interface WebsocketJSON {
    action: string;
    data: any;
}

export default defineComponent({
    name: "DashboardView",
    setup() {
        const store = useStore();
        const logviewer = ref<InstanceType<typeof LogViewer>>();
        return { store, logviewer };
    },
    title(): string {
        // if (this.store.channelsOnline > 0) return `[${this.store.channelsOnline}] Dashboard`;
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
            logVisible: false,
        };
    },
    created() {
        console.debug("Dashboard created");
        // this.loading = true;
        // this.watchFaviconBadgeSub();
        this.logviewer?.fetchLog();
        // this.store.fetchAndUpdateJobs();
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
    },
    methods: {
       /**
        * @todo: reimplement ticker
        */
        async fetchTicker() {
            if (this.timer <= 0 && !this.loading) {
                this.loading = true;
                const streamerResult = await this.store.fetchStreamerList();

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
    // watch: {
    //     streamersOnline() {
    //         document.title = this.streamersOnline > 0 ? `[${this.streamersOnline}] Dashboard - ${this.store.app_name}` : `Dashboard - ${this.store.app_name}`;
    //     },
    // },
});
</script>
