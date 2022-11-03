<template>
    <!-- bookmark list -->
    <div
        v-if="vod.provider == 'twitch'"
        class="video-bookmarks"
    >
        <strong>{{ t('vod.bookmarks') }}</strong>
        <ul class="list-segments">
            <li
                v-for="(bookmark, i) in vod.bookmarks"
                :key="i"
            >
                {{ formatDuration(bookmark.offset || 0) }} - {{ bookmark.name }}
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
                    :for="'name.' + vod.uuid"
                >Name</label>
                <input
                    :id="'name.' + vod.uuid"
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
                    :for="'offset.' + vod.uuid"
                >Offset</label>
                <input
                    :id="'offset.' + vod.uuid"
                    v-model="newBookmark.offset"
                    class="input"
                    type="number"
                >
            </div>
            <button
                class="button is-small is-confirm"
                @click="doMakeBookmark"
            >
                <span class="icon"><font-awesome-icon icon="plus" /></span>
                <span>Create</span>
            </button>
        </details>
    </div>
</template>

<script lang="ts" setup>
import { useStore, VODTypes } from '@/store';
import { ApiResponse } from '@common/Api/Api';
import axios from 'axios';
import { formatDuration } from "@/mixins/newhelpers";
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
    vod: {
        type: Object as () => VODTypes,
        default: null,
        // required: true,
    },
});

const store = useStore();
const { t } = useI18n();

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

</script>

<style lang="scss" scoped>
.video-bookmarks {
    padding: 1em;
    background-color: var(--video-bookmarks-background-color);
    // border-top: 1px solid #d6dbf2;
    // border-left: 1px solid #e3e3e3;
    // border-right: 1px solid #e3e3e3;
}
</style>