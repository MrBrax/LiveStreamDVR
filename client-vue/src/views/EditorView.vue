<template>
    <div class="container">
        <div
            v-if="vodData && vodData.basename"
            class="videoplayer"
        >
            <video
                id="video"
                ref="player"
                :src="videoSource"
                width="1280"
                @timeupdate="videoTimeUpdate"
                @canplay="videoCanPlay"
                @seeked="videoSeeked"
                @error="videoError"
            >
                <track
                    kind="chapters"
                    :src="chapterSource"
                    label="Chapters"
                    default
                >
            </video>
            <div class="videoplayer-time">
                <span v-if="videoDuration">
                    {{ formatDuration(currentVideoTime) }} / {{ videoDuration ? formatDuration(videoDuration) : '-' }}
                </span>
                <span v-else>{{ t("messages.loading") }}</span>
            </div>
            <div class="videoplayer-controls">
                <div class="buttons">
                    <button
                        class="button is-confirm"
                        @click="play"
                    >
                        <span class="icon"><fa icon="play" /></span>
                        <span>{{ t('views.editor.buttons.play') }}</span>
                    </button>
                    <button
                        class="button is-confirm"
                        @click="pause"
                    >
                        <span class="icon"><fa icon="pause" /></span>
                        <span>{{ t('views.editor.buttons.pause') }}</span>
                    </button>
                    <button
                        type="button"
                        class="button is-confirm"
                        @click="setFrameIn(currentVideoTime)"
                    >
                        <span class="icon"><fa icon="fast-backward" /></span>
                        <span>{{ t('views.editor.buttons.mark-in') }}</span>
                    </button>
                    <button
                        type="button"
                        class="button is-confirm"
                        @click="setFrameOut(currentVideoTime)"
                    >
                        <span class="icon"><fa icon="fast-forward" /></span>
                        <span>{{ t('views.editor.buttons.mark-out') }}</span>
                    </button>
                    <button
                        class="button is-confirm"
                        @click="addBookmark"
                    >
                        <span class="icon"><fa icon="bookmark" /></span>
                        <span>{{ t('views.editor.buttons.add-bookmark') }}</span>
                    </button>
                </div>
            </div>
            <div
                id="timeline"
                ref="timeline"
                @click="seek"
            >
                <div
                    id="timeline-cut"
                    :style="timelineCutStyle"
                />
                <div
                    id="timeline-playhead"
                    :style="timelinePlayheadStyle"
                />
            </div>

            <!--{{ currentVideoTime }} / {{ $refs.player ? $refs.player.currentTime : 'init' }} / {{ $refs.player ? $refs.player.duration : 'init' }}-->

            <div class="videoplayer-chapters">
                <div
                    v-for="(chapter, chapterIndex) in vodData.chapters"
                    :key="chapterIndex"
                    :title="chapter.title + ' | \\n' + chapter.game_name"
                    class="videoplayer-chapter"
                    :style="{ width: chapterWidth(chapter) + '%' }"
                    @click="scrub(chapter.offset || 0, chapter.duration || 0)"
                >
                    <div class="videoplayer-chapter-title">
                        {{ chapter.title }}
                    </div>
                    <div class="videoplayer-chapter-game">
                        {{ chapter.game_name }}
                    </div>
                </div>
            </div>

            <div>
                <ul class="list">
                    <li
                        v-for="(chapter, i) in vodData.chapters"
                        :key="i"
                    >
                        <a
                            v-if="chapter.offset !== undefined && chapter.duration !== undefined"
                            @click="scrub(chapter.offset || 0, chapter.duration || 0)"
                        >
                            {{ formatDuration(chapter.offset) }} - {{ formatDuration(chapter.offset + chapter.duration) }}: {{ chapter.title }}
                        </a> 
                    </li>
                </ul>
            </div>

            <!--{{ videoSource }}-->

            <div class="videoplayer-form">
                <form
                    method="POST"
                    enctype="multipart/form-data"
                    action="#"
                    @submit="submitForm"
                >
                    <h2>{{ t('views.editor.edit-segment') }}</h2>

                    <input
                        type="hidden"
                        name="vod"
                        value="{{ vodData.basename }}"
                    >

                    <div class="field">
                        <label
                            for="time_in"
                            class="label"
                        >{{ t('views.editor.time-in') }}</label>
                        <div class="control">
                            <input
                                id="time_in"
                                v-model="secondsIn"
                                class="input"
                                placeholder="In timestamp"
                            >
                            <p class="input-help">
                                Timestamp in seconds
                            </p>
                        </div>
                    </div>

                    <div class="field">
                        <label
                            for="time_out"
                            class="label"
                        >{{ t('views.editor.time-out') }}</label>
                        <div class="control">
                            <input
                                id="time_out"
                                v-model="secondsOut"
                                class="input"
                                placeholder="Out timestamp"
                            >
                            <p class="input-help">
                                Timestamp in seconds
                            </p>
                        </div>
                    </div>

                    <div class="field">
                        <div class="control">
                            <strong>{{ t('vod.video-info.duration') }}:</strong> {{ cutSegmentlength > 0 ? humanDuration(cutSegmentlength) : "None" }}
                        </div>
                    </div>

                    <div class="field">
                        <div class="control">
                            <strong>{{ t('views.editor.filesize') }}:</strong> {{ exportSize ? "~" + formatBytes(exportSize) : "None" }}
                        </div>
                    </div>

                    <div class="field">
                        <div class="control">
                            <input
                                v-model="cutName"
                                class="input"
                                type="text"
                                name="name"
                                placeholder="Name (optional)"
                            >
                        </div>
                    </div>

                    <div class="field form-submit">
                        <div class="control">
                            <button
                                type="submit"
                                class="button is-confirm"
                            >
                                <span class="icon"><fa icon="save" /></span>
                                <span>{{ t('views.editor.buttons.submit-cut') }}</span>
                            </button>
                        </div>
                        <div :class="formStatusClass">
                            {{ formStatusText }}
                        </div>
                    </div>
                </form>

                <!--
                <form method="post" action="{{ url_for('api_vod_export', { 'vod': vodclass.basename }) }}">
                    <select name="destination">
                        <option>YouTube</option>
                    </select>
                    <button type="submit" class="button" onclick="submit_cut();">Upload</button>
                </form>
                -->
            </div>
        </div>
        <div v-else>
            <span class="icon"><fa
                icon="sync"
                spin
            /></span> {{ t("messages.loading") }}
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import TwitchVOD from "@/core/Providers/Twitch/TwitchVOD";
import { useStore, VODTypes } from "@/store";
import { ApiResponse, ApiVodResponse } from "@common/Api/Api";
import { formatDuration, humanDuration, formatBytes } from "@/mixins/newhelpers";
import { library } from "@fortawesome/fontawesome-svg-core";
import { faPause, faBookmark, faFastBackward, faFastForward } from "@fortawesome/free-solid-svg-icons";
import { BaseVODChapter } from "@/core/Providers/Base/BaseVODChapter";
import { useI18n } from "vue-i18n";
import axios from "axios";
import { useRoute } from "vue-router";
import YouTubeVOD from "@/core/Providers/YouTube/YouTubeVOD";
library.add(faPause, faBookmark, faFastBackward, faFastForward);

