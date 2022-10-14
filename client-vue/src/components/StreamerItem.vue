<template>
    <div
        v-if="streamer"
        :id="'streamer_' + streamer.uuid"
        class="streamer-box"
    >
        <div :class="{ 'streamer-title': true, 'is-live': streamer.is_live, 'is-capturing': streamer.is_capturing }">
            <div
                class="streamer-title-avatar"
                :style="'background-image: url(' + avatarUrl + ')'"
            />
            <div class="streamer-title-text">
                <h2>
                    <a
                        :href="streamer.url"
                        rel="noreferrer"
                        target="_blank"
                    >
                        {{ streamer.displayName }}
                        <template v-if="streamer.internalName.toLowerCase() != streamer.displayName.toLowerCase()"> ({{ streamer.internalName }})</template>
                    </a>
                    <span
                        v-if="streamer.is_live"
                        class="streamer-live"
                    >live</span>
                    <span
                        v-if="streamer.is_capturing"
                        class="streamer-capturing"
                    >capturing</span>
                </h2>
                <span class="streamer-title-subtitle">
                    <span
                        class="streamer-vods-quality help"
                        title="Quality"
                    >{{ quality }}</span><!-- quality -->
                    &middot;
                    <span
                        class="streamer-vods-amount"
                        title="Total vod amount"
                    >{{ $tc("vods", streamer.vods_list.length) }}</span><!-- vods -->
                    &middot;
                    <span
                        class="streamer-vods-size"
                        title="Total vod size"
                    >{{ formatBytes(streamer.vods_size) }}</span><!-- total size -->
                    &middot;
                    <span class="streamer-subbed-status">
                        <template v-if="streamer.api_getSubscriptionStatus">{{ $t("messages.subscribed") }}</template>
                        <span
                            v-else
                            class="text-is-error"
                            title="Could just be that subscriptions were made before this feature was implemented."
                        >
                            {{ $t('streamer.one-or-more-subscriptions-missing') }}
                        </span></span><!-- sub status -->
                    &middot;
                    <span
                        class="streamer-type"
                        title="Broadcaster type"
                    >
                        <template v-if="streamer.broadcaster_type">{{ streamer.broadcaster_type }}</template>
                        <template v-else>Free</template>
                    </span>
                    <span
                        v-if="!streamer.saves_vods"
                        class="streamer-saves-vods text-is-error"
                    >
                        &middot; {{ $t("streamer.no-save-vods") }}
                    </span>
                    &middot;
                    <span
                        class="streamer-sxe"
                        title="Season and episode"
                    >
                        {{ streamer.current_season }}/{{ streamer.current_stream_number.toString().padStart(2, "0") }}
                    </span>
                    <streamer-item-tools
                        :streamer="streamer"
                        :toggle-all-vods-expanded="toggleAllVodsExpanded"
                        @show-video-download-menu="showVideoDownloadMenu = true"
                        @toggle-expand-vods="doToggleExpandVods"
                    />
                </span>
            </div>
        </div>

        <streamer-item-clips :streamer="streamer" />

        <streamer-item-local-videos :streamer="streamer" />

        <div
            v-if="streamer.vods_list.length == 0"
            class="notice"
        >
            <span v-if="streamer.no_capture">{{ $t("streamer.no-vods-not-capturing") }}</span>
            <span v-else>{{ $t("messages.no_vods") }}</span>
        </div>
        <div
            v-else
            class="video-list"
        >
            <div
                v-if="!store.clientCfg('expandDashboardVodList') && streamer.vods_list.length > store.clientCfg('vodsToShowInDashboard', 4)"
                class="streamer-expand-container"
            >
                <button
                    class="streamer-expand-main"
                    title="Click to toggle VOD list"
                    @click="toggleLimitVods"
                >
                    <span class="icon"><fa :icon="limitVods ? 'chevron-up' : 'chevron-down'" /></span>
                    <transition>
                        <span
                            v-if="!limitVods"
                            class="text"
                        >
                            {{ streamer.vods_list.length - store.clientCfg('vodsToShowInDashboard', 4) }} hidden VODs
                        </span>
                    </transition>
                </button>
            </div>
            <transition-group
                name="list"
                tag="div"
            >
                <vod-item
                    v-for="vod in filteredVodsList"
                    :key="vod.uuid"
                    v-observe-visibility="{
                        callback: (s: boolean, e: IntersectionObserverEntry) => visibilityChanged(vod.basename, s, e),
                        intersection: {
                            threshold: 0.9,
                        }
                    }"
                    :vod="vod"
                    :minimized="toggleVodMinimizedStatus[vod.uuid]"
                    @toggle-minimize="toggleVodMinimizedStatus[vod.uuid] = !toggleVodMinimizedStatus[vod.uuid]"
                    @refresh="refresh"
                />
            </transition-group>
        </div>
        <modal-box
            :show="showVideoDownloadMenu"
            title="Video download"
            @close="showVideoDownloadMenu = false"
        >
            <div class="video-download-menu">
                <p>
                    {{ $t('messages.video_download_help') }}<br>
                    <!--<span v-if="averageVodBitrate">Average bitrate: {{ averageVodBitrate / 1000 }} kbps</span>-->
                </p>
                <button
                    v-if="isTwitch(streamer)"
                    class="button is-confirm"
                    @click="fetchTwitchVods"
                >
                    <span class="icon"><fa icon="download" /></span>
                    <span>{{ $t('vod.fetch-vod-list') }}</span>
                </button>
                <button
                    v-if="isYouTube(streamer)"
                    class="button is-confirm"
                    @click="fetchYouTubeVods"
                >
                    <span class="icon"><fa icon="download" /></span>
                    <span>{{ $t('vod.fetch-vod-list') }}</span>
                </button>
                <hr>
                <div
                    v-for="vod in onlineVods"
                    :key="vod.id"
                    class="video-download-menu-item"
                >
                    <h2>
                        <a
                            :href="vod.url"
                            rel="nofollow"
                            target="_blank"
                        >{{ vod.created_at }}</a>
                    </h2>
                    <img :src="imageUrl(vod.thumbnail, 320, 240)"><br>
                    <p>{{ vod.title }}</p>
                    <ul>
                        <li>{{ formatDuration(vod.duration) }}</li>
                        <li>{{ formatNumber(vod.view_count, 0) }} views</li>
                        <li v-if="vod.muted_segments && vod.muted_segments.length > 0">
                            <span class="text-is-error">Muted segments: {{ vod.muted_segments.length }}</span>
                        </li>
                        <!--<li>Estimated size: {{ formatBytes(((averageVodBitrate || 6000000) / 10) * parseTwitchDuration(vod.duration)) }}</li>-->
                    </ul>
                    <br>
                    <button
                        class="button is-small is-confirm"
                        @click="downloadVideo(vod.id.toString())"
                    >
                        <span class="icon"><fa icon="download" /></span>
                        <span>{{ $t("buttons.download") }}</span>
                    </button>
                </div>
            </div>
        </modal-box>
    </div>
    <div v-else>
        Invalid streamer
    </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import VodItem from "@/components/VodItem.vue";
