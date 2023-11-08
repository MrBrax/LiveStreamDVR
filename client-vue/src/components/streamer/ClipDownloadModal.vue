<template>
    <div class="video-download-menu">
        <d-button v-if="isTwitchChannel(streamer)" color="success" icon="download" @click="fetchTwitchClips">
            {{ t("vod.fetch-clip-list") }}
        </d-button>
        <hr />
        <template v-if="!loading">
            <article v-for="clip in onlineClips" :key="clip.id" class="video-download-menu-item">
                <div class="section-image">
                    <img :src="imageUrl(clip.thumbnail_url, 320, 180)" />
                    <div class="duration">
                        <span>{{ humanDuration(clip.duration) }}</span>
                    </div>
                </div>
                <div class="video-content">
                    <h2>
                        <a :href="clip.url" rel="nofollow" target="_blank">{{ clip.title }}</a>
                    </h2>
                    <p>
                        {{ formatNumberShort(clip.view_count, 0) }} views
                        &bull;
                            {{ formatDistanceToNow(new Date(clip.created_at)) }} ago
                        <small>({{ format(new Date(clip.created_at), "yyyy-MM-dd HH:mm:ss") }})</small>
                    </p>
                    <p>
                        by {{ clip.creator_name }}, playing {{ clip.game_id }}
                    </p>
                </div>
                <div class="section-actions">
                    <d-button color="success" icon="download" size="small" @click="downloadClip(clip)">
                        {{ t("buttons.download") }}
                    </d-button>
                    <a class="button is-success is-small" :href="clip.url" target="_blank" rel="nofollow">
                        <span class="icon"><fa :icon="['fab', 'twitch']" /></span>
                        <span>{{ t("buttons.play") }}</span>
                    </a>
                    <a v-if="clip.video_id" class="button is-success is-small" :href="`https://twitch.tv/video/${clip.video_id}?t=${clip.vod_offset}`" target="_blank" rel="nofollow">
                        <span class="icon"><fa :icon="['fab', 'twitch']" /></span>
                        <span>{{ t("buttons.vod") }}</span>
                    </a>
                </div>
            </article>
        </template>
        <LoadingBox v-else />
    </div>
</template>

<script lang="ts" setup>
import { humanDuration, isTwitchChannel, formatNumber, formatNumberShort } from "@/mixins/newhelpers";
import type { Clip } from "@common/TwitchAPI/Clips";
import axios from "axios";
import { ref } from "vue";
import { library } from "@fortawesome/fontawesome-svg-core";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { faTwitch } from "@fortawesome/free-brands-svg-icons";
import { useI18n } from "vue-i18n";
import type { ApiResponse } from "@common/Api/Api";
import type { ChannelTypes } from "@/twitchautomator";
import { formatDistanceToNow, format } from "date-fns";
library.add(faSpinner, faTwitch);

const props = defineProps<{
    streamer: ChannelTypes;
}>();

const { t } = useI18n();

const onlineClips = ref<Clip[]>([]);
const loading = ref(false);

// clips
async function fetchTwitchClips() {
    if (!props.streamer) return;
    loading.value = true;
    let response;

    try {
        response = await axios.get<ApiResponse>(`/api/v0/channels/${props.streamer.uuid}/clips`);
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error("fetchTwitchClips error", error.response);
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
    onlineClips.value = data.data;
    loading.value = false;
}

async function downloadClip(clip: Clip) {
    if (!props.streamer) return;

    let response;

    try {
        response = await axios.post<ApiResponse>("/api/v0/tools/clip_download", {
            url: clip.url,
        });
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error("downloadClip error", error.response);
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
        flex-wrap: wrap;
        flex-direction: column;
        gap: 3px;
    }
}
</style>
