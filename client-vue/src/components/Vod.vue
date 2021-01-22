<template>
    <div
        v-if="vod"
        :class="{
            video: true,
            'is-animated': $store.state.clientConfig.animationsEnabled,
            'is-recording': vod.is_capturing,
            'is-converting': vod.is_converting,
            'is-finalized': vod.is_finalized,
            'is-favourite': vod.api_hasFavouriteGame,
        }"
    >
        <div :id="'vod_' + vod?.basename" class="anchor"></div>

        <!-- title -->
        <div class="video-title">
            <h3>
                <span class="icon"><fa icon="file-video"></fa></span>
                <span class="video-date" :title="formatDate(vod?.dt_started_at.date)" v-if="vod?.dt_started_at">{{
                    $store.state.clientConfig.useRelativeTime ? humanDate(vod?.dt_started_at.date, true) : formatDate(vod?.dt_started_at.date)
                }}</span>
                <span class="video-filename">{{ vod?.basename }}</span>
            </h3>
        </div>

        <!-- description -->
        <div class="video-description">
            <!-- box art -->
            <div class="boxart-carousel is-small" v-if="vod && vod.api_getUniqueGames">
                <div v-for="game in vod.api_getUniqueGames" :key="game" class="boxart-item">
                    <img v-if="game.image_url" :title="game.name" :alt="game.name" :src="game.image_url" loading="lazy" />
                    <span v-else>{{ game.name }}</span>
                </div>
            </div>

            <!-- video info -->
            <div v-if="vod?.is_finalized" class="info-columns">
                <div class="info-column">
                    <h4>General</h4>
                    <ul class="video-info">
                        <li>
                            <strong>Webhook duration:</strong>
                            {{ vod?.api_getWebhookDuration }}
                        </li>
                        <li>
                            <strong>Stream start:</strong>
                            {{ formatDate(vod?.dt_started_at.date, "yyyy-MM-dd HH:mm:ss") }}
                        </li>
                        <template v-if="vod?.dt_capture_started">
                            <li>
                                <strong>Capture start:</strong>
                                {{ formatDate(vod?.dt_capture_started.date, "yyyy-MM-dd HH:mm:ss") }}
                            </li>
                            <li>
                                <strong>Conversion start:</strong>
                                {{ formatDate(vod?.dt_conversion_started.date, "yyyy-MM-dd HH:mm:ss") }}
                            </li>
                        </template>
                        <li>
                            <strong>Missing from captured file:</strong>
                            <span v-if="vod?.twitch_vod_duration">{{ humanDuration(vod?.twitch_vod_duration - vod?.api_getDuration) }}</span>
                            <span v-else
                                ><strong><em>No data</em></strong></span
                            >
                        </li>
                        <li>
                            <strong>Chat downloaded:</strong>
                            {{ vod?.is_chat_downloaded ? "Yes" : "No" }}
                        </li>
                        <li>
                            <strong>Chat dumped:</strong>
                            {{ vod?.is_chatdump_captured ? "Yes" : "No" }}
                        </li>
                        <li>
                            <strong>Chat rendered:</strong>
                            {{ vod?.is_chat_rendered ? "Yes" : "No" }}
                        </li>
                        <li>
                            <strong>Chat burned:</strong>
                            {{ vod?.is_chat_burned ? "Yes" : "No" }}
                        </li>
                    </ul>
                </div>

                <div class="info-column">
                    <h4>Capture</h4>
                    <ul class="video-info">
                        <li>
                            <strong>File duration:</strong>
                            {{ humanDuration(vod?.api_getDuration) }}
                        </li>
                        <li>
                            <strong>Size:</strong>
                            {{ formatBytes(vod?.segments[0].filesize) }}
                        </li>
                        <template v-if="vod?.video_metadata_public">
                            <li>
                                <strong>Dimensions:</strong>
                                {{ vod?.video_metadata_public.video.Width }}x{{ vod?.video_metadata_public.video.Height }}
                            </li>
                            <li>
                                <strong>Framerate:</strong>
                                {{ vod?.video_metadata_public.video.FrameRate_Mode }}
                                {{
                                    vod?.video_metadata_public.video.FrameRate_Original
                                        ? vod?.video_metadata_public.video.FrameRate_Original
                                        : vod?.video_metadata_public.video.FrameRate
                                }}
                            </li>
                            <li>
                                <strong>Video:</strong>
                                {{ vod?.video_metadata_public.video.Format }}
                                {{ vod?.video_metadata_public.video.BitRate_Mode }}
                                {{ Math.round(vod?.video_metadata_public.video.BitRate / 1000) }}kbps
                            </li>
                            <li>
                                <strong>Audio:</strong>
                                {{ vod?.video_metadata_public.audio.Format }}
                                {{ vod?.video_metadata_public.audio.BitRate_Mode }}
                                {{ Math.round(vod?.video_metadata_public.audio.BitRate / 1000) }}kbps
                            </li>
                        </template>
                    </ul>
                </div>

                <div class="info-column">
                    <h4>Twitch VOD</h4>
                    <ul class="video-info">
                        <template v-if="vod?.twitch_vod_exists === true">
                            <li>
                                <strong>Duration:</strong>
                                <template v-if="vod?.twitch_vod_duration">{{ humanDuration(vod?.twitch_vod_duration) }}</template>
                                <template v-else>
                                    <strong><em>No data</em></strong>
                                </template>
                            </li>
                            <li>
                                <strong>ID:</strong>
                                <span v-if="vod?.twitch_vod_url">
                                    <a :href="vod?.twitch_vod_url" rel="noreferrer" target="_blank">{{ vod?.twitch_vod_id }}</a>

                                    <!--
                                {% if checkvod %}
                                    
                                    {% if vodclass.twitch_vod_exists %}
                                        (exists)
                                    {% else %}
                                        <strong class="is-error">(deleted)</strong>
                                    {% endif %}

                                {% endif %}
                                -->
                                </span>
                                <span v-else>
                                    <strong><em>Not matched or VOD deleted</em></strong>
                                </span>
                            </li>
                            <li>
                                <strong>Date:</strong>&#32;
                                <template v-if="vod?.twitch_vod_date">{{ formatDate(vod?.twitch_vod_date) }}</template>
                                <strong v-else><em>No data</em></strong>
                            </li>
                            <li>
                                <strong>Title:</strong>
                                <span v-if="vod?.twitch_vod_title" class="text-overflow">
                                    {{ vod?.twitch_vod_title }}
                                </span>
                                <strong v-else><em>No data</em></strong>
                            </li>
                            <li>
                                <strong>Is muted:</strong>
                                <strong v-if="vod?.twitch_vod_muted === true" class="is-error">Yes</strong>
                                <span v-else-if="vod?.twitch_vod_muted === false">No</span>
                                <em v-else>No data</em>
                            </li>
                        </template>
                        <template v-else-if="vod?.twitch_vod_exists === false">
                            <li>
                                <strong class="is-error">VOD is deleted</strong>
                            </li>
                            <li>
                                <span v-if="vod?.twitch_vod_id">
                                    The ID was
                                    <a :href="vod?.twitch_vod_url" rel="noreferrer" target="_blank">{{ vod?.twitch_vod_id }}</a
                                    >.
                                </span>
                                <span v-else>The VOD probably never got saved.</span>
                            </li>
                        </template>
                        <template v-else>
                            <li>
                                <em>VOD has not been checked</em>
                            </li>
                        </template>
                        <li>
                            <strong>Downloaded:</strong>
                            {{ vod?.is_vod_downloaded ? "Yes" : "No" }}
                        </li>
                    </ul>
                </div>
            </div>

            <ul v-if="vod?.is_capturing" class="video-info">
                <li><strong>Current duration:</strong> <duration-display :startDate="vod.dt_started_at.date" outputStyle="human"></duration-display></li>
                <li>
                    <strong>Watch live:</strong>
                    <a href="https://twitch.tv/{{ streamer.display_name }}" rel="noreferrer" target="_blank">Twitch</a>
                </li>
                <!--<li><strong>Watch capture:</strong>
                    <a href="{{ base_path() }}/vods/{{ config.channel_folders ? vodclass.streamer_name ~ "/" : "" }}{{ vodclass.basename }}.ts" rel="noreferrer" target="_blank">TS file</a>
                    <a href="{{ base_path() }}/vods/{{ config.channel_folders ? vodclass.streamer_name ~ "/" : "" }}{{ vodclass.basename }}.m3u8" rel="noreferrer" target="_blank">Playlist file</a>
                <li><a href="{{ url_for('api_jobs_kill', { 'job': 'capture_' ~ vodclass.basename }) }}">Kill job</a></li>-->
            </ul>
        </div>

        <!-- segment list -->
        <div v-if="vod?.is_finalized" class="video-segments">
            <strong>Segments</strong>
            <ul class="list-segments" v-if="vod && vod.segments">
                <li v-for="segment in vod.segments" :key="segment">
                    <a :href="vod?.webpath + '/' + segment.basename">
                        <span class="text-overflow">{{ segment.basename }}</span>
                        <span v-if="segment.deleted">
                            <strong class="is-error">(deleted)</strong>
                        </span>
                        <span v-else> ({{ formatBytes(segment.filesize) }}) </span>
                    </a>
                </li>

                <li v-if="vod?.is_vod_downloaded">
                    <a :href="vod?.webpath + '/' + vod?.basename + '_vod.mp4'">Downloaded VOD</a>
                </li>

                <template v-if="vod?.is_chat_rendered">
                    <li>
                        <a :href="vod?.webpath + '/' + vod?.basename + '_chat.mp4'">Rendered chat</a>
                    </li>
                    <li>
                        <a :href="vod?.webpath + '/' + vod?.basename + '_chat_mask.mp4'">Rendered chat mask</a>
                    </li>
                </template>

                <li v-if="vod?.is_chat_burned">
                    <a :href="vod?.webpath + '/' + vod?.basename + '_burned.mp4'">Burned chat</a>
                </li>
            </ul>
        </div>

        <!-- controls -->
        <div class="video-controls" v-if="vod?.is_finalized">
            <router-link class="button is-blue" :to="{ name: 'Editor', params: { vod: vod?.basename } }">
                <span class="icon"><fa icon="cut" type="fa"></fa></span>
                Editor
            </router-link>

            <a v-if="vod?.is_chat_downloaded" class="button is-blue" href="#">
                <span class="icon"><fa icon="play" type="fa"></fa></span>
                Player
            </a>

            <a v-else-if="vod?.is_chatdump_captured" class="button is-blue" href="#">
                <span class="icon"><fa icon="play" type="fa"></fa></span>
                Player
            </a>

            <a class="button" :href="vod?.webpath + '/' + vod?.basename + '.json'" target="_blank">
                <span class="icon"><fa icon="database" type="fa"></fa></span>
                JSON
            </a>

            <a class="button" @click="doArchive">
                <span class="icon">
                    <fa icon="archive" type="fa" v-if="!taskStatus.archive"></fa>
                    <fa icon="sync" type="fa" spin="true" v-else></fa>
                </span>
                Archive
            </a>

            <a v-if="!vod?.twitch_vod_id && !vod?.is_chat_downloaded" class="button" @click="doDownloadChat">
                <span class="icon">
                    <fa icon="comments" type="fa" v-if="!taskStatus.downloadChat"></fa>
                    <fa icon="sync" type="fa" spin="true" v-else></fa>
                </span>
                Download chat
            </a>

            <template v-if="vod?.is_chat_downloaded && !vod?.is_chat_burned">
                <a class="button" @click="doRenderChat">
                    <span class="icon">
                        <fa icon="comments" type="fa" v-if="!taskStatus.renderChat"></fa>
                        <fa icon="sync" type="fa" spin="true" v-else></fa>
                    </span>
                    Render chat
                </a>
                <a v-if="vod?.is_vod_downloaded" class="button" @click="doRenderChat(true)">
                    <span class="icon">
                        <fa icon="comments" type="fa" v-if="!taskStatus.renderChat"></fa>
                        <fa icon="sync" type="fa" spin="true" v-else></fa>
                    </span>
                    Render chat (vod)
                </a>
            </template>

            <template v-if="vod?.twitch_vod_id">
                <a v-if="!vod?.is_vod_downloaded" class="button" @click="doDownloadVod">
                    <span class="icon">
                        <fa icon="download" type="fa" v-if="!taskStatus.downloadVod"></fa>
                        <fa icon="sync" type="fa" spin="true" v-else></fa>
                    </span>
                    Download{{ vod?.twitch_vod_muted ? " muted" : "" }} VOD
                </a>
                <a class="button" @click="doCheckMute">
                    <span class="icon">
                        <fa icon="volume-mute" type="fa" v-if="!taskStatus.vodMuteCheck"></fa>
                        <fa icon="sync" type="fa" spin="true" v-else></fa>
                    </span>
                    Check mute
                </a>
                <a v-if="!vod?.is_chat_burned" class="button" @click="doFullBurn">
                    <span class="icon">
                        <fa icon="burn" type="fa" v-if="!taskStatus.fullBurn"></fa>
                        <fa icon="sync" type="fa" spin="true" v-else></fa>
                    </span>
                    Render &amp; burn
                </a>
            </template>

            <a class="button is-danger" @click="doDelete">
                <span class="icon">
                    <fa icon="trash" type="fa" v-if="!taskStatus.delete"></fa>
                    <fa icon="sync" type="fa" spin="true" v-else></fa>
                </span>
                Delete
            </a>
        </div>

        <div class="video-status" v-if="!vod.is_finalized">
            <template v-if="vod?.is_converting">
                <em>
                    <span class="icon"><fa icon="file-signature"></fa></span>
                    Converting <strong>{{ vod?.basename }}.ts</strong> to <strong>{{ vod?.basename }}.mp4</strong>
                </em>
                <br />
                <em>
                    <span v-if="vod?.api_getConvertingStatus">
                        <span class="icon"><fa icon="sync" spin></fa></span>
                        Running (pid {{ vod?.api_getConvertingStatus }})
                    </span>
                    <span v-else>
                        <strong class="is-error flashing">
                            <span class="icon"><fa icon="exclamation-triangle"></fa></span>
                            Not running, did it crash?
                        </strong>
                    </span>
                </em>
            </template>
            <template v-else-if="vod?.is_capturing">
                <em class="text-overflow">
                    <span class="icon"><fa icon="video"></fa></span>
                    Capturing to <strong>{{ vod?.basename }}.ts</strong> (<strong>{{ formatBytes(vod?.api_getRecordingSize) }}</strong>)
                </em>

                <br />

                <template v-if="!$store.state.config.playlist_dump">
                    <em>
                        <span v-if="vod?.api_getCapturingStatus">
                            <span class="icon"><fa icon="sync" spin></fa></span>
                            Video capture running (pid
                            {{ vod?.api_getCapturingStatus }})
                        </span>
                        <span v-else>
                            <strong class="is-error flashing">
                                <span class="icon"><fa icon="exclamation-triangle"></fa></span>
                                Video capture not running, did it crash?
                            </strong>
                        </span>
                    </em>
                    <template v-if="$store.state.config.chat_dump">
                        <br /><em>
                            <span v-if="vod?.api_getChatDumpStatus">
                                <span class="icon"><fa icon="sync" spin></fa></span>
                                Chat dump running (pid
                                {{ vod?.api_getChatDumpStatus }})
                            </span>
                            <span v-else>
                                <strong class="is-error flashing">
                                    <span class="icon"><fa icon="exclamation-triangle"></fa></span>
                                    Chat dump not running, did it crash?
                                </strong>
                            </span>
                        </em>
                    </template>
                </template>
            </template>
            <template v-else-if="!vod?.is_capturing && !vod?.is_converting && !vod?.is_finalized">
                <em>Waiting to finalize video (since {{ formatDate(vod?.dt_ended_at.date, "yyyy-MM-dd HH:mm:ss") }})</em>
            </template>
            <template v-else>
                <em>No video file or error</em>
            </template>
        </div>

        <!-- capture length warning -->
        <div v-if="vod?.is_capturing && vod?.api_getDurationLive > 86400" class="video-error">
            Capture has been running for over 24 hours, streamlink does not support this. Is the capture stuck?
        </div>

        <!-- no chapters error -->
        <div v-if="!vod?.chapters" class="video-error">No chapter data!?</div>

        <!-- troubleshoot error -->
        <!--
        {% if vodclass.troubleshoot %}
            <div class="video-error">
                {{ vodclass.troubleshoot.text }}
                {% if vodclass.troubleshoot.fixable %}<br /><a href="{{ url_for('troubleshoot', { 'vod': vodclass.basename }) }}?fix=1">Try to fix</a>{% endif %}
            </div>
        {% endif %}
        -->

        <!-- game list / chapters -->
        <div class="video-chapters">
            <table class="table game-list" v-if="vod && vod.chapters">
                <thead>
                    <tr>
                        <th>Offset</th>
                        <th>Duration</th>
                        <th>Game</th>
                        <th>Title</th>
                        <th>Viewers</th>
                    </tr>
                </thead>

                <tbody>
                    <tr
                        v-for="chapter in vod.chapters"
                        :key="chapter"
                        :class="{
                            favourite: $store.state.config.favourites[chapter.game_id],
                        }"
                    >
                        <!-- start timestamp -->
                        <td data-contents="started_at" :title="formatDate(chapter.datetime.date)">
                            {{ humanDuration(chapter.offset) }}
                        </td>

                        <!-- duration -->
                        <td data-contents="duration">
                            <span class="grey" v-if="chapter.duration">
                                {{ niceDuration(chapter.duration) }}
                            </span>
                            <span v-else>
                                <duration-display :startDate="chapter.datetime.date" outputStyle="human"></duration-display>
                            </span>
                        </td>

                        <!-- chapter name -->
                        <td data-contents="name">
                            <img v-if="chapter.box_art_url" class="boxart" :src="chapter.box_art_url" :alt="chapter.game_name" loading="lazy" />
                            <template v-if="vod?.is_finalized">
                                <span class="game-name">
                                    <router-link :to="{ name: 'Editor', params: { vod: vod?.basename }, query: { start: chapter.offset } }">
                                        {{ chapter.game_name ? chapter.game_name : "None" }}
                                    </router-link>
                                    <a
                                        v-if="vod?.twitch_vod_exists"
                                        :href="vod?.twitch_vod_url + '?t=' + twitchDuration(chapter.offset)"
                                        target="_blank"
                                        rel="noreferrer"
                                        aria-label="Open on Twitch"
                                    >
                                        <span class="icon"><fa icon="external-link-alt"></fa></span>
                                    </a>
                                    <a
                                        v-if="!$store.state.config.favourites[chapter.game_id]"
                                        title="Add to favourites"
                                        @click="addFavouriteGame(chapter.game_id)"
                                    >
                                        <span class="icon"><fa icon="star"></fa></span>
                                    </a>
                                </span>
                            </template>
                            <template v-else>
                                {{ chapter.game_name ? chapter.game_name : "None" }}
                            </template>
                        </td>

                        <!-- title -->
                        <td>
                            <span class="text-overflow">{{ chapter.title }}</span>
                        </td>

                        <td>
                            <span class="grey">{{ formatNumber(chapter.viewer_count) }}</span>
                        </td>
                    </tr>

                    <tr v-if="vod?.dt_ended_at">
                        <td :title="formatDate(vod.dt_ended_at.date)">
                            {{ vod?.api_getWebhookDuration }}
                        </td>
                        <td colspan="4">
                            <em>END</em>
                        </td>
                    </tr>

                    <tr v-else>
                        <td v-if="vod?.dt_started_at">
                            <!--{{ humanDuration(vod?.api_getDurationLive) }}-->
                            <duration-display :startDate="vod.dt_started_at.date"></duration-display>
                        </td>
                        <td colspan="4">
                            <em><strong>ONGOING</strong></em>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>

