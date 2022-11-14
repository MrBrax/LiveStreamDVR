<template>
    <!-- segment list -->
    <div
        v-if="vod.is_finalized"
        class="video-block video-segments"
        aria-label="Segments"
    >
        <div class="video-block-header">
            <h4>{{ t('vod.segments') }}</h4>
        </div>
        <div class="video-block-content">
            <ul class="list-segments">
                <li
                    v-for="(segment, i) of vod.segments"
                    :key="segment.basename"
                >
                    <a
                        :href="vod?.webpath + '/' + segment.basename"
                        target="_blank"
                        @click.prevent="store.playMedia(vod?.webpath + '/' + segment.basename)"
                    >
                        <span class="text-overflow">{{ segment.basename }}</span>
                        <template v-if="!segment.deleted && segment.filesize"> ({{ formatBytes(segment.filesize) }})</template>
                        <!-- delete -->
                    </a>
                    <button
                        v-if="!segment.deleted"
                        class="icon-button is-small delete-button"
                        title="Delete segment"
                        @click.prevent="doDeleteSegment(i)"
                    >
                        <span class="icon"><font-awesome-icon icon="xmark" /></span>
                    </button>
                    <strong
                        v-if="segment.deleted && !vod.cloud_storage"
                        class="text-is-error"
                    >&nbsp;(deleted)</strong>
                    <strong
                        v-else-if="segment.deleted && vod.cloud_storage"
                        class="text-is-error"
                    >&nbsp;<font-awesome-icon icon="cloud" /></strong> 
                    <strong
                        v-else-if="!segment.filesize"
                        class="text-is-error"
                    >&nbsp;(filesize missing)</strong>
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
    </div>
</template>

<script lang="ts" setup>
import { isTwitchVOD } from '@/mixins/newhelpers';
import { useStore } from '@/store';
import type { ApiResponse } from '@common/Api/Api';
import axios from 'axios';
import { useI18n } from 'vue-i18n';
import { formatBytes } from '@/mixins/newhelpers';
import type { VODTypes } from '@/twitchautomator';

const props = defineProps({
    vod: {
        type: Object as () => VODTypes,
        default: null,
        // required: true,
    },
});

const store = useStore();
const { t } = useI18n();

function doDeleteSegment(index = 0) {
    if (!props.vod) return;
    if (!confirm(`Do you want to delete segment ${index} of "${props.vod?.basename}"?`)) return;
    const keepEntry = confirm(`Do you want to keep the entry and mark it as cloud storage?`);
    if (isTwitchVOD(props.vod) && props.vod.twitch_vod_exists === false && !confirm(`The VOD "${props.vod?.basename}" has been deleted from twitch, are you still sure?`)) return;
    axios
        .post<ApiResponse>(`/api/v0/vod/${props.vod.uuid}/delete_segment?segment=${index}&keep_entry=${keepEntry ? "true" : "false"}`)
        .then((response) => {
            const json = response.data;
            if (json.message) alert(json.message);
            console.log(json);
            // emit("refresh");
            if (props.vod && isTwitchVOD(props.vod)) store.fetchAndUpdateStreamer(props.vod.channel_uuid);
        })
        .catch((err) => {
            console.error("form error", err.response);
            if (err.response.data && err.response.data.message) alert(err.response.data.message);
        });
}

</script>


<style lang="scss" scoped>
.video-segments {
    background-color: var(--video-segments-background-color);
    // border-top: 1px solid #d6dbf2;
    // border-left: 1px solid #e3e3e3;
    // border-right: 1px solid #e3e3e3;
}

.delete-button {
    margin-left: 0.5em;
    color: #f83333;
    &:hover {
        color: #ffd0d0;
    }
}

.list-segments {
    margin: 0.5em 0;
    padding: 0 1.5em;
}

</style>