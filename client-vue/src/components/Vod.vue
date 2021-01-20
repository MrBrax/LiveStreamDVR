<template>
    <div
        v-if="vod"
        :class="{
            'video': true,
            'is-recording': vod.is_capturing,
            'is-converting': vod.is_converting,
            'is-finalized': vod.is_finalized,
            'is-favourite': vod.api_hasFavouriteGame
        }"
    >
        <div :id="'vod_' + vod?.basename" class="anchor"></div>

        <!-- title -->
        <div class="video-title">
            <h3>
                <span class="icon"><i class="fas fa-file-video"></i></span>
                <span class="video-date" v-if="vod?.dt_started_at">{{ formatDate(vod?.dt_started_at.date, "yyyy-MM-dd HH:mm:ss") }}</span>
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
                            <span v-if="vod?.twitch_vod_duration">{{
                                humanDuration(vod?.twitch_vod_duration - vod?.api_getDuration)
                            }}</span>
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
                        <template v-if="vod?.video_metadata">
                            <li>
                                <strong>Dimensions:</strong>
                                {{ vod?.video_metadata.video.Width }}x{{ vod?.video_metadata.video.Height }}
                            </li>
                            <li>
                                <strong>Framerate:</strong>
                                {{ vod?.video_metadata.video.FrameRate_Mode }}
                                {{
                                    vod?.video_metadata.video.FrameRate_Original
                                        ? vod?.video_metadata.video.FrameRate_Original
                                        : vod?.video_metadata.video.FrameRate
                                }}
                            </li>
                            <li>
                                <strong>Video:</strong>
                                {{ vod?.video_metadata.video.Format }}
                                {{ vod?.video_metadata.video.BitRate_Mode }}
                                {{ Math.round(vod?.video_metadata.video.BitRate / 1000) }}kbps
                            </li>
                            <li>
                                <strong>Audio:</strong>
                                {{ vod?.video_metadata.audio.Format }}
                                {{ vod?.video_metadata.audio.BitRate_Mode }}
                                {{ Math.round(vod?.video_metadata.audio.BitRate / 1000) }}kbps
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
                                <template v-else><strong><em>No data</em></strong></template>
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
                                <strong>Date:</strong>
                                <span v-if="vod?.twitch_vod_date">
                                    {{ vod?.twitch_vod_date }}
                                </span>
                                <span v-else>
                                    <strong><em>No data</em></strong>
                                </span>
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
                                <span v-else>
                                    The VOD probably never got saved.
                                </span>
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
                <li><strong>Current duration:</strong> {{ niceDuration(vod?.duration_live) }}</li>
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
                    <a :href="vod?.webpath + '/' + vod?.basename + '_vod?.mp4'">Downloaded VOD</a>
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
        <div class="video-controls">
            <template v-if="vod?.is_finalized">
                <router-link class="button is-blue" :to="{ name: 'Editor', params: { vod: vod?.basename } }">
                    <span class="icon"><i class="fa fa-cut"></i></span> Editor
                </router-link>

                <a v-if="vod?.is_chat_downloaded" class="button is-blue" href="#">
                    <span class="icon"><i class="fa fa-play"></i></span> Player
                </a>

                <a v-else-if="vod?.is_chatdump_captured" class="button is-blue" href="#">
                    <span class="icon"><i class="fa fa-play"></i></span> Player
                </a>

                <a class="button" :href="vod?.webpath + '/' + vod?.basename + '.json'" target="_blank">
                    <span class="icon"><i class="fa fa-database"></i></span>
                    JSON
                </a>

                <a class="button" @click="doArchive">
                    <span class="icon"><i class="fa fa-archive"></i></span>
                    Archive
                </a>

                <a v-if="!vod?.twitch_vod_id && !vod?.is_chat_downloaded" class="button" @click="doDownloadChat">
                    <span class="icon"><i class="fa fa-comments"></i></span>
                    Download chat
                </a>

                <template v-if="vod?.is_chat_downloaded && !vod?.is_chat_burned">
                    <a class="button" @click="doRenderChat"><span class="icon"><i class="fa fa-comment"></i></span> Render chat</a>
                    <a v-if="vod?.is_vod_downloaded" class="button" @click="doRenderChat(true)"><span class="icon"><i class="fa fa-comment"></i></span> Render chat (vod)</a>
                </template>

                <template v-if="vod?.twitch_vod_id">
                    <a v-if="!vod?.is_vod_downloaded" class="button" @click="doDownloadVod">
                        <span class="icon"><i class="fa fa-download"></i></span>
                        Download{{ vod?.twitch_vod_muted ? " muted" : "" }} VOD
                    </a>
                    <a class="button" @click="doCheckMute"><span class="icon"><i class="fa fa-volume-mute"></i></span> Check mute</a>
                    <a v-if="!vod?.is_chat_burned" class="button" @click="doFullBurn"><span class="icon"><i class="fa fa-burn"></i></span> Render &amp; burn</a>
                </template>

                <a class="button is-danger" @click="doDelete"><span class="icon"><i class="fa fa-trash"></i></span> Delete</a
                >
            </template>
            <template v-else-if="vod?.is_converting">
                <em
                    ><span class="icon"><i class="fa fa-file-signature"></i></span> Converting <strong>{{ vod?.basename }}.ts</strong> to
                    <strong>{{ vod?.basename }}.mp4</strong></em
                ><br />
                <em>
                    <span v-if="vod?.api_getConvertingStatus"
                        ><span class="icon"><i class="fa fa-sync fa-spin"></i></span> Running (pid {{ vod?.api_getConvertingStatus }})</span
                    >
                    <span v-else
                        ><strong class="is-error flashing"
                            ><span class="icon"><i class="fa fa-exclamation-triangle"></i></span> Not running, did it crash?</strong
                        ></span
                    >
                </em>
            </template>
            <template v-else-if="vod?.is_capturing">
                <em>
                    <span class="icon"><i class="fa fa-video"></i></span>
                    Capturing to
                    <strong>{{ vod?.basename }}.ts</strong> (<strong>{{ formatBytes(vod?.api_getRecordingSize) }}</strong
                    >)
                </em>

                <br />

                <template v-if="!$store.state.config.playlist_dump">
                    <em>
                        <span v-if="vod?.api_getCapturingStatus">
                            <span class="icon"><i class="fa fa-sync fa-spin"></i></span>
                            Video capture running (pid
                            {{ vod?.api_getCapturingStatus }})
                        </span>
                        <span v-else>
                            <strong class="is-error flashing"
                                ><span class="icon"><i class="fa fa-exclamation-triangle"></i></span> Video capture not running, did it
                                crash?</strong
                            >
                        </span>
                    </em>
                    <template v-if="$store.state.config.chat_dump">
                        <br /><em>
                            <span v-if="vod?.api_getChatDumpStatus">
                                <span class="icon"><i class="fa fa-sync fa-spin"></i></span>
                                Chat dump running (pid
                                {{ vod?.api_getChatDumpStatus }})
                            </span>
                            <span v-else>
                                <strong class="is-error flashing"
                                    ><span class="icon"><i class="fa fa-exclamation-triangle"></i></span> Chat dump not running, did it
                                    crash?</strong
                                >
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
        <div v-if="!vod?.chapters" class="video-error">
            No chapter data!?
        </div>

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
                            favourite: $store.state.config.favourites[chapter.game_id]
                        }"
                    >
                        <!-- start timestamp -->
                        <td>
                            {{ chapter.strings.started_at }}
                        </td>

                        <!-- duration -->
                        <td>
                            <span class="grey">
                                {{ chapter.duration ? chapter.strings.duration : "Active" }}
                            </span>
                        </td>

                        <!-- chapter name -->
                        <td>
                            <img
                                v-if="chapter.box_art_url"
                                class="boxart"
                                :src="chapter.box_art_url"
                                :alt="chapter.game_name"
                                loading="lazy"
                            />
                            <template v-if="vod?.is_finalized">
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
                                    <span class="icon"><i class="fas fa-external-link-alt"></i></span>
                                </a>
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
                        <td>
                            {{ vod?.api_getWebhookDuration }}
                        </td>
                        <td colspan="4">
                            <em>END</em>
                        </td>
                    </tr>

                    <tr v-else>
                        <td v-if="vod?.dt_started_at">
                            {{ humanDuration(vod?.api_getDurationLive) }}
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
import { defineComponent } from "vue";

