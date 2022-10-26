<template>
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
                v-for="clip in filteredClips"
                :key="clip.basename"
            >
                <a
                    class="text-overflow"
                    :href="clipLink(clip)"
                    target="_blank"
                    @click.prevent="store.playMedia(clipLink(clip))"
                >
                    <img
                        :src="basePath + '/cache/thumbs/' + clip.thumbnail"
                        alt="Clip thumbnail"
                    >
                    {{ clip.folder + "/" + clip.basename }}<br>
                    <span class="streamer-clips-info">
                        {{ formatBytes(clip.size) }},
                        {{ formatDuration(clip.duration) }},
                        {{ clip.video_metadata.height }}p<template v-if="clip.clip_metadata?.created_at">,
                            {{ formatDate(clip.clip_metadata.created_at) }}
                        </template>
                    </span>
                </a>
            </li>
        </ul>
        <div
            v-if="streamer.clips_list.length > 5"
            class="streamer-clips-expand"
        >
            <button
                class="icon-button white"
                title="Expand/collapse all clips"
                @click="expandedClipsList = !expandedClipsList"
            >
                <span class="icon"><fa :icon="expandedClipsList ? 'chevron-up' : 'chevron-down'" /></span>
            </button>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { ChannelTypes, useStore } from "@/store";
import { LocalClip } from "@common/LocalClip";
import { computed, ref } from "vue";

const store = useStore();

const props = defineProps<{
    streamer: ChannelTypes;
}>();

const basePath = computed(() => {
    return store.cfg<string>("basepath", "");
});

const expandedClipsList = ref(false);

const filteredClips = computed(() => {
    const clips = expandedClipsList.value ? props.streamer.clips_list.slice() : props.streamer.clips_list.slice(0, 5);
    clips.sort((a: LocalClip, b: LocalClip) => {
        return new Date(b.clip_metadata?.created_at || "").getTime() - new Date(a.clip_metadata?.created_at || "").getTime();
    });
    return clips;
});

function clipLink(clip: LocalClip): string {
    const path = clip.folder + "/" + clip.basename;
    return `${store.cfg<string>("basepath", "")}/saved_clips/${path}`;
}

</script>

<style lang="scss" scoped>
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

.streamer-clips-expand {
    text-align: center;
    margin-bottom: 0.5em;
    button {
        background: #116d3c;
        color: #fff;
        width: 100%;
        padding: 0.5em;
        border: none;
        outline: none;
        cursor: pointer;
    }
}

</style>