<script lang="ts">
import type { ApiVod } from "@/twitchautomator.d";
import { defineComponent } from "vue";
import DurationDisplay from "@/components/DurationDisplay.vue";
// import { format, toDate, parse } from 'date-fns';

import { library } from "@fortawesome/fontawesome-svg-core";
import {
    faFileVideo,
    faCut,
    faPlay,
    faDatabase,
    faComments,
    faVolumeMute,
    faBurn,
    faTrash,
    faExternalLinkAlt,
    faArchive,
    faDownload,
    faExclamationTriangle,
    faFileSignature
} from "@fortawesome/free-solid-svg-icons";
library.add(
    faFileVideo,
    faCut,
    faPlay,
    faDatabase,
    faComments,
    faVolumeMute,
    faBurn,
    faTrash,
    faExternalLinkAlt,
    faArchive,
    faDownload,
    faExclamationTriangle,
    faFileSignature
);

export default defineComponent({
    name: "Vod",
    emits: ["forceFetchData"],
    data() {
        return {
            config: [],
            taskStatus: {
                vodMuteCheck: false,
                archive: false,
                downloadChat: false,
                renderChat: false,
                downloadVod: false,
                fullBurn: false,
                delete: false,
            },
        };
    },
    props: {
        vod: Object as () => ApiVod,
    },
    methods: {
        doArchive() {
            if (!confirm(`Do you want to archive "${this.vod?.basename}"?`)) return;
            this.taskStatus.archive = true;
            this.$http
                .post(`/api/v0/vod/${this.vod?.basename}/save`)
                .then((response) => {
                    const json = response.data;
                    if (json.message) alert(json.message);
                    console.log(json);
                    this.taskStatus.archive = false;
                    // this.$emit("forceFetchData");
                })
                .catch((err) => {
                    console.error("form error", err.response);
                    this.taskStatus.archive = false;
                });
        },
        doDownloadChat() {
            if (!confirm(`Do you want to download the chat for "${this.vod?.basename}"?`)) return;
            this.taskStatus.downloadChat = true;
            this.$http
                .post(`/api/v0/vod/${this.vod?.basename}/download_chat`)
                .then((response) => {
                    const json = response.data;
                    if (json.message) alert(json.message);
                    console.log(json);
                    this.taskStatus.downloadChat = false;
                    // this.$emit("forceFetchData");
                })
                .catch((err) => {
                    console.error("form error", err.response);
                    this.taskStatus.downloadChat = false;
                });
        },
        doRenderChat(useVod = false) {
            /** @todo: implement */
            alert("RenderChat");
        },
        doDownloadVod() {
            if (!confirm(`Do you want to download the vod for "${this.vod?.basename}"?`)) return;
            this.taskStatus.downloadVod = true;
            this.$http
                .post(`/api/v0/vod/${this.vod?.basename}/download`)
                .then((response) => {
                    const json = response.data;
                    if (json.message) alert(json.message);
                    console.log(json);
                    this.taskStatus.downloadVod = false;
                    // this.$emit("forceFetchData");
                })
                .catch((err) => {
                    console.error("form error", err.response);
                    this.taskStatus.downloadVod = false;
                });
        },
        doCheckMute() {
            this.taskStatus.vodMuteCheck = true;
            this.$http
                .post(`/api/v0/vod/${this.vod?.basename}/check_mute`)
                .then((response) => {
                    const json = response.data;
                    if (json.message) alert(json.message);
                    console.log(json);

                    if (json.data) {
                        if (json.data.muted === null) {
                            alert(`The vod "${this.vod?.basename}" could not be checked.`);
                        } else {
                            alert(`The vod "${this.vod?.basename}" is${json.data.muted ? "" : " not"} muted.`);
                        }
                    }
                    this.taskStatus.vodMuteCheck = false;
                    // this.$emit("forceFetchData");
                })
                .catch((err) => {
                    console.error("doCheckMute error", err.response);
                    if (err.response.data) {
                        const json = err.response.data;
                        if (json.message) alert(json.message);
                    }
                    this.taskStatus.vodMuteCheck = false;
                });
        },
        doFullBurn() {
            /** @todo: implement */
            alert("FullBurn");
        },
        doDelete() {
            if (!confirm(`Do you want to delete "${this.vod?.basename}"?`)) return;
            this.taskStatus.delete = true;
            this.$http
                .post(`/api/v0/vod/${this.vod?.basename}/delete`)
                .then((response) => {
                    const json = response.data;
                    if (json.message) alert(json.message);
                    console.log(json);
                    this.taskStatus.delete = false;
                    // this.$emit("forceFetchData");
                })
                .catch((err) => {
                    console.error("form error", err.response);
                    this.taskStatus.delete = false;
                });
        },
        addFavouriteGame(game_id: number) {
            const formData = new FormData();
            formData.set(`games[${game_id}]`, "1");

            for (const fid in this.$store.state.config.favourites) {
                formData.set(`games[${fid}]`, "1");
            }

            this.$http
                .post(`/api/v0/favourites/save`, formData)
                .then((response) => {
                    const json = response.data;
                    if (json.message) alert(json.message);
                    console.log(json);

                    this.$http.get(`/api/v0/settings/list`).then((response) => {
                        this.$store.commit("updateConfig", response.data.data.config);
                    });
                })
                .catch((err) => {
                    console.error("form error", err.response);
                });
        },
    },
    components: {
        DurationDisplay,
    },
});
</script>
