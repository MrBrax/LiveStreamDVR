<template>
    <span class="streamer-title-tools">
        <!-- edit -->
        <router-link
            class="icon-button white"
            :to="{ name: 'SettingsChannels', params: { channel: streamer.uuid } }"
            title="Edit channel"
        >
            <span class="icon"><fa icon="pencil" /></span>
        </router-link>

        <!-- abort recording -->
        <button
            v-if="canAbortCapture"
            class="icon-button white"
            title="Abort record"
            @click="abortCapture"
        >
            <span class="icon"><fa icon="video-slash" /></span>
        </button>

        <!-- force recording -->
        <button
            v-else
            class="icon-button white"
            title="Force record"
            @click="forceRecord"
        >
            <span class="icon"><fa icon="video" /></span>
        </button>

        <!-- dump playlist -->
        <button
            class="icon-button white"
            title="Playlist record"
            @click="playlistRecord"
        >
            <span class="icon"><fa icon="play-circle" /></span>
        </button>

        <!-- download stuff -->
        <button
            class="icon-button white"
            title="Video download"
            @click="emit('showVideoDownloadMenu')"
        >
            <span class="icon"><fa icon="download" /></span>
        </button>

        <!-- run cleanup -->
        <button
            class="icon-button white"
            title="Clean up"
            @click="doChannelCleanup"
        >
            <span class="icon"><fa icon="trash" /></span>
        </button>

        <!-- refresh channel data -->
        <button
            class="icon-button white"
            title="Refresh data"
            @click="doChannelRefresh"
        >
            <span class="icon"><fa icon="sync" /></span>
        </button>

        <!-- scan vods -->
        <button
            class="icon-button white"
            title="Scan for VODs"
            @click="doScanVods"
        >
            <span class="icon"><fa icon="folder-open" /></span>
        </button>

        <!-- expand/collapse all vods -->
        <button
            class="icon-button white"
            title="Expand/collapse all vods"
            @click="emit('toggleExpandVods')"
        >
            <span class="icon"><fa :icon="!toggleAllVodsExpanded ? 'chevron-up' : 'chevron-down'" /></span>
        </button>
    </span>
</template>

<script lang="ts" setup>
import { ChannelTypes, useStore } from '@/store';
import { ApiResponse } from '@common/Api/Api';
import axios from 'axios';
import { computed } from 'vue';

const props = defineProps<{
    streamer: ChannelTypes;
    toggleAllVodsExpanded: boolean;
}>();

const emit = defineEmits<{
    (event: 'showVideoDownloadMenu'): void;
    (event: 'toggleExpandVods'): void;
}>();

const store = useStore();

const canAbortCapture = computed(() => {
    if (!props.streamer) return false;
    return props.streamer.is_capturing && store.jobList.some((job) => props.streamer && job.name.startsWith(`capture_${props.streamer.internalName}`));
});

async function abortCapture() {
    // href="{{ url_for('api_jobs_kill', { 'job': 'capture_' ~ streamer.current_vod.basename }) }}"

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
        response = await axios.post(`/api/v0/channels/${props.streamer.uuid}/force_record`);
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
        response = await axios.get(`/api/v0/channels/${props.streamer.uuid}/dump_playlist`);
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
        response = await axios.post(`/api/v0/channels/${props.streamer.uuid}/cleanup`);
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
        .post(`/api/v0/channels/${props.streamer.uuid}/refresh`)
        .then((response) => {
            const json: ApiResponse = response.data;
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
        .post(`/api/v0/channels/${props.streamer.uuid}/scan`)
        .then((response) => {
            const json: ApiResponse = response.data;
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

</script>

<style lang="scss" scoped>
.streamer-title-tools {
    .icon-button {
        margin-left: 0.3em;
    }
}
</style>