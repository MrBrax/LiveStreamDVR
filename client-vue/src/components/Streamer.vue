<template>
    <div
        class="streamer-box"
        :data-streamer="streamer.display_name"
        :id="'streamer_' + streamer.display_name"
    >
        <div :class="{ 'streamer-title': true, 'is-live': streamer.is_live }">
            <div
                class="streamer-title-avatar"
                :style="
                    'background-image: url(' + streamer.profile_image_url + ')'
                "
            ></div>
            <div class="streamer-title-text">
                <h2>
                    <a
                        :href="'https://twitch.tv/' + streamer.display_name"
                        rel="noreferrer"
                        target="_blank"
                    >
                        {{ streamer.display_name }}
                    </a>
                    <span v-if="streamer.is_live" class="live">live</span>
                </h2>
                <span class="small">
                    <span class="streamer-vods-quality help" title="Quality">{{
                        quality
                    }}</span
                    ><!-- quality -->
                    &middot;
                    <span class="streamer-vods-amount" title="Total vod amount"
                        >{{ vodAmount }} vods</span
                    ><!-- vods -->
                    &middot;
                    <span class="streamer-vods-size" title="Total vod size">{{
                        formatBytes(vodSize)
                    }}</span
                    ><!-- total size -->
                    &middot;
                    <span
                        class="streamer-subbed-status"
                        title="Subscription expiration"
                    >
                        <span
                            v-if="streamer.subbed_at && streamer.expires_at"
                            >{{ subExpiresAt }}</span
                        >
                        <span v-else>Not subbed</span>
                    </span>
                    <span v-if="streamer.is_live">
                        &middot;
                        <a
                            href="{{ url_for('api_jobs_kill', { 'job': 'capture_' ~ streamer.current_vod.basename }) }}"
                            title="Abort record"
                            ><span class="icon"
                                ><i class="fa fa-video-slash"></i></span></a
                        ><!-- abort recording -->
                    </span>
                    <span v-else>
                        &middot;
                        <a
                            href="{{ url_for('api_channel_force_record', { 'username': streamer.display_name }) }}"
                            title="Force record"
                            ><span class="icon"
                                ><i class="fa fa-video"></i></span></a
                        ><!-- force recording -->
                    </span>
                    <a
                        href="{{ url_for('api_channel_dump_playlist', { 'username': streamer.display_name }) }}"
                        title="Playlist record"
                        ><span class="icon"
                            ><i class="fa fa-play-circle"></i></span></a
                    ><!-- dump playlist -->
                </span>
            </div>
        </div>

        <div v-if="streamer.vods_list.length == 0" class="notice">None</div>

        <div v-else>
            <vod
                v-for="vod in streamer.vods_list"
                :key="vod.basename"
                v-bind:vod="vod"
            />
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";

import Vod from "@/components/Vod.vue";

import type { ApiStreamer } from "@/twitchautomator.d";

export default defineComponent({
    name: "Streamer",
    props: {
        streamer: Object as () => ApiStreamer,
    },
    computed: {
        quality(): string|undefined {
            return this.streamer?.quality.join(", ");
        },
        vodAmount(): number|undefined {
            return this.streamer?.vods_list.length;
        },
        vodSize(): number|undefined {
            return this.streamer?.vods_size;
        },
        subExpiresAt(): string|undefined {
            return this.streamer?.expires_at.date;
        },
    },
    components: {
        Vod
    }
});
</script>
