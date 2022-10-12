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
                        <span v-if="streamer.api_getSubscriptionStatus">{{ $t("messages.subscribed") }}</span>
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
                        <span v-if="streamer.broadcaster_type">{{ streamer.broadcaster_type }}</span>
                        <span v-else>Free</span>
                    </span>
                    <span class="streamer-saves-vods">
                        &middot;
                        <span
                            v-if="!streamer.saves_vods"
                            class="text-is-error"
                        >{{ $t("streamer.no-save-vods") }}</span>
                    </span>
                    &middot;
                    <span
                        class="streamer-sxe"
                        title="Season and episode"
                    >
                        {{ streamer.current_season }}/{{ streamer.current_stream_number.toString().padStart(2, "0") }}
                    </span>
                    <span class="streamer-title-tools">

                        <!-- edit -->
                        <router-link
                            class="icon-button white"
                            :to="{ name: 'SettingsChannels', params: { channel: streamer.uuid } }"
                            title="Edit channel"
                        >
                            <span class="icon"><fa icon="pencil" /></span>
                        </router-link>

                        <span v-if="canAbortCapture">
                            <!-- abort recording -->
                            <button
                                class="icon-button white"
                                title="Abort record"
                                @click="abortCapture"
                            >
                                <span class="icon"><fa icon="video-slash" /></span>
                            </button>
                        </span>

                        <span v-else>
                            <!-- force recording -->
                            <button
                                class="icon-button white"
                                title="Force record"
                                @click="forceRecord"
                            >
                                <span class="icon"><fa icon="video" /></span>
                            </button>
                        </span>

                        <!-- dump playlist -->
                        <button
                            class="icon-button white"
                            title="Playlist record"
                            @click="playlistRecord"
                        >
                            <span class="icon"><fa icon="play-circle" /></span>
                        </button>

                        <!-- download stuff -->
                        <button
                            class="icon-button white"
                            title="Video download"
                            @click="showVideoDownloadMenu = true"
                        >
                            <span class="icon"><fa icon="download" /></span>
                        </button>

                        <!-- run cleanup -->
                        <button
                            class="icon-button white"
                            title="Clean up"
                            @click="doChannelCleanup"
                        >
                            <span class="icon"><fa icon="trash" /></span>
                        </button>

                        <!-- refresh channel data -->
                        <button
                            class="icon-button white"
                            title="Refresh data"
                            @click="doChannelRefresh"
                        >
                            <span class="icon"><fa icon="sync" /></span>
                        </button>

                        <!-- scan vods -->
                        <button
                            class="icon-button white"
                            title="Scan for VODs"
                            @click="doScanVods"
                        >
                            <span class="icon"><fa icon="folder-open" /></span>
                        </button>

                        <!-- expand/collapse all vods -->
                        <button
                            class="icon-button white"
                            title="Expand/collapse all vods"
                            @click="doToggleExpandVods"
                        >
                            <span class="icon"><fa :icon="toggleAllVodsExpanded ? 'chevron-up' : 'chevron-down'" /></span>
                        </button>
                    </span>
                </span>
            </div>
        </div>

        <!-- local clips -->
        <div
            v-if="streamer.clips_list && streamer.clips_list.length > 0"
            class="streamer-clips"
        >
            <div class="streamer-clips-title">
                <h3>{{ $t("messages.clips") }}</h3>
            </div>
            <ul>
                <li
                    v-for="clip in streamer.clips_list"
                    :key="clip.basename"
                >
                    <a
                        class="text-overflow"
                        :href="clipLink(clip)"
                        target="_blank"
                    >
                        <img
                            :src="basePath + '/cache/thumbs/' + clip.thumbnail"
                            alt="Clip thumbnail"
                        >
                        {{ clip.folder + "/" + clip.basename }}<br>
                        <span class="streamer-clips-info">{{ formatBytes(clip.size) }}, {{ formatDuration(clip.duration) }}, {{ clip.video_metadata.height }}p</span>
                    </a>
                </li>
            </ul>
        </div>

        <!-- local videos -->
        <div
            v-if="streamer.video_list && streamer.video_list.length > 0"
            class="local-videos"
        >
            <div class="local-videos-title">
                <h3>{{ $t("messages.local-videos") }}</h3>
            </div>
            <transition-group
                tag="div"
                class="local-videos-container"
            >
                <div
                    v-for="video in streamer.video_list"
                    :key="video.basename"
                    class="local-video"
                >
                    <a
                        target="_blank"
                        :href="webPath + '/' + video.basename"
                    >
                        <img
                            :src="basePath + '/cache/thumbs/' + video.thumbnail"
                            alt="Video thumbnail"
                        ><br>
                        <span class="local-video-title">{{ video.basename }}</span>
                    </a><br>
                    <span class="local-video-info">{{ formatBytes(video.size) }}, {{ formatDuration(video.duration) }}, {{ video.video_metadata.height }}p</span>
                </div>
            </transition-group>
        </div>

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
                    ref="vodItem"
                    v-observe-visibility="{
                        callback: (s: boolean, e: IntersectionObserverEntry) => visibilityChanged(vod.basename, s, e),
                        intersection: {
                            threshold: 0.9,
                        }
                    }"
                    :vod="vod"
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
import { library } from "@fortawesome/fontawesome-svg-core";
import { faVideo, faPlayCircle, faVideoSlash, faDownload, faSync, faPencil, faFolderOpen, faTrash } from "@fortawesome/free-solid-svg-icons";
import { ProxyVideo } from "@common/Proxies/Video";
import { ChannelTypes, useStore, VODTypes } from "@/store";
import { ApiResponse } from "@common/Api/Api";
import { LocalClip } from "@common/LocalClip";
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

