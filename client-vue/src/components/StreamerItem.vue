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
                    &middot;
                    <span class="streamer-subbed-status">
                        <span v-if="streamer.api_getSubscriptionStatus">Subscribed</span>
                        <span class="is-error" title="Could just be that subscriptions were made before this feature was implemented." v-else>
                            One or more subscriptions missing
                        </span></span
                    ><!-- sub status -->
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

                        <button class="icon-button" @click="videoDownloadMenu ? (videoDownloadMenu.show = true) : ''" title="Video download">
                            <span class="icon"><fa icon="download"></fa></span>
                        </button>
                    </span>
                </span>
            </div>
        </div>

        <div v-if="streamer.vods_list.length == 0" class="notice">None</div>

        <div v-else>
            <vod-item v-for="vod in streamer.vods_list" :key="vod.basename" v-bind:vod="vod" @refresh="refresh" />
        </div>
        <modal-box ref="videoDownloadMenu" title="Video download">
            <div class="video-download-menu">
                <p>
                    Videos downloaded with this tool will be cleaned up the same way as captured vods do when a stream is finished.<br />
                    They are treated the same way as captured vods in its entirety.<br />
                    <span v-if="averageVodBitrate">Average bitrate: {{ averageVodBitrate / 1000 }} kbps</span>
                </p>
                <button class="button is-confirm" @click="fetchTwitchVods">
                    <span class="icon"><fa icon="download"></fa></span> Fetch vod list
                </button>
                <hr />
                <div class="video-download-menu-item" v-for="vod in twitchVods" :key="vod.id">
                    <h2>
                        <a :href="vod.url" rel="nofollow" target="_blank">{{ vod.created_at }}</a> ({{ vod.type }})
                    </h2>
                    <img :src="imageUrl(vod.thumbnail_url, 320, 240)" /><br />
                    <p>{{ vod.title }}</p>
                    <ul>
                        <li>{{ vod.duration }} ({{ parseTwitchDuration(vod.duration) }})</li>
                        <li>{{ formatNumber(vod.view_count, 0) }} views</li>
                        <li v-if="vod.muted_segments && vod.muted_segments.length > 0">
                            <span class="is-error">Muted segments: {{ vod.muted_segments.length }}</span>
                        </li>
                        <li>Estimated size: {{ formatBytes(((averageVodBitrate || 6000000) / 10) * parseTwitchDuration(vod.duration)) }}</li>
                    </ul>
                    <br />
                    <button class="button is-small is-confirm" @click="downloadVideo(vod.id.toString())">
                        <span class="icon"><fa icon="download"></fa></span> Download
                    </button>
                </div>
            </div>
        </modal-box>
    </div>
    <div v-else>Invalid streamer</div>
</template>

<script lang="ts">
// import { TwitchAPI.Video } from "@/twitchapi.d";
import { defineComponent, ref } from "vue";
import VodItem from "@/components/VodItem.vue";
import ModalBox from "@/components/ModalBox.vue";

import { library } from "@fortawesome/fontawesome-svg-core";
import { faVideo, faPlayCircle, faVideoSlash, faDownload } from "@fortawesome/free-solid-svg-icons";
// import { TwitchAPI } from "@/twitchapi";
import { Video } from "@common/TwitchAPI/Video";
import type { ApiChannel } from "@common/Api/Client";
library.add(faVideo, faPlayCircle, faVideoSlash, faDownload);

export default defineComponent({
    name: "StreamerItem",
    emits: ["refresh"],
    props: {
        streamer: Object as () => ApiChannel,
    },
    data: () => ({
        twitchVods: [] as Video[],
    }),
    setup() {
        const videoDownloadMenu = ref<InstanceType<typeof ModalBox>>();
        return { videoDownloadMenu };
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
        async fetchTwitchVods() {
            if (!this.streamer) return;
            let response;

            try {
                response = await this.$http.get(`/api/v0/twitchapi/videos/${this.streamer.login}`);
            } catch (error) {
                if (this.$http.isAxiosError(error)) {
                    console.error("fetchTwitchVods error", error.response);
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

            console.log("Fetched", data);
            this.twitchVods = data.data;
        },
        async downloadVideo(id: string) {
            if (!this.streamer) return;

            let response;

            try {
                response = await this.$http.get(`/api/v0/channels/${this.streamer.login}/download/${id}`);
            } catch (error) {
                if (this.$http.isAxiosError(error)) {
                    console.error("downloadVideo error", error.response);
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

            console.log("Downloaded", data);
        },
        imageUrl(url: string, width: number, height: number) {
            return url.replace(/%\{width\}/g, width.toString()).replace(/%\{height\}/g, height.toString());
        },
    },
    computed: {
        quality(): string | undefined {
            if (!this.streamer || !this.streamer.quality) return "";
            return this.streamer.quality.join(", ");
        },
        averageVodBitrate(): number | undefined {
            if (!this.streamer) return;
            const vods = this.streamer.vods_list;
            const total = vods.reduce((acc, vod) => {
                if (!vod.video_metadata_public) return acc;
                return acc + parseInt(vod.video_metadata_public.general.OverallBitRate);
            }, 0);
            return total / vods.length;
        },
    },
    components: {
        VodItem,
        ModalBox,
    },
});
</script>

<style lang="scss" scoped>
.video-download-menu-item {
    background-color: rgba(0, 0, 0, 0.2);
    padding: 1em;
    &:not(:last-child) {
        margin-bottom: 1em;
    }
}
</style>