import ModalBox from "@/components/ModalBox.vue";
import StreamerItemClips from "./StreamerItemClips.vue";
import StreamerItemLocalVideos from "./StreamerItemLocalVideos.vue";
import StreamerItemTools from "./StreamerItemTools.vue";
import { library } from "@fortawesome/fontawesome-svg-core";
import { faVideo, faPlayCircle, faVideoSlash, faDownload, faSync, faPencil, faFolderOpen, faTrash } from "@fortawesome/free-solid-svg-icons";
import { ProxyVideo } from "@common/Proxies/Video";
import { ChannelTypes, useStore, VODTypes } from "@/store";
import { ApiResponse } from "@common/Api/Api";
import YouTubeChannel from "@/core/Providers/YouTube/YouTubeChannel";
import axios from "axios";
library.add(faVideo, faPlayCircle, faVideoSlash, faDownload, faSync, faPencil, faFolderOpen, faTrash);

const props = defineProps<{
    streamer: ChannelTypes;
}>();

const emit = defineEmits<{
    (e: "refresh"): void;
}>();

const store = useStore();

// data
const onlineVods = ref<ProxyVideo[]>([]);
const toggleAllVodsExpanded = ref(false);
const limitVods = ref(false);

const toggleVodMinimizedStatus = ref<Record<string, boolean>>({});

