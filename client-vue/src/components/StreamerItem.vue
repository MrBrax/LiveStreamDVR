<template>
    <div class="streamer-box" v-if="streamer" :id="'streamer_' + streamer.login">
        <div :class="{ 'streamer-title': true, 'is-live': streamer.is_live }">
            <div class="streamer-title-avatar" :style="'background-image: url(' + streamer.profile_image_url + ')'"></div>
            <div class="streamer-title-text">
                <h2>
                    <a :href="'https://twitch.tv/' + streamer.login" rel="noreferrer" target="_blank">
                        {{ streamer.display_name }}
                        <template v-if="streamer.login.toLowerCase() != streamer.display_name.toLowerCase()"> ({{ streamer.login }})</template>
                    </a>
                    <span v-if="streamer.is_live" class="streamer-live">live</span>
                </h2>
                <span class="streamer-title-subtitle">
                    <span class="streamer-vods-quality help" title="Quality">{{ quality }}</span
                    ><!-- quality -->
                    &middot;
                    <span class="streamer-vods-amount" title="Total vod amount">{{ streamer.vods_list.length }} vods</span
                    ><!-- vods -->
                    &middot;
                    <span class="streamer-vods-size" title="Total vod size">{{ formatBytes(streamer?.vods_size) }}</span
                    ><!-- total size -->
                    &middot;<span class="streamer-subbed-status">
                        <span v-if="streamer.api_getSubscriptionStatus">Subscribed</span>
                        <span class="is-error" v-else>One or more subscriptions missing</span>
                    </span>
                    <span class="streamer-title-tools">
                        <span v-if="streamer.is_live">
                            &middot;
                            <!-- abort recording -->
                            <button class="icon-button" @click="abortCapture" title="Abort record">
                                <span class="icon"><fa icon="video-slash"></fa></span>
                            </button>
                        </span>

                        <span v-else>
                            &middot;
                            <!-- force recording -->
                            <button class="icon-button" @click="forceRecord" title="Force record">
                                <span class="icon"><fa icon="video"></fa></span>
                            </button>
                        </span>

                        <!-- dump playlist -->
                        <button class="icon-button" @click="playlistRecord" title="Playlist record">
                            <span class="icon"><fa icon="play-circle"></fa></span>
                        </button>
                    </span>
                </span>
            </div>
        </div>

        <div v-if="streamer.vods_list.length == 0" class="notice">None</div>

        <div v-else>
            <vod-item v-for="vod in streamer.vods_list" :key="vod.basename" v-bind:vod="vod" @refresh="refresh" />
        </div>
    </div>
    <div v-else>Invalid streamer</div>
</template>

<script lang="ts">
import type { ApiChannel } from "@/twitchautomator.d";
import { defineComponent } from "vue";
import VodItem from "@/components/VodItem.vue";
// import { AxiosError } from "axios";

import { library } from "@fortawesome/fontawesome-svg-core";
import { faVideo, faPlayCircle, faVideoSlash } from "@fortawesome/free-solid-svg-icons";
library.add(faVideo, faPlayCircle, faVideoSlash);

export default defineComponent({
    name: "StreamerItem",
    emits: ["refresh"],
    props: {
        streamer: Object as () => ApiChannel,
    },
    methods: {
        refresh() {
            this.$emit("refresh");
        },
        async abortCapture() {
            // href="{{ url_for('api_jobs_kill', { 'job': 'capture_' ~ streamer.current_vod.basename }) }}"

            if (!this.streamer || !this.streamer.current_vod) return;

            if (!confirm("Abort record is unstable. Continue?")) return;

            let response;

            try {
                response = await this.$http.delete(`/api/v0/jobs/capture_${this.streamer.current_vod.basename}`);
            } catch (error) {
                if (this.$http.isAxiosError(error)) {
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
        },
        async forceRecord() {
            if (!confirm("Force record is unstable. Continue?")) return;

            let response;

            try {
                response = await this.$http.get(`/api/v0/channels/${this.streamer?.login}/force_record`);
            } catch (error) {
                if (this.$http.isAxiosError(error)) {
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
        },
        async playlistRecord() {
            // href="{{ url_for('api_channel_dump_playlist', { 'username': streamer.display_name }) }}"

            if (!this.streamer || !this.streamer.current_vod) return;

            let response;

            try {
                response = await this.$http.get(`/api/v0/channels/${this.streamer.login}/dump_playlist`);
            } catch (error) {
                if (this.$http.isAxiosError(error)) {
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
        },
    },
    computed: {
        quality(): string | undefined {
            return this.streamer?.quality.join(", ");
        },
    },
    components: {
        VodItem,
    },
});
</script>
