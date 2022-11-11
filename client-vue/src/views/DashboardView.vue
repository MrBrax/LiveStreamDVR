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
                <h1>{{ t("dashboard.motd") }}</h1>
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
                <h1>{{ t("dashboard.recorded_vods") }}</h1>
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
                    <strong>{{ t('views.dashboard.total-size', [formatBytes(store.diskTotalSize)]) }}</strong>
                    <br>
                    <strong>{{ t('views.dashboard.free-space', [formatBytes(store.diskFreeSize)]) }}</strong>
                </div>
            </div>
            <div
                v-else-if="!store.streamerListLoaded && store.authElement"
                class="section-content"
            >
                <div class="loading">
                    <span class="icon"><fa
                        icon="sync"
                        spin
                    /></span> {{ t("messages.loading") }}
                </div>
            </div>
            <div
                v-else-if="!store.authElement"
                class="section-content"
            >
                <span class="icon"><font-awesome-icon icon="sign-in-alt" /></span> {{ t("messages.login") }}
            </div>
            <div
                v-else
                class="section-content"
            >
                <span class="icon"><font-awesome-icon icon="exclamation-triangle" /></span>
                No channels found. Add some at <router-link :to="{ name: 'Settings', params: { tab: 'newchannel' } }">
                    New Channel
                </router-link> to start.
            </div>
        </section>

        <section class="section">
            <div
                class="section-title is-expandable"
                @click="logToggle"
                @keyup.prevent.enter="logToggle"
                @keyup.prevent.space="logToggle"
                tabindex="0"
            >
                <h1>{{ t('dashboard.logs') }}</h1>
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
                <span class="icon"><font-awesome-icon icon="sign-in-alt" /></span> {{ t("messages.login") }}
            </div>
        </section>
    </div>
</template>

<script lang="ts" setup>
import Streamer from "@/components/StreamerItem.vue";
import { ChannelTypes, useStore } from "@/store";
import LogViewer from "@/components/LogViewer.vue";
import { useI18n } from "vue-i18n";
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { formatBytes } from "@/mixins/newhelpers";

const store = useStore();
const logviewer = ref<InstanceType<typeof LogViewer>>();
const { t } = useI18n();
const route = useRoute();

// title(): string {
//     // if (store.channelsOnline > 0) return `[${store.channelsOnline}] Dashboard`;
//     return "Dashboard";
// },
    
// const loading = ref(false);
// const oldData = ref<Record<string, ApiTwitchChannel>>({});
const logVisible = ref(false);
    
const sortedStreamers = computed((): ChannelTypes[] => {
    const streamers: ChannelTypes[] = [...store.streamerList];
    return streamers.sort((a, b) => a.displayName.localeCompare(b.displayName));
});

const singleStreamer = computed((): ChannelTypes | undefined => {
    if (!store.streamerList) return undefined;

    const current = route.query.channel as string;
    if (current !== undefined) {
        return store.streamerList.find((u) => u.uuid === current);
    } else {
        // this.$route.query.channel = store.streamerList[0].display_name;
        return store.streamerList[0];
    }
});
    
onMounted(() => {
    console.debug("Dashboard created");
    // this.logviewer?.fetchLog();
});
    
function logToggle() {
    logVisible.value = !logVisible.value;
    logviewer.value?.scrollLog(); // TODO: don't use refs
}

</script>
