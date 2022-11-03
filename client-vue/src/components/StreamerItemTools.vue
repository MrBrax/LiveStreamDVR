<template>
    <span class="streamer-title-tools">
        <!-- edit -->
        <router-link
            class="icon-button white"
            :to="{ name: 'SettingsChannels', params: { channel: streamer.uuid } }"
            :title="t('streamer.tools.edit-channel')"
        >
            <span class="icon"><font-awesome-icon icon="pencil" /></span>
        </router-link>

        <!-- abort recording -->
        <button
            v-if="canAbortCapture"
            class="icon-button white"
            :title="t('streamer.tools.abort-record')"
            @click="abortCapture"
        >
            <span class="icon"><font-awesome-icon icon="video-slash" /></span>
        </button>

        <!-- force recording -->
        <button
            v-else
            class="icon-button white"
            :title="t('streamer.tools.force-record')"
            @click="forceRecord"
        >
            <span class="icon"><font-awesome-icon icon="video" /></span>
        </button>

        <!-- dump playlist -->
        <!--
        <button
            class="icon-button white"
            :title="Playlist record"
            @click="playlistRecord"
        >
            <span class="icon"><font-awesome-icon icon="play-circle" /></span>
        </button>
        -->

        <!-- run cleanup -->
        <button
            class="icon-button white"
            :title="t('streamer.tools.clean-up')"
            @click="doChannelCleanup"
        >
            <span class="icon"><font-awesome-icon icon="trash" /></span>
        </button>

        <!-- expand/collapse all vods -->
        <button
            class="icon-button white"
            :title="t('streamer.tools.expand-collapse-all-vods')"
            @click="emit('toggleExpandVods')"
        >
            <span class="icon"><font-awesome-icon :icon="!toggleAllVodsExpanded ? 'chevron-up' : 'chevron-down'" /></span>
        </button>

        <!-- open more menu -->
        <button
            class="icon-button white"
            :title="t('streamer.tools.more')"
            @click="openMoreMenu"
        >
            <span class="icon"><font-awesome-icon icon="ellipsis-h" /></span>
        </button>
    </span>
    <Teleport to="body">
        <Transition name="blinds">
            <div
                v-show="showMoreMenu"
                ref="moreMenu"
                class="expand-menu"
                @mouseout="closeMoreMenu"
            >
                <div class="expand-menu-header">
                    {{ streamer.displayName }}
                </div>

                <!-- refresh channel data -->
                <button
                    class="expand-menu-button white"
                    :title="t('streamer.tools.refresh-data')"
                    @click="doChannelRefresh"
                >
                    <span class="icon"><font-awesome-icon icon="sync" /></span>
                    <span class="text">{{ t('streamer.tools.refresh-data') }}</span>
                </button>

                <!-- download videos -->
                <button
                    class="expand-menu-button white"
                    :title="t('streamer.tools.video-download')"
                    @click="emit('showVideoDownloadMenu')"
                >
                    <span class="icon"><font-awesome-icon icon="download" /></span>
                    <span>{{ t('streamer.tools.video-download') }}</span>
                </button>

                <!-- download clips -->
                <button
                    class="expand-menu-button white"
                    :title="t('streamer.tools.clip-download')"
                    @click="emit('showClipDownloadMenu')"
                >
                    <span class="icon"><font-awesome-icon icon="download" /></span>
                    <span>{{ t('streamer.tools.clip-download') }}</span>
                </button>

                <!-- scan vods -->
                <button
                    class="expand-menu-button white"
                    :title="t('streamer.tools.scan-for-vods')"
                    @click="doScanVods"
                >
                    <span class="icon"><font-awesome-icon icon="folder-open" /></span>
                    <span>{{ t('streamer.tools.scan-for-vods') }}</span>
                </button>

                <!-- scan local videos -->
                <button
                    class="expand-menu-button white"
                    :title="t('streamer.tools.scan-for-local-videos')"
                    @click="doScanLocalVideos"
                >
                    <span class="icon"><font-awesome-icon icon="folder-open" /></span>
                    <span>{{ t('streamer.tools.scan-for-local-videos') }}</span>
                </button>

                <!-- export vods -->
                <button
                    class="expand-menu-button white"
                    :title="t('streamer.tools.export-vods')"
                    @click="doExportVods"
                >
                    <span class="icon"><font-awesome-icon icon="upload" /></span>
                    <span>{{ t('streamer.tools.export-vods') }}</span>
                </button>
            </div>
        </Transition>
    </Teleport>