// setup
// const videoDownloadMenu = ref<InstanceType<typeof ModalBox>>();
const showVideoDownloadMenu = ref(false);
const vodItem = ref<InstanceType<typeof VodItem>>();

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

const canAbortCapture = computed(() => {
    if (!props.streamer) return false;
    return props.streamer.is_capturing && store.jobList.some((job) => props.streamer && job.name.startsWith(`capture_${props.streamer.internalName}`));
});

const avatarUrl = computed(() => {
    if (!props.streamer) return;
    // if ("channel_data" in this.streamer && this.streamer.channel_data?.cache_avatar) return `${this.store.cfg<string>("basepath", "")}/cache/avatars/${this.streamer.channel_data.cache_avatar}`;
    return props.streamer.profilePictureUrl;
});

const areMostVodsExpanded = computed(() => {
    if (!props.streamer) return false;
    const vods = onlineVods.value as unknown as typeof VodItem[];
    if (!vods) return false;
    return vods.filter((vod) => vod.minimized === false).length >= props.streamer.vods_list.length / 2;
});

const webPath = computed(() => {
    if (!props.streamer) return "";
    return store.cfg<string>("basepath", "") + "/vods/" + (store.cfg("channel_folders") ? props.streamer.internalName : "");
});

const basePath = computed(() => {
    return store.cfg<string>("basepath", "");
});

const filteredVodsList = computed(() => {
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
});

function refresh() {
    emit("refresh");
}

