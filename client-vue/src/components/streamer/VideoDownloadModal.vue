<template>
    <div class="video-download-menu">
        <p>
            {{ t('messages.video_download_help') }}<br>
            <!--<span v-if="averageVodBitrate">Average bitrate: {{ averageVodBitrate / 1000 }} kbps</span>-->
        </p>
        <button
            v-if="isTwitch(streamer)"
            class="button is-confirm"
            @click="fetchTwitchVods"
        >
            <span class="icon"><fa icon="download" /></span>
            <span>{{ t('vod.fetch-vod-list') }}</span>
        </button>
        <button
            v-if="isYouTube(streamer)"
            class="button is-confirm"
            @click="fetchYouTubeVods"
        >
            <span class="icon"><fa icon="download" /></span>
            <span>{{ t('vod.fetch-vod-list') }}</span>
        </button>
        <hr>
        <template v-if="!loading">
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
                    <span>{{ t("buttons.download") }}</span>
                </button>
            </div>
        </template>
        <template v-else>
            <span class="icon"><fa
                icon="spinner"
                spin
            /></span> {{ t('messages.loading') }}
        </template>
    </div>
</template>

<script lang="ts" setup>
import YouTubeChannel from '@/core/Providers/YouTube/YouTubeChannel';
import { isTwitch, isYouTube, formatDuration, formatNumber } from '@/mixins/newhelpers';
import { ChannelTypes } from '@/store';
import { ProxyVideo } from '@common/Proxies/Video';
import axios from 'axios';
import { ref } from 'vue';
import { library } from "@fortawesome/fontawesome-svg-core";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { useI18n } from 'vue-i18n';
import { ApiResponse } from "@common/Api/Api";
library.add(faSpinner);

const props = defineProps<{
    streamer: ChannelTypes;
}>();

const { t } = useI18n();

const onlineVods = ref<ProxyVideo[]>([]);
const loading = ref(false);

// videos
async function fetchTwitchVods() {
    if (!props.streamer) return;
    loading.value = true;
    let response;

    try {
        response = await axios.get<ApiResponse>(`/api/v0/twitchapi/videos/${props.streamer.login}`);
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
        response = await axios.get<ApiResponse>(`/api/v0/youtubeapi/videos/${props.streamer.channel_id}`);
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
        response = await axios.get<ApiResponse>(`/api/v0/channels/${props.streamer.uuid}/download/${id}`);
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
}

</style>