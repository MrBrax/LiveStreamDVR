<template>
    <!-- local videos -->
    <div v-if="streamer.video_list && streamer.video_list.length > 0" class="local-videos" aria-label="Videos">
        <div class="local-videos-title">
            <h3>{{ t("messages.local-videos") }}</h3>
        </div>
        <transition-group tag="div" class="local-videos-container">
            <div v-for="video in streamer.video_list" :key="video.basename" class="local-video">
                <a target="_blank" :href="webPath + '/' + video.basename" @click.prevent="store.playMedia(webPath + '/' + video.basename)">
                    <img :src="basePath + '/cache/thumbs/' + video.thumbnail" alt="Video thumbnail" /><br />
                    <span class="local-video-title">{{ video.basename }}</span> </a
                ><br />
                <span class="local-video-info">{{ formatBytes(video.size) }}, {{ humanDuration(video.duration) }}, {{ video.video_metadata.height }}p</span>
            </div>
        </transition-group>
    </div>
</template>

<script lang="ts" setup>
import { useStore } from "@/store";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { formatBytes, humanDuration } from "@/mixins/newhelpers";
import type { ChannelTypes } from "@/twitchautomator";

const store = useStore();
const { t } = useI18n();

const props = defineProps<{
    streamer: ChannelTypes;
}>();

const basePath = computed(() => {
    return store.cfg<string>("basepath", "");
});

const webPath = computed(() => {
    if (!props.streamer) return "";
    return store.cfg<string>("basepath", "") + "/vods/" + (store.cfg("channel_folders") ? props.streamer.internalName : "");
});
</script>

<style lang="scss" scoped>
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
            color: #fff;
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
</style>
