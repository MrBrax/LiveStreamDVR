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
                <template v-if="!store.clientCfg('singlePage')">
                    <streamer v-for="streamer in sortedStreamers" v-bind:key="streamer.userid" v-bind:streamer="streamer" />
                </template>
                <template v-else>
                    <streamer v-bind:streamer="singleStreamer" @refresh="store.fetchAndUpdateStreamerList" />
                </template>
                <hr />
                <div class="dashboard-stats">
                    <strong>Total size: {{ formatBytes(store.diskTotalSize) }}</strong>
                    <br />
                    <strong>Free space: {{ formatBytes(store.diskFreeSize) }}</strong>
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
import type { ApiChannel } from "@common/Api/Client";
import { useStore } from "@/store";
import TwitchChannel from "@/core/channel";
import LogViewer from "@/components/LogViewer.vue";

interface DashboardData {
    loading: boolean;
    // vodUpdateInterval: number;
    oldData: Record<string, ApiChannel>;
    // notificationSub: () => void;
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
            oldData: {},
            logVisible: false,
        };
    },
    created() {
        console.debug("Dashboard created");
        this.logviewer?.fetchLog();
    },
    mounted() {

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
    methods: {
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