// setup
// const videoDownloadMenu = ref<InstanceType<typeof ModalBox>>();
const showVideoDownloadMenu = ref(false);
// const vodItem = ref<InstanceType<typeof VodItem>>();

const quality = computed(() => {
    if (!props.streamer || !props.streamer.quality) return "";
    return props.streamer.quality.join(", ")
});

const averageVodBitrate = computed(() => {
    if (!props.streamer) return;
    const vods = props.streamer.vods_list;
    const total = (vods as VODTypes[]).reduce((acc, vod) => {
        if (!vod.video_metadata) return acc;
        return acc + vod.video_metadata.bitrate;
    }, 0);
    return total / vods.length;
});



const avatarUrl = computed(() => {
    if (!props.streamer) return;
    // if ("channel_data" in this.streamer && this.streamer.channel_data?.cache_avatar) return `${this.store.cfg<string>("basepath", "")}/cache/avatars/${this.streamer.channel_data.cache_avatar}`;
    return props.streamer.profilePictureUrl;
});

const areMostVodsExpanded = computed(() => {
    if (!props.streamer) return false;
    return Object.values(toggleVodMinimizedStatus.value).filter((val) => val === false).length >= props.streamer.vods_list.length / 2;
});

const basePath = computed(() => {
    return store.cfg<string>("basepath", "");
});

const filteredVodsList = computed((): VODTypes[] => {
    if (!props.streamer) return [];
    if (limitVods.value || store.clientCfg('expandDashboardVodList')) return props.streamer.vods_list;
    const vodsToShow = store.clientCfg('vodsToShowInDashboard', 4);
    if (vodsToShow === 0) return [];
    // return last 4 vods
    return props.streamer.vods_list.slice(-vodsToShow);
});

const providerapi = computed(() => {
    if (props.streamer && props.streamer.provider == "youtube") return "youtubeapi";
    return "twitchapi";
});

onMounted(() => {

    toggleAllVodsExpanded.value = areMostVodsExpanded.value;

    for (const vod of props.streamer.vods_list) {

        if (store.clientCfg("minimizeVodsByDefault")) {
            toggleVodMinimizedStatus.value[vod.uuid] = !vod.is_capturing;
            continue;
        }

        toggleVodMinimizedStatus.value[vod.uuid] = false;

    }
});

function refresh() {
    emit("refresh");
}

async function fetchTwitchVods() {
    if (!props.streamer) return;
    let response;

    try {
        response = await axios.get(`/api/v0/twitchapi/videos/${props.streamer.login}`);
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error("fetchTwitchVods error", error.response);
            if (error.response && error.response.data && error.response.data.message) {
                alert(error.response.data.message);
            }
        }
        return;
    }

    const data = response.data;

    if (data.message) {
        alert(data.message);
    }

    console.log("Fetched", data);
    onlineVods.value = data.data;
}

async function fetchYouTubeVods() {
    if (!props.streamer || !(props.streamer instanceof YouTubeChannel)) return;
    let response;

    try {
        response = await axios.get(`/api/v0/youtubeapi/videos/${props.streamer.channel_id}`);
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error("fetchYouTubeVods error", error.response);
            if (error.response && error.response.data && error.response.data.message) {
                alert(error.response.data.message);
            }
        }
        return;
    }

    const data = response.data;

    if (data.message) {
        alert(data.message);
    }

    console.log("Fetched", data);
    onlineVods.value = data.data;
}

