<template>
    <!-- segment list -->
    <div
        v-if="vod.is_finalized"
        class="video-segments"
    >
        <strong>{{ $t('vod.segments') }}</strong>
        <ul class="list-segments">
            <li
                v-for="segment in vod.segments"
                :key="segment.basename"
            >
                <a
                    :href="vod?.webpath + '/' + segment.basename"
                    target="_blank"
                    @click.prevent="store.playMedia(vod?.webpath + '/' + segment.basename)"
                >
                    <span class="text-overflow">{{ segment.basename }}</span>
                    <span v-if="!segment.deleted && segment.filesize"> ({{ formatBytes(segment.filesize) }}) </span>
                </a>
                <span v-if="segment.deleted && !vod.cloud_storage">
                    <strong class="text-is-error">&nbsp;(deleted)</strong>
                </span>
                <span v-else-if="segment.deleted && vod.cloud_storage">
                    <strong class="text-is-error">&nbsp;<fa icon="cloud" /></strong> 
                </span>
                <span v-else-if="!segment.filesize">
                    <strong class="text-is-error">&nbsp;(filesize missing)</strong>
                </span>
            </li>

            <li v-if="vod.is_vod_downloaded">
                <a
                    :href="vod.webpath + '/' + vod.basename + '_vod.mp4'"
                    target="_blank"
                    @click.prevent="store.playMedia(vod?.webpath + '/' + vod?.basename + '_vod.mp4')"
                >Downloaded VOD</a>
            </li>

            <template v-if="vod.is_chat_rendered">
                <li>
                    <a
                        :href="vod.webpath + '/' + vod?.basename + '_chat.mp4'"
                        target="_blank"
                    >Rendered chat</a>
                </li>
                <li>
                    <a
                        :href="vod.webpath + '/' + vod?.basename + '_chat_mask.mp4'"
                        target="_blank"
                    >Rendered chat mask</a>
                </li>
            </template>

            <li v-if="vod.is_chat_burned">
                <a
                    :href="vod?.webpath + '/' + vod?.basename + '_burned.mp4'"
                    target="_blank"
                >Burned chat</a>
            </li>
        </ul>
        <span v-if="vod.segments.length === 0">
            <strong class="text-is-error">No segments found</strong>
        </span>
    </div>
</template>

<script lang="ts" setup>
import { useStore, VODTypes } from '@/store';

const props = defineProps({
    vod: {
        type: Object as () => VODTypes,
        default: null,
        // required: true,
    },
});

const store = useStore();

</script>


<style lang="scss" scoped>
.video-segments {
    padding: 1em;
    background-color: var(--video-segments-background-color);
    // border-top: 1px solid #d6dbf2;
    // border-left: 1px solid #e3e3e3;
    // border-right: 1px solid #e3e3e3;
}
</style>