</template>

<script lang="ts" setup>
import { ChannelTypes, useStore, VODTypes } from '@/store';
import { ApiResponse } from '@common/Api/Api';
import axios from 'axios';
import { computed, ref } from 'vue';

import { library } from "@fortawesome/fontawesome-svg-core";
import { faUpload, faEllipsisH } from "@fortawesome/free-solid-svg-icons";
import { formatBytes } from '@/mixins/newhelpers';
import { useI18n } from 'vue-i18n';
library.add(faUpload, faEllipsisH);

const props = defineProps<{
    streamer: ChannelTypes;
    toggleAllVodsExpanded: boolean;
}>();

const emit = defineEmits<{
    (event: 'showVideoDownloadMenu'): void;
    (event: 'showClipDownloadMenu'): void;
    (event: 'toggleExpandVods'): void;
}>();

const store = useStore();
const { t } = useI18n();

const showMoreMenu = ref(false);
const moreMenu = ref<HTMLElement | null>(null);

const canAbortCapture = computed(() => {
    if (!props.streamer) return false;
    return props.streamer.is_capturing && store.jobList.some((job) => props.streamer && job.name.startsWith(`capture_${props.streamer.internalName}`));
});

function openMoreMenu(event: MouseEvent) {
    event.stopPropagation();
    showMoreMenu.value = !showMoreMenu.value;
    if (moreMenu.value) {
        const x = event.pageX - moreMenu.value.offsetWidth - 16;
        const y = event.pageY - moreMenu.value.offsetHeight - 16;
        moreMenu.value.style.setProperty("--expand-menu-left", `${x}px`);
        moreMenu.value.style.setProperty("--expand-menu-top", `${y}px`);
        document.addEventListener("click", closeMoreMenu);
    } else {
        document.removeEventListener("click", closeMoreMenu);
    }
}

function closeMoreMenu(event: MouseEvent) {
    if (moreMenu.value && !moreMenu.value.contains(event.relatedTarget as Node)) {
        showMoreMenu.value = false;
        document.removeEventListener("click", closeMoreMenu);
        event.stopPropagation();
    }
    // showMoreMenu.value = false;
}

