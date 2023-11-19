<template>
    <div class="video-download-menu">
        <p>
            {{ t("messages.video_download_help") }}<br />
            <!--<span v-if="averageVodBitrate">Average bitrate: {{ averageVodBitrate / 1000 }} kbps</span>-->
        </p>
        <d-button v-if="isTwitchChannel(streamer)" color="success" icon="download" @click="fetchTwitchVods">
            {{ t("vod.fetch-vod-list") }}
        </d-button>
        <d-button v-if="isYouTubeChannel(streamer)" color="success" icon="download" @click="fetchYouTubeVods">
            {{ t("vod.fetch-vod-list") }}
        </d-button>
        <hr />
        <template v-if="!loading">
            <article v-for="vod in onlineVods" :key="vod.id" class="video-download-menu-item">
                <div class="section-image">
                    <img :src="imageUrl(vod.thumbnail, 320, 180)" />
                    <div class="duration">
                        <span>{{ humanDuration(vod.duration) }}</span>
                    </div>
                </div>
                <div class="video-content">
                    <h2>
                        <a :href="vod.url" rel="nofollow" target="_blank">{{ vod.title }}</a>
                    </h2>
                    <p>
                        {{ formatNumberShort(vod.view_count, 0) }} views
                        &bull;
                        
                            {{ formatDistanceToNow(new Date(vod.created_at)) }} ago
                        
                        <small>({{ format(new Date(vod.created_at), `${store.cfg('locale.date-format')} ${store.cfg('locale.time-format')}`) }})</small>
                    </p>
                    <p>{{ vod.description }}</p>
                    <ul>
                        <li><strong>Type:</strong> {{ vod.type }}</li>
                        <li><strong>Stream ID:</strong> {{ vod.stream_id }}</li>
                        <li v-if="vod.muted_segments && vod.muted_segments.length > 0">
                            <span class="text-is-error"><strong>Muted segments:</strong> {{ vod.muted_segments.length }}</span>
                        </li>
                        <!--<li>Estimated size: {{ formatBytes(((averageVodBitrate || 6000000) / 10) * parseTwitchDuration(vod.duration)) }}</li>-->
                    </ul>
                    <div class="section-actions">
                        <div class="select is-small">
                            <d-select v-if="isTwitchChannel(streamer)" v-model="quality" :options="VideoQualityArray" />
                        </div>
                        <d-button size="small" color="success" icon="download" @click="downloadVideo(vod.id.toString())">
                            {{ t("buttons.download") }}
                        </d-button>
                    </div>
                </div>
            </article>
        </template>
        <LoadingBox v-else />
    </div>
</template>

<script lang="ts" setup>
import YouTubeChannel from "@/core/Providers/YouTube/YouTubeChannel";
import { VideoQualityArray } from "@common/Defs";
import { isTwitchChannel, isYouTubeChannel, humanDuration, formatNumber, formatNumberShort } from "@/mixins/newhelpers";
import type { ProxyVideo } from "@common/Proxies/Video";
import axios from "axios";
import { ref } from "vue";
import { library } from "@fortawesome/fontawesome-svg-core";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { useI18n } from "vue-i18n";
import type { ApiResponse } from "@common/Api/Api";
import type { ChannelTypes } from "@/twitchautomator";
import { formatDistanceToNow, format } from "date-fns";
import { useStore } from "@/store";
library.add(faSpinner);

const props = defineProps<{
    streamer: ChannelTypes;
}>();

const { t } = useI18n();

const onlineVods = ref<ProxyVideo[]>([]);
const loading = ref(false);
const quality = ref<string>("best");

const store = useStore();

// videos
async function fetchTwitchVods() {
    if (!props.streamer) return;
    loading.value = true;
    let response;

    try {
        response = await axios.get<ApiResponse>(`/api/v0/twitchapi/videos/${props.streamer.internalName}`);
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error("fetchTwitchVods error", error.response);
            if (error.response && error.response.data && error.response.data.message) {
                alert(error.response.data.message);
            }
        }
        loading.value = false;
        return;
    }

    const data = response.data;

    if (data.message) {
        alert(data.message);
    }

    console.log("Fetched", data);
    onlineVods.value = data.data;
    loading.value = false;
}

async function fetchYouTubeVods() {
    if (!props.streamer || !(props.streamer instanceof YouTubeChannel)) return;
    loading.value = true;
    let response;

    try {
        response = await axios.get<ApiResponse>(`/api/v0/youtubeapi/videos/${props.streamer.internalId}`);
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error("fetchYouTubeVods error", error.response);
            if (error.response && error.response.data && error.response.data.message) {
                alert(error.response.data.message);
            }
        }
        loading.value = false;
        return;
    }

    const data = response.data;

    if (data.message) {
        alert(data.message);
    }

    console.log("Fetched", data);
    onlineVods.value = data.data;
    loading.value = false;
}

async function downloadVideo(id: string) {
    if (!props.streamer) return;

    let response;

    try {
        response = await axios.get<ApiResponse>(`/api/v0/channels/${props.streamer.uuid}/download/${id}?quality=${quality.value}`);
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
</script>

<style lang="scss" scoped>
.video-download-menu-item {
    background-color: rgba(0, 0, 0, 0.1);
    padding: 1em;
    &:not(:last-child) {
        margin-bottom: 1em;
    }
    display: flex;
    gap: 1em;
    .video-content {
        flex: 1;
        h2 {
            margin-top: 0;
            margin-bottom: 0.5em;
            font-family: Poppins, sans-serif;
            font-size: 1.2em;
            overflow-wrap: break-word;
            word-break: break-all;
        }
        ul {
            margin-top: 0;
            margin-bottom: 0;
            padding-left: 1em;
        }
        p {
            margin-top: 0;
            margin-bottom: 0.5em;
        }
    }
    .section-image{
        aspect-ratio: 16/9;
        max-height: 120px;
        img {
            height: 100%;
            border-radius: 5%;
        }
        position: relative;
        .duration {
            position: absolute;
            bottom: 5px;
            right: 5px;
            background-color: rgba(0, 0, 0, 0.8);
            padding: 0.25em 0.5em;
            border-radius: 10%;
            font-size: 0.9em;
            font-weight: bold;
            color: white;
        }
    }
    .section-actions {
        display: flex;
        justify-content: flex-end;
    }
}
</style>
