<template>
    <!-- bookmark list -->
    <div
        v-if="vod.provider == 'twitch'"
        class="video-block video-bookmarks"
        aria-label="Bookmarks"
    >
        <div
            class="video-block-header collapsible"
            aria-role="button"
            @click="isCollapsed = !isCollapsed"
        >
            <h4>
                <span class="icon">
                    <font-awesome-icon :icon="isCollapsed ? 'chevron-down' : 'chevron-up'" />
                </span>
                {{ t('vod.bookmarks') }} <span
                    class="amount"
                    :data-amount="vod.bookmarks.length"
                >({{ vod.bookmarks.length }})</span>
            </h4>
        </div>
        <transition name="blinds">
            <div
                v-if="!isCollapsed"
                class="video-block-content"
            >
                <ul
                    v-if="vod.bookmarks && vod.bookmarks.length > 0"
                    class="list-segments"
                >
                    <li
                        v-for="(bookmark, i) in vod.bookmarks"
                        :key="i"
                    >
                        <router-link :to="playerLink(bookmark)">
                            {{ humanDuration(bookmark.offset || 0) }} - {{ bookmark.name }}
                        </router-link>
                        &nbsp;
                        <button
                            class="icon-button"
                            @click="doDeleteBookmark(i)"
                        >
                            <span class="icon"><font-awesome-icon icon="xmark" /></span>
                        </button>
                    </li>
                </ul>

                <details class="details">
                    <summary>Create</summary>
                    <div class="field">
                        <label
                            class="label"
                            :for="`name.${vod.uuid}`"
                        >Name</label>
                        <input
                            :id="`name.${vod.uuid}`"
                            v-model="newBookmark.name"
                            class="input"
                            type="text"
                        >
                    </div>
                    <div
                        v-if="vod.is_finalized"
                        class="field"
                    >
                        <label
                            class="label"
                            :for="`offset.${vod.uuid}`"
                        >Offset</label>
                        <input
                            :id="`offset.${vod.uuid}`"
                            v-model="newBookmark.offset"
                            class="input"
                            type="number"
                        >
                    </div>
                    <d-button
                        size="small"
                        color="success"
                        icon="plus"
                        @click="doMakeBookmark"
                    >
                        {{ t('buttons.create') }}
                    </d-button>
                </details>
            </div>
        </transition>
    </div>
</template>

<script lang="ts" setup>
import { useStore } from '@/store';
import type { ApiResponse } from '@common/Api/Api';
import axios from 'axios';
import { humanDuration, isTwitchVOD } from "@/mixins/newhelpers";
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { VODTypes } from '@/twitchautomator';
import type { VODBookmark } from "@common/Bookmark";

const props = defineProps({
    vod: {
        type: Object as () => VODTypes,
        default: null,
        // required: true,
    },
});

const store = useStore();
const { t } = useI18n();

const isCollapsed = ref<boolean>(true);

onMounted(() => {
    if (!isTwitchVOD(props.vod)) return;
    isCollapsed.value = props.vod.bookmarks.length == 0 ? true : store.videoBlockShow.bookmarks;
});

const newBookmark = ref({
    name: "",
    offset: 0,
});

function doMakeBookmark() {
    if (!props.vod) return;
    axios.post<ApiResponse>(`/api/v0/vod/${props.vod.uuid}/bookmark`, newBookmark.value).then((response) => {
        const json = response.data;
        if (json.message) alert(json.message);
        console.log(json);
        if (props.vod) store.fetchAndUpdateVod(props.vod.uuid);
        // if (this.editVodMenu) this.editVodMenu.show = false;
    }).catch((err) => {
        console.error("form error", err.response);
        if (err.response.data && err.response.data.message) alert(err.response.data.message);
    });
}

function doDeleteBookmark(i: number) {
    if (!props.vod) return;
    axios.delete<ApiResponse>(`/api/v0/vod/${props.vod.uuid}/bookmark?index=${i}`).then((response) => {
        const json = response.data;
        if (json.message) alert(json.message);
        console.log(json);
        if (props.vod) store.fetchAndUpdateVod(props.vod.uuid);
        // if (this.editVodMenu) this.editVodMenu.show = false;
    }).catch((err) => {
        console.error("form error", err.response);
        if (err.response.data && err.response.data.message) alert(err.response.data.message);
    });
}

function playerLink(bookmark: VODBookmark) {
    if (!props.vod) return;
    return {
        name: "Editor",
        params: {
            uuid: props.vod.uuid,
        },
        query: {
            start: bookmark.offset,
        },
    };
    // return `/player/${props.vod.uuid}?bookmark=${bookmark.offset}`;
}

</script>

<style lang="scss" scoped>
.video-bookmarks {
    // background-color: var(--video-bookmarks-background-color);
    background-color: var(--video-block-background-color);
    // border-top: 1px solid #d6dbf2;
    // border-left: 1px solid #e3e3e3;
    // border-right: 1px solid #e3e3e3;
}

.details {
    margin-top: 0;
    summary {
        margin-bottom: 0.8em;
    }
}
</style>