import type { ApiVod } from "@/twitchautomator.d";

import { format, toDate, parse } from 'date-fns';

const dateFormat = "yyyy-MM-dd HH:mm:ss.SSSSSS"; // 2020-11-03 02:48:01.000000

export default defineComponent({
    name: "Vod",
    emits: ['forceFetchData'],
    data(){
        return {
            config: []
        }
    },
    props: {
        vod: Object as () => ApiVod,
    },
    computed: {
        /*
        startedAt() : string {
            if(!this.vod) return "";
            return format(parse(this.vod.dt_started_at.date, dateFormat, new Date()), "yyyy-MM-dd");
        }
        */
    },
    methods: {
        doArchive(){
            if(!confirm(`Do you want to archive "${this.vod?.basename}"?`)) return;
            this.$http.post(`/api/v0/vod/${this.vod?.basename}/save`)
            .then((response) => {
                const json = response.data;
                if(json.message) alert(json.message);
                console.log(json);
                // this.$emit("forceFetchData");
            }).catch((err) => {
                console.error("form error", err.response);
            });
        },
        doDownloadChat(){
            if(!confirm(`Do you want to download the chat for "${this.vod?.basename}"?`)) return;
            this.$http.post(`/api/v0/vod/${this.vod?.basename}/download_chat`)
            .then((response) => {
                const json = response.data;
                if(json.message) alert(json.message);
                console.log(json);
                // this.$emit("forceFetchData");
            }).catch((err) => {
                console.error("form error", err.response);
            });
        },
        doRenderChat( useVod = false ){
            alert('RenderChat');
        },
        doDownloadVod(){
            if(!confirm(`Do you want to download the vod for "${this.vod?.basename}"?`)) return;
            this.$http.post(`/api/v0/vod/${this.vod?.basename}/download`)
            .then((response) => {
                const json = response.data;
                if(json.message) alert(json.message);
                console.log(json);
                // this.$emit("forceFetchData");
            }).catch((err) => {
                console.error("form error", err.response);
            });
        },
        doCheckMute(){
            this.$http.post(`/api/v0/vod/${this.vod?.basename}/check_mute`)
            .then((response) => {
                const json = response.data;
                if(json.message) alert(json.message);
                console.log(json);

                if(json.data){
                    if(json.data.muted === null){
                        alert(`The vod "${this.vod?.basename}" could not be checked.`);
                    }else{
                        alert(`The vod "${this.vod?.basename}" is${json.data.muted ? "" : " not"} muted.`);
                    }
                }

                // this.$emit("forceFetchData");
            }).catch((err) => {
                console.error("doCheckMute error", err.response);
                if(err.response.data){
                    const json = err.response.data;
                    if(json.message) alert(json.message);
                }
            });
        },
        doFullBurn(){
            alert('FullBurn');
        },
        doDelete(){
            if(!confirm(`Do you want to delete "${this.vod?.basename}"?`)) return;
            this.$http.post(`/api/v0/vod/${this.vod?.basename}/delete`)
            .then((response) => {
                const json = response.data;
                if(json.message) alert(json.message);
                console.log(json);
                // this.$emit("forceFetchData");
            }).catch((err) => {
                console.error("form error", err.response);
            });
        },
    }
});
</script>