async function abortCapture() {
    showMoreMenu.value = false;
    if (!props.streamer || !props.streamer.current_vod) return;
    if (!confirm("Abort record is unstable. Continue?")) return;

    let response;

    try {
        response = await axios.delete(`/api/v0/jobs/capture_${props.streamer.internalName}_*`);
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error("abortCapture error", error.response);
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

    console.log("Killed", data);
}

async function forceRecord() {
    if (!props.streamer) return;
    if (!confirm("Force record is unstable. Continue?")) return;

    let response;

    try {
        response = await axios.post<ApiResponse>(`/api/v0/channels/${props.streamer.uuid}/force_record`);
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error("forceRecord error", error.response);
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

    console.log("Recorded", data);
}

async function playlistRecord() {
    // href="{{ url_for('api_channel_dump_playlist', { 'username': streamer.display_name }) }}"

    if (!props.streamer || !props.streamer.current_vod) return;

    let response;

    try {
        response = await axios.get<ApiResponse>(`/api/v0/channels/${props.streamer.uuid}/dump_playlist`);
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error("abortCapture error", error.response);
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

    console.log("Killed", data);
}

async function doChannelCleanup() {
    if (!props.streamer) return;

    if (!confirm("Do you want to clean up vods that don't meet your criteria? There is no undo.")) return;

    let response;

    try {
        response = await axios.post<ApiResponse>(`/api/v0/channels/${props.streamer.uuid}/cleanup`);
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error("doChannelCleanup error", error.response);
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

    console.log("Cleaned", data);
}

async function doChannelRefresh() {
    if (!props.streamer) return;
    axios
        .post<ApiResponse>(`/api/v0/channels/${props.streamer.uuid}/refresh`)
        .then((response) => {
            const json = response.data;
            if (json.message) alert(json.message);
            console.log(json);
            store.fetchStreamerList();
        })
        .catch((error) => {
            if (axios.isAxiosError(error)) {
                console.error("doChannelRefresh error", error.response);
                if (error.response && error.response.data && error.response.data.message) {
                    alert(error.response.data.message);
                }
            }
        });
}

async function doScanVods() {
    if (!props.streamer) return;
    if (!confirm("Do you want to rescan for VODs? It might not find everything.")) return;
    axios
        .post<ApiResponse>(`/api/v0/channels/${props.streamer.uuid}/scan`)
        .then((response) => {
            const json = response.data;
            if (json.message) alert(json.message);
            console.log(json);
            store.fetchStreamerList();
        })
        .catch((error) => {
            if (axios.isAxiosError(error)) {
                console.error("doScanVods error", error.response);
                if (error.response && error.response.data && error.response.data.message) {
                    alert(error.response.data.message);
                }
            }
        });
}

async function doScanLocalVideos() {
    if (!props.streamer) return;
    if (!confirm("Do you want to rescan for local videos?")) return;
    axios
        .post<ApiResponse>(`/api/v0/channels/${props.streamer.uuid}/scanlocalvideos`)
        .then((response) => {
            const json = response.data;
            if (json.message) alert(json.message);
            console.log(json);
            store.fetchStreamerList();
        })
        .catch((error) => {
            if (axios.isAxiosError(error)) {
                console.error("doScanLocalVideos error", error.response);
                if (error.response && error.response.data && error.response.data.message) {
                    alert(error.response.data.message);
                }
            }
        });
}

function doExportVods() {
    if (!props.streamer) return;
    if (!confirm("Do you want to export ALL the VODs? This is a lot of data.")) return;
    if (!confirm("Are you sure?")) return;
    const totalSize: number = (props.streamer.vods_list as any).reduce((acc: number, vod: VODTypes) => acc + vod.total_size, 0); // what an ugly hack
    if (!confirm(`This might upload ${formatBytes(totalSize)} of data. Are you really sure?`)) return;
    if (!confirm("Don't say I didn't warn you.")) return;
    const force = prompt("Do you want to force export? (y/n)", "n");
    axios
        .post<ApiResponse>(`/api/v0/channels/${props.streamer.uuid}/exportallvods${force === "y" ? "?force=true" : ""}`)
        .then((response) => {
            const json = response.data;
            if (json.message) alert(json.message);
            console.log(json);
            store.fetchStreamerList();
        })
        .catch((error) => {
            if (axios.isAxiosError(error)) {
                console.error("doExportVods error", error.response);
                if (error.response && error.response.data && error.response.data.message) {
                    alert(error.response.data.message);
                }
            }
        });
}

</script>

<style lang="scss" scoped>
.streamer-title-tools {
    .icon-button {
        margin-left: 0.3em;
    }
}
.expand-menu {
    position: absolute;
    background-color: #222;
    border: 1px solid #000;
    color: #fff;
    left: var(--expand-menu-left);
    top: var(--expand-menu-top);
    width: 200px;
    z-index: 99;
    overflow: hidden;
    box-shadow: 0 5px 10px 0 rgba(0, 0, 0, 0.5);
    border-radius: 5px;

    &::before {
        content: "";
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: #000;
        opacity: 0.2;
        z-index: -1;
    }
}
.expand-menu-button {
    display: block;
    width: 100%;
    text-align: left;
    padding: 0.5em;
    background: transparent;
    color: #fff;
    border: none;
    cursor: pointer;
    .icon {
        transition: margin-right 0.1s ease-in-out;
        margin-right: 0.5em;
    }
    &:not(:last-child) {
        margin-bottom: 0.2em;
    }
    &:hover {
        background-color: #333;
        color: #ff0;
        .icon {
            margin-right: 0.6em;
        }
    }
}

.expand-menu-header {
    display: none;
}

@media screen and (orientation: portrait) {
    .expand-menu {
        position: fixed;
        left: 1em;
        right: 1em;
        bottom: 4em;
        top: unset;
        width: auto;
        // width: 100%;
        // height: 100%;
        border-radius: 0;
    }
    .expand-menu-button {
        padding: 1em;
    }
    .expand-menu-header {
        display: block;
        padding: 1em;
        background-color: #252525;
        color: #fff;
        border-bottom: 1px solid #000;
        font-weight: bold;
    }
}
</style>