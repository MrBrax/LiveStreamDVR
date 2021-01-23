<template>
    <div class="streamer-box" v-if="streamer" :id="'streamer_' + streamer.display_name">
        <div :class="{ 'streamer-title': true, 'is-live': streamer.is_live }">
            <div class="streamer-title-avatar" :style="'background-image: url(' + streamer.profile_image_url + ')'"></div>
            <div class="streamer-title-text">
                <h2>
                    <a :href="'https://twitch.tv/' + streamer.display_name" rel="noreferrer" target="_blank">
                        {{ streamer.display_name }}
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
                    <span class="streamer-vods-size" title="Total vod size">{{ formatBytes(this.streamer?.vods_size) }}</span
                    ><!-- total size -->
                    &middot;
                    <span class="streamer-subbed-status" title="Subscription expiration">
                        <span v-if="streamer.subbed_at && streamer.expires_at">{{ formatDate(this.streamer?.expires_at.date) }}</span>
                        <span v-else>Not subbed</span>
                    </span>
                    <span class="streamer-title-tools">
                        <span v-if="streamer.is_live">
                            &middot;
                            <a @click="abortCapture" title="Abort record"><span class="icon"><fa icon="video-slash"></fa></span></a><!-- abort recording -->
                        </span>
                        <span v-else>
                            &middot;
                            <a @click="forceRecord" title="Force record"><span class="icon"><fa icon="video"></fa></span></a><!-- force recording -->
                        </span>
                        <a @click="playlistRecord" title="Playlist record"><span class="icon"><fa icon="play-circle"></fa></span></a><!-- dump playlist -->
                    </span>
                </span>
            </div>
        </div>

        <div v-if="streamer.vods_list.length == 0" class="notice">None</div>

        <div v-else>
            <vod v-for="vod in streamer.vods_list" :key="vod.basename" v-bind:vod="vod" />
        </div>
    </div>
    <div v-else>Invalid streamer</div>
</template>

<script lang="ts">
import type { ApiStreamer } from "@/twitchautomator.d";
import { defineComponent } from "vue";
import Vod from "@/components/Vod.vue";
// import { AxiosError } from "axios";

import { library } from "@fortawesome/fontawesome-svg-core";
import { faVideo, faPlayCircle, faVideoSlash } from "@fortawesome/free-solid-svg-icons";
library.add(faVideo, faPlayCircle, faVideoSlash);

export default defineComponent({
    name: "Streamer",
    props: {
        streamer: Object as () => ApiStreamer,
    },
    methods: {
        async abortCapture() {
            // href="{{ url_for('api_jobs_kill', { 'job': 'capture_' ~ streamer.current_vod.basename }) }}"

            if (!this.streamer || !this.streamer.current_vod) return;

            let response;

            try {
                response = await this.$http.get(`/api/v0/jobs/kill/${this.streamer.current_vod.basename}`);
            } catch (error) {
                console.error("abortCapture error", error.response);
                if (error.response.data && error.response.data.message) {
                    alert(error.response.data.message);
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
            let response;

            try {
                response = await this.$http.get(`/api/v0/channel/${this.streamer?.display_name}/force_record`);
            } catch (error) {
                console.error("forceRecord error", error.response);
                if (error.response.data && error.response.data.message) {
                    alert(error.response.data.message);
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
                response = await this.$http.get(`/api/v0/channel/${this.streamer.display_name}/dump_playlist`);
            } catch (error) {
                console.error("abortCapture error", error.response);
                if (error.response.data && error.response.data.message) {
                    alert(error.response.data.message);
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
        Vod,
    },
});
</script>