export default defineComponent({
    name: "EditorView",
    title: "Editor",
    props: {
        uuid: String,
    },
    setup() {
        const store = useStore();
        const { t } = useI18n();
        const route = useRoute();
        return { store, t, route, formatDuration, humanDuration, formatBytes };
    },
    data() {
        return {
            vodData: {} as VODTypes,
            secondsIn: 0,
            secondsOut: 0,
            currentVideoTime: 0,
            cutName: "",
            formStatusText: "Ready",
            formStatus: "",
            videoDuration: 0,
        };
    },
    computed: {
        timelineCutStyle(): Record<string, string> {
            if (!this.currentVideoTime) return { left: "0%", right: "100%" };
            const dur = (this.$refs.player as HTMLVideoElement).duration;
            return {
                left: (this.secondsIn / dur) * 100 + "%",
                right: 100 - (this.secondsOut / dur) * 100 + "%",
            };
        },
        timelinePlayheadStyle(): Record<string, string> {
            if (!this.currentVideoTime) return { left: "0%" };
            const percent = (this.currentVideoTime / (this.$refs.player as HTMLVideoElement).duration) * 100;
            return {
                left: percent + "%",
            };
        },
        formStatusClass(): Record<string, boolean> {
            return {
                "form-status": true,
                "is-error": this.formStatus == "ERROR",
                "is-success": this.formStatus == "OK",
            };
        },
        cutSegmentlength(): number {
            if (this.secondsIn === undefined || this.secondsOut === undefined) return 0;
            return (this.secondsOut - this.secondsIn);
        },
        exportSize(): number {
            if (this.secondsIn === undefined || this.secondsOut === undefined) return 0;
            if (!this.vodData || this.vodData.segments.length == 0) return 0;
            const duration = this.secondsOut - this.secondsIn;
            const original_size = this.vodData.segments[0].filesize;
            if (!original_size) return 0;
            return Math.round(original_size * (duration / this.videoDuration));
        },
        videoSource(): string {
            return `${this.vodData.webpath}/${this.vodData.basename}.mp4`
        },
        chapterSource(): string {
            return `${this.vodData.webpath}/${this.vodData.basename}.chapters.vtt`;
        }
        // videoDuration(): number {
        //     const player = this.$refs.player as HTMLVideoElement;
        //     if (!player) return 0;
        //     return player.duration;
        // },
    },
    created() {
        this.fetchData();
    },
    methods: {
        fetchData() {
            // this.vodData = [];
            /** TODO: axios */
            axios
                .get<ApiVodResponse>(`/api/v0/vod/${this.uuid}`)
                .then((response) => {
                    const json = response.data;
                    if (json.data.provider == "twitch") {
                        this.vodData = TwitchVOD.makeFromApiResponse(json.data);
                    } else {
                        this.vodData = YouTubeVOD.makeFromApiResponse(json.data);
                    }
                    setTimeout(() => {
                        this.setupPlayer();
                    }, 500);
                })
                .catch((err) => {
                    console.error("about error", err.response);
                });
        },
        setupPlayer() {
            if (this.route.query.start !== undefined) {
                (this.$refs.player as HTMLVideoElement).currentTime = parseInt(this.route.query.start as string);
                if (this.route.query.start !== undefined) this.secondsIn = parseInt(this.route.query.start as string);
                if (this.route.query.end !== undefined) this.secondsOut = parseInt(this.route.query.end as string);
            }
        },
        play() {
            console.log("play", this.$refs.player);
            (this.$refs.player as HTMLVideoElement).play();
        },
        pause() {
            console.log("pause", this.$refs.player);
            (this.$refs.player as HTMLVideoElement).pause();
        },
        scrub(tIn: number, tOut: number) {
            // const gameOffset = this.vodData.game_offset; // TODO: why
            const gameOffset = 0;
            this.secondsIn = Math.round(tIn - gameOffset);
            this.secondsOut = Math.round(tIn + tOut - gameOffset);
            // this.$forceUpdate();
        },
        seek(event: MouseEvent) {
            console.log("seek", event);
            const duration = (this.$refs.player as HTMLVideoElement).duration;
            const rect = (this.$refs.timeline as HTMLDivElement).getBoundingClientRect();
            const percent = (event.clientX - rect.left) / (this.$refs.timeline as HTMLDivElement).clientWidth;
            const seconds = Math.round(duration * percent);
            (this.$refs.player as HTMLVideoElement).currentTime = seconds;

            // this.$forceUpdate();
        },
        videoTimeUpdate(event: Event) {
            // console.log(v);
            this.currentVideoTime = (event.target as HTMLVideoElement).currentTime;
        },
        videoCanPlay(event: Event) {
            console.log("can play", event);
            this.videoDuration = (event.target as HTMLVideoElement).duration;
        },
        videoSeeked(event: Event) {
            console.log("seeked", event);
        },
        videoError(event: Event) {
            console.error("video error", event);
            alert("Video error, does the video exist?");
        },
        submitForm(event: Event) {

            this.formStatusText = this.t("messages.loading");
            this.formStatus = "";

            const inputs = {
                vod: this.vodData.basename,
                time_in: this.secondsIn,
                time_out: this.secondsOut,
                name: this.cutName,
            };

            axios
                .post(`/api/v0/vod/${this.uuid}/cut`, inputs)
                .then((response) => {
                    const json = response.data;
                    this.formStatusText = json.message;
                    this.formStatus = json.status;
                    if (json.status == "OK") {
                        // this.$emit("formSuccess", json);
                    }
                })
                .catch((err) => {
                    const json = err.response.data;
                    console.error("form error", err.response);
                    this.formStatus = json.status;
                    this.formStatusText = json.message;
                });

            event.preventDefault();
            return false;
        },
        chapterWidth(chapter: BaseVODChapter): number {
            const player = this.$refs.player as HTMLVideoElement;
            if (!player) return 0;
            // const chapterOffset = chapter.offset || 0;
            const chapterDuration = chapter.duration || 0;
            const videoDuration = player.duration;
            const width = (chapterDuration / videoDuration) * 100;
            return width;
        },
        setFrameIn(frameNum: number) {
            this.secondsIn = Math.round(frameNum);
            if (this.secondsOut < this.secondsIn) this.secondsOut = this.secondsIn;
        },
        setFrameOut(frameNum: number) {
            this.secondsOut = Math.round(frameNum);
            if (this.secondsIn > this.secondsOut) this.secondsIn = this.secondsOut;
        },
        addBookmark() {
            this.pause();
            const offset = this.currentVideoTime;
            const name = prompt(`Bookmark name for offset ${offset}:`);
            if (!name) return;
            axios.post(`/api/v0/vod/${this.vodData.basename}/bookmark`, { name: name, offset: offset }).then((response) => {
                const json: ApiResponse = response.data;
                if (json.message) alert(json.message);
                console.log(json);
                if (this.uuid) this.store.fetchAndUpdateVod(this.uuid);
                // if (this.editVodMenu) this.editVodMenu.show = false;
            }).catch((err) => {
                console.error("form error", err.response);
                if (err.response.data && err.response.data.message) alert(err.response.data.message);
            });
        },
    },
});
</script>

