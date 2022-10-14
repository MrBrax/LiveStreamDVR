<template>
    <div class="container vertical">
        <article
            v-if="store.errors && store.errors.length > 0 && store.authElement"
            class="errors"
            aria-label="Errors"
        >
            <details class="details">
                <summary>Errors ({{ store.errors.length }})</summary>
                <ul>
                    <li
                        v-for="error in store.errors"
                        :key="error"
                    >
                        {{ error }}
                    </li>
                </ul>
            </details>
        </article>
        <section
            v-if="store.cfg('motd')"
            class="section"
        >
            <div class="section-title">
                <h1>{{ $t("dashboard.motd") }}</h1>
            </div>
            <div class="section-content motd">
                {{ store.cfg('motd') }}
            </div>
        </section>
        <section
            class="section"
            data-section="vods"
        >
            <div class="section-title">
                <h1>{{ $t("dashboard.recorded_vods") }}</h1>
            </div>
            <div
                v-if="store.streamerListLoaded && store.streamerList.length > 0"
                class="section-content"
            >
                <template v-if="!store.clientCfg('singlePage')">
                    <streamer
                        v-for="streamer in sortedStreamers"
                        :key="streamer.uuid"
                        :streamer="streamer"
                    />
                </template>
                <template v-else>
                    <streamer
                        v-if="singleStreamer"
                        :streamer="singleStreamer"
                        @refresh="store.fetchAndUpdateStreamerList"
                    />
                </template>
                <hr>
                <div class="dashboard-stats">
                    <strong>{{ $t('views.dashboard.total-size', [formatBytes(store.diskTotalSize)]) }}</strong>
                    <br>
                    <strong>{{ $t('views.dashboard.free-space', [formatBytes(store.diskFreeSize)]) }}</strong>
                </div>
            </div>
            <div
                v-else-if="!store.streamerListLoaded && store.authElement"
                class="section-content"
            >
                <span class="icon"><fa
                    icon="sync"
                    spin
                /></span> {{ $t("messages.loading") }}
            </div>
            <div
                v-else-if="!store.authElement"
                class="section-content"
            >
                <span class="icon"><fa icon="sign-in-alt" /></span> {{ $t("messages.login") }}
            </div>
            <div
                v-else
                class="section-content"
            >
                <span class="icon"><fa icon="exclamation-triangle" /></span>
                No channels found. Add some at <router-link :to="{ name: 'Settings', params: { tab: 'newchannel' } }">
                    New Channel
                </router-link> to start.
            </div>
        </section>

        <section class="section">
            <div
                class="section-title"
                @click="logToggle"
            >
                <h1>{{ $t('dashboard.logs') }}</h1>
            </div>
            <div
                v-if="logVisible && store.authElement"
                class="section-content"
            >
                <log-viewer ref="logviewer" />
            </div>
            <div
                v-else-if="!store.authElement"
                class="section-content"
            >
                <span class="icon"><fa icon="sign-in-alt" /></span> {{ $t("messages.login") }}
            </div>
        </section>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref } from "vue";
import Streamer from "@/components/StreamerItem.vue";
import type { ApiTwitchChannel } from "@common/Api/Client";
import { ChannelTypes, useStore } from "@/store";
import LogViewer from "@/components/LogViewer.vue";

interface DashboardData {
    loading: boolean;
    // vodUpdateInterval: number;
    oldData: Record<string, ApiTwitchChannel>;
    // notificationSub: () => void;
    logVisible: boolean;
}

export default defineComponent({
    name: "DashboardView",
    components: {
        Streamer,
        LogViewer,
    },
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
    computed: {
        sortedStreamers(): ChannelTypes[] {
            const streamers: ChannelTypes[] = [...this.store.streamerList];
            return streamers.sort((a, b) => a.displayName.localeCompare(b.displayName));
        },
        singleStreamer(): ChannelTypes | undefined {
            if (!this.store.streamerList) return undefined;

            const current = this.$route.query.channel as string;
            if (current !== undefined) {
                return this.store.streamerList.find((u) => u.uuid === current);
            } else {
                // this.$route.query.channel = this.store.streamerList[0].display_name;
                return this.store.streamerList[0];
            }
        },
    },
    created() {
        console.debug("Dashboard created");
        // this.logviewer?.fetchLog();
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
});
</script>