async function abortCapture() {
    // href="{{ url_for('api_jobs_kill', { 'job': 'capture_' ~ streamer.current_vod.basename }) }}"

    if (!props.streamer || !props.streamer.current_vod) return;

    if (!confirm("Abort record is unstable. Continue?")) return;

    let response;

    try {
        response = await axios.delete(`/api/v0/jobs/capture_${props.streamer.internalName}_*`);
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error("abortCapture error", error.response);
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

    console.log("Killed", data);
}

async function forceRecord() {
    if (!props.streamer) return;
    if (!confirm("Force record is unstable. Continue?")) return;

    let response;

    try {
        response = await axios.post(`/api/v0/channels/${props.streamer.uuid}/force_record`);
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error("forceRecord error", error.response);
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

    console.log("Recorded", data);
}

async function playlistRecord() {
    // href="{{ url_for('api_channel_dump_playlist', { 'username': streamer.display_name }) }}"

    if (!props.streamer || !props.streamer.current_vod) return;

    let response;

    try {
        response = await axios.get(`/api/v0/channels/${props.streamer.uuid}/dump_playlist`);
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error("abortCapture error", error.response);
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

    console.log("Killed", data);
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

async function doChannelCleanup() {
    if (!props.streamer) return;

    if (!confirm("Do you want to clean up vods that don't meet your criteria? There is no undo.")) return;

    let response;

    try {
        response = await axios.post(`/api/v0/channels/${props.streamer.uuid}/cleanup`);
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error("doChannelCleanup error", error.response);
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

    console.log("Cleaned", data);
}

async function doChannelRefresh() {
    if (!props.streamer) return;
    axios
        .post(`/api/v0/channels/${props.streamer.uuid}/refresh`)
        .then((response) => {
            const json: ApiResponse = response.data;
            if (json.message) alert(json.message);
            console.log(json);
            store.fetchStreamerList();
        })
        .catch((error) => {
            if (axios.isAxiosError(error)) {
                console.error("doChannelRefresh error", error.response);
                if (error.response && error.response.data && error.response.data.message) {
                    alert(error.response.data.message);
                }
            }
        });
}

async function doScanVods() {
    if (!props.streamer) return;
    if (!confirm("Do you want to rescan for VODs? It might not find everything.")) return;
    axios
        .post(`/api/v0/channels/${props.streamer.uuid}/scan`)
        .then((response) => {
            const json: ApiResponse = response.data;
            if (json.message) alert(json.message);
            console.log(json);
            store.fetchStreamerList();
        })
        .catch((error) => {
            if (axios.isAxiosError(error)) {
                console.error("doChannelRefresh error", error.response);
                if (error.response && error.response.data && error.response.data.message) {
                    alert(error.response.data.message);
                }
            }
        });
}

function imageUrl(url: string, width: number, height: number) {
    if (!url) return "";
    return url.replace(/%\{width\}/g, width.toString()).replace(/%\{height\}/g, height.toString());
}

function clipLink(clip: LocalClip): string {
    const path = clip.folder + "/" + clip.basename;
    return `${store.cfg<string>("basepath", "")}/saved_clips/${path}`;
}

function doToggleExpandVods() {
    // loop through all vods and set the expanded state
    const vods = vodItem as unknown as typeof VodItem[];
    if (vods){
        for(const vod of vods) {
            vod.minimized = toggleAllVodsExpanded;
        }
    }
    toggleAllVodsExpanded.value = !toggleAllVodsExpanded.value;
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

    .streamer-title-tools {
        .icon-button {
            margin-left: 0.3em;
        }
    }
}

.streamer-clips {
    background-color: var(--video-description-background-color);
    .streamer-clips-title {
        padding: 5px;
        background: #116d3c;
        color: #fff;
        h3 {
            font-size: 1.2em;
            margin: 0;
            padding: 0;
        }
    }
    ul {
        display: block;
        margin: 0;
        padding: 0.5em;
        list-style: none;
        li {
            &:not(:last-child) {
                margin-bottom: 0.5em;
            }
            a {
                display: block;
                // align-items: center;
                img {
                    max-height: 32px;
                    padding-right: 0.5em;
                    float: left;
                }
                &:hover img {
                    filter: brightness(1.5);
                }
            }
        }
    }
    .streamer-clips-info {
        font-size: 0.8em;
        text-decoration: none;
        display: inline-block;
        color: var(--text-darker);
    }
}

.local-videos {
    background-color: var(--video-description-background-color);
    .local-videos-title {
        padding: 5px;
        background: #116d3c;
        color: #fff;
        h3 {
            font-size: 1.2em;
            margin: 0;
            padding: 0;
        }
    }
    .local-videos-container {
        display: grid;
        margin: 0;
        // padding: 0.5em;
        grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
        .local-video {
            text-align: center;
            display: block;
            padding: 0.5em;
            a:hover {
                img {
                    border: 1px solid #dda711;
                }
            }
        }
    }
    .local-video-info {
        font-size: 0.8em;
        color: var(--text-darker);
    }
    img {
        max-height: 135px;
    }
}

.video-list {
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
}

</style>