<style lang="scss" scoped>
@import "../assets/_variables";

.videoplayer {
    width: 1280px;

    #timeline {
        background: #444;
        height: 20px;
        position: relative;
    }

    #timeline-cut {
        background-color: #f00;
        position: absolute;
        top: 0;
        bottom: 0;
    }

    #timeline-playhead {
        background-color: #fff;
        position: absolute;
        top: 0;
        bottom: 0;
        width: 1px;
    }
}

.videoplayer-controls {
    background-color: #222;
    padding: 0.5em;
}

.videoplayer-chapters {
    display: flex;
    width: 100%;
}

.videoplayer-chapter {
    font-family: "Roboto Condensed", "Roboto", "Arial";
    padding: 5px;
    background: rgba(128, 128, 128, 0.3);
    border-right: 1px solid #aaa;
    //flex-shrink: 1;
    //flex-grow: 1;
    word-break: break-all;
    white-space: nowrap;
    overflow: hidden;
    max-height: 100px;

    &:hover {
        background: rgba(128, 128, 128, 0.5);
        cursor: pointer;
    }
}

.videoplayer-chapter-title {
    font-weight: 700;
}

.videoplayer-chapter-game {
    font-weight: 400;
    font-size: 90%;
    color: #444;
}

.videoplayer-form {
    padding: 1em;
    margin-top: 1em;
}

.videoplayer-time {
    font-size: 120%;
    padding: 0.5em;
}

</style>