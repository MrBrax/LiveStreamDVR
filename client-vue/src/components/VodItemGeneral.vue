<template>
    <!-- description -->
    <div class="video-block video-description">
        <div class="video-block-header collapsible" aria-role="button" @click="isCollapsed = !isCollapsed">
            <h4>
                <span class="icon">
                    <font-awesome-icon :icon="isCollapsed ? 'chevron-down' : 'chevron-up'" />
                </span>
                General
            </h4>
        </div>
        <transition name="blinds">
            <div v-if="!isCollapsed" class="video-block-content">
                <!-- box art -->
                <div v-if="vod && vod.provider == 'twitch' && vod.getUniqueGames()" class="boxart-carousel is-small">
                    <div v-for="game in vod.getUniqueGames()" :key="game.id" class="boxart-item">
                        <img
                            v-if="game.image_url"
                            :title="game.name"
                            :alt="game.name"
                            :src="game.image_url"
                            loading="lazy"
                            :class="{ 'is-spoiler': store.clientCfg('hideChapterTitlesAndGames') }"
                        />
                        <span v-else>{{ game.name }}</span>
                    </div>
                </div>

                <!-- comment -->
                <div v-if="vod.comment" class="video-comment">
                    <p>{{ vod.comment }}</p>
                </div>
                <div v-else>
                    <p>
                        <a href="#" @click.prevent="emit('showModal', 'edit')">
                            <font-awesome-icon icon="comment-dots" />
                            {{ t("vod.add_comment") }}
                        </a>
                    </p>
                </div>

                <vod-item-video-info :vod="vod" :show-advanced="showAdvanced" />

                <div v-if="vod.is_capturing" class="info-columns">
                    <div class="info-column">
                        <h4>Recording</h4>
                        <ul class="video-info">
                            <li v-if="vod.started_at"><strong>Went live:</strong> {{ formatDate(vod.started_at) }}</li>
                            <li v-if="vod.created_at"><strong>Created:</strong> {{ formatDate(vod.created_at) }}</li>
                            <li v-if="vod.capture_started && vod.started_at">
                                <strong>Capture launched:</strong> {{ formatDate(vod.capture_started) }} ({{
                                    humanDuration((vod.capture_started.getTime() - vod.started_at.getTime()) / 1000)
                                }}
                                missing)
                            </li>
                            <li v-if="vod.capture_started2"><strong>Wrote file:</strong> {{ formatDate(vod.capture_started2) }}</li>
                            <li>
                                <strong>Current duration:</strong>
                                <duration-display v-if="vod.started_at" :start-date="vod.started_at.toISOString()" output-style="human" />
                            </li>
                            <li v-if="vod.provider == 'twitch'"><strong>Resolution:</strong> {{ vod.stream_resolution || "Unknown" }}</li>
                            <li v-if="vod.stream_pauses">
                                <strong>Stream pauses:</strong> {{ vod.stream_pauses.length }} ({{ humanDuration(vod.totalPausedTime / 1000) }})
                            </li>
                            <li v-if="vod.provider == 'twitch'">
                                <strong>Watch live:</strong> <a :href="`https://twitch.tv/${vod.streamer_login}`" rel="noreferrer" target="_blank">Twitch</a>
                            </li>
                            <li>
                                <strong>Rewind:</strong>
                                <a
                                    :href="predictedFirstSegmentUrl"
                                    rel="noreferrer"
                                    target="_blank"
                                    @click.prevent="store.playMedia(predictedFirstSegmentUrl)"
                                    >{{ vod.basename }}</a
                                >
                                (copy link and paste into desktop video player)
                            </li>
                        </ul>
                        <!--<button class="button is-small is-danger" @click="unbreak">Unbreak</button>-->
                    </div>
                </div>
            </div>
        </transition>
    </div>
</template>

<script lang="ts" setup>
import { useStore } from "@/store";
import { useI18n } from "vue-i18n";
import VodItemVideoInfo from "./VodItemVideoInfo.vue";
import DurationDisplay from "@/components/DurationDisplay.vue";
import { formatDate, humanDuration } from "@/mixins/newhelpers";
import type { VODTypes } from "@/twitchautomator";
import { computed, onMounted, ref } from "vue";

const store = useStore();
const { t } = useI18n();

const props = defineProps({
    vod: {
        type: Object as () => VODTypes,
        default: null,
        // required: true,
    },
    showAdvanced: {
        type: Boolean,
        default: false,
    },
});

const isCollapsed = ref<boolean>(true);

onMounted(() => {
    isCollapsed.value = store.videoBlockShow.general;
});

const emit = defineEmits<{
    (event: "showModal", modal: string): void;
}>();

const predictedFirstSegmentUrl = computed(() => {
    if (!props.vod) return "";
    return `${props.vod.webpath}/${props.vod.basename}.ts`;
});
</script>

<style lang="scss" scoped>
.video-description {
    // padding: 10px;
    background: var(--video-description-background-color);
    // border-left: 1px solid #e3e3e3;
    // border-right: 1px solid #e3e3e3;
}
.video-comment {
    padding: 1em;
    background-color: var(--video-comment-background-color);
    border-radius: 1em;
    width: max-content;
    p {
        margin: 0;
        padding: 0;
        white-space: pre;
    }

    position: relative;

    box-shadow: 0 5px 10px rgba(0, 0, 0, 0.2);

    margin: 1em 0 1.5em 0;

    // comment bubble tip
    &:before {
        content: "";
        position: absolute;
        bottom: -10px;
        left: 15px;
        width: 0;
        height: 0;
        border-style: solid;
        border-width: 10px 10px 0 10px;
        border-color: var(--video-comment-background-color) transparent transparent transparent;
    }
}
</style>