async function downloadVideo(id: string) {
    if (!props.streamer) return;

    let response;

    try {
        response = await axios.get(`/api/v0/channels/${props.streamer.uuid}/download/${id}`);
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error("downloadVideo error", error.response);
            if (error.response && error.response.data && error.response.data.message) {
                alert(error.response.data.message);
            }
        }
        return;
    }

    const data = response.data;

    if (data.message) {
        alert(data.message);
    }

    console.log("Downloaded", data);
}

function imageUrl(url: string, width: number, height: number) {
    if (!url) return "";
    return url.replace(/%\{width\}/g, width.toString()).replace(/%\{height\}/g, height.toString());
}

function doToggleExpandVods() {
    if (!props.streamer) return;

    toggleAllVodsExpanded.value = !toggleAllVodsExpanded.value;

    for (const vod of props.streamer.vods_list) {
        toggleVodMinimizedStatus.value[vod.uuid] = toggleAllVodsExpanded.value;
    }

    // loop through all vods and set the expanded state
    /*
    if (vods){
        for(const vod of vods) {
            vod.minimized = toggleAllVodsExpanded;
        }
    }
    toggleAllVodsExpanded.value = !toggleAllVodsExpanded.value;
    */
}

function visibilityChanged(basename: string, isVisible: boolean, entry: IntersectionObserverEntry) {
    // console.log(basename, isVisible, entry);
    if (isVisible) store.setVisibleVod(basename);
}

function toggleLimitVods() {
    limitVods.value = !limitVods.value;
}

</script>

<style lang="scss" scoped>
@import "../assets/_variables";

.video-download-menu-item {
    background-color: rgba(0, 0, 0, 0.2);
    padding: 1em;
    &:not(:last-child) {
        margin-bottom: 1em;
    }
}

.streamer-title {
    font-size: 110%;

    position: sticky;
    top: 0px;
    z-index: 2;

    // height: 50px;

    $bg-color: #243e94;

    background-color: $bg-color;

    // margin-bottom: 5px;
    margin-bottom: 1px;

    color: #fff;

    // border-bottom: 1px solid #919191;
    // box-shadow: 0 3px 3px rgba(0,0,0,.15);

    display: flex;

    .streamer-title-avatar {
        // background-color: #0f0;
        background-size: cover;
        background-repeat: no-repeat;
        background-position: center;
        // animation: zoom 1s infinite ease-in-out;
        width: 50px; // css, why
        /*
		img {
			background-color: #f00;
			height: 100%;
			width: auto;
		}
		*/
    }

    .streamer-title-text {
        flex-grow: 1;
        padding: 5px 8px;
    }

    .streamer-title-subtitle {
        font-size: 90%;
        color: #779ae7;
    }

    h2 {
        font-size: 1.3em;
        margin: 0;
        padding: 0;
    }

    a {
        color: #fff;
        text-decoration: none;

        &:hover {
            color: #b673f5;
        }
    }

    &.is-live {
        background-color: #0b5e2b;

        .streamer-title-subtitle {
            color: #31db7e;
        }

        a:hover {
            color: #7beb9d;
        }
    }

    &.is-capturing {
        background-color: #5e0b0b;

        .streamer-title-subtitle {
            color: #db3131;
        }

        a:hover {
            color: #eb7b7b;
        }
    }

    .streamer-live, .streamer-capturing {
        color: #f00;
        animation: live ease-in-out 1s infinite;
        font-weight: 700;
        display: inline-block;
        margin-left: 5px;
    }

}

.streamer-expand-container {
    display: block;
    margin-top: 0.5em;
    margin-bottom: 0.5em;
    .streamer-expand-main {
        display: block;
        width: 100%;
        text-align: left;
        background-color: #2b61d6;
        color: #fff;
        border: none;
        padding: 0.5em;
        font-family: "Roboto Condensed";
        font-size: 1.2em;
        font-weight: 500;
        cursor: pointer;
        &:hover {
            background-color: #356be0;
        }
        .text {
            padding-left: 0.5em;
        }
    }
}

.streamer-type::first-letter {
    text-transform: capitalize;
}

</style>
