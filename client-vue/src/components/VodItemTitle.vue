<template>
    <div
        class="video-title"
        aria-label="Video title"
        :aria-pressed="!minimized"
        tabindex="0"
        role="button"
        @click="emit('toggleMinimize')"
        @keydown.prevent.enter="emit('toggleMinimize')"
        @keydown.prevent.space="emit('toggleMinimize')"
    >
        <div class="video-title-text">
            <h3>
                <span class="icon"><font-awesome-icon icon="file-video" /></span>
                <span
                    v-if="vod.started_at"
                    class="video-date"
                    :title="formatDate(vod.started_at)"
                >{{
                    store.clientCfg('useRelativeTime') ? humanDate(vod.started_at, true) : formatDate(vod.started_at)
                }}</span>
                <span class="video-sxe">
                    {{ vod.stream_season }}x{{ vod.stream_number?.toString().padStart(2, "0") }}
                </span>
                <span class="video-filename">{{ vod.basename }}</span>
            </h3>
        </div>
        <div class="video-title-actions">
            <font-awesome-icon :icon="!minimized ? 'chevron-up' : 'chevron-down'" />
        </div>
    </div>
</template>

<script lang="ts" setup>
import { formatDate, humanDate } from "@/mixins/newhelpers";
import { useStore } from "@/store";
import type { VODTypes } from "@/twitchautomator";

const props = defineProps<{
    vod: VODTypes;
    minimized: boolean;
}>();

const emit = defineEmits<{
    (event: "toggleMinimize"): void;
}>();

const store = useStore();
// const { t } = useI18n();

</script>

<style lang="scss" scoped>

.video-title {
    padding: 10px;
    $bg-color: #2b61d6;
    background: $bg-color;
    color: #fff;

    // good idea?
    position: sticky;
    top: 50px;
    z-index: 1;

    display: flex;

    word-break: break-all;

    cursor: pointer;

    &:hover {
        background-color: lighten($bg-color, 5%);
    }

    .icon {
        margin-right: 0.3em;
    }

    h3 {
        margin: 0;
        padding: 0;
        // text-shadow: 0 2px 0 #1e4599;
        // text-shadow: 0 2px 0 rgba(0, 0, 0, 0.2);
        color: #fff;
    }

    .video-title-text {
        flex-grow: 1;
    }

    .video-title-actions {
        display: flex;
        // center horizontal and vertical
        justify-content: center;
        align-items: center;
    }
}

.video-sxe {
    font-family: "Roboto Condensed";
    color: rgba(255, 255, 255, 0.5);

    &:before {
        content: " · ";
    }
}

.video-filename {
    font-family: "Roboto Condensed";
    color: rgba(255, 255, 255, 0.5);

    &:before {
        content: " · ";
    }
}

</style>