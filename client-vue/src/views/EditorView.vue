<template>
    <div class="container">
        <div class="videoplayer" v-if="vodData && vodData.basename">
            <video
                id="video"
                ref="player"
                :src="vodData.webpath + '/' + vodData.basename + '.mp4'"
                @timeupdate="videoTimeUpdate"
                width="1280"
                @canplay="videoCanPlay"
                @seeked="videoSeeked"
                @error="videoError"
            >
                <track kind="chapters" :src="vodData.webpath + '/' + vodData.basename + '.chapters.vtt'" label="Chapters" default />
            </video>
            <div class="videoplayer-time">
                <span v-if="videoDuration">
                    {{ formatDuration(currentVideoTime) }} / {{ videoDuration ? formatDuration(videoDuration) : '-' }}
                </span>
                <span v-else>{{ $t("messages.loading")}}</span>
            </div>
            <div class="videoplayer-controls">
                <div class="buttons">
                    <button class="button is-confirm" @click="play">
                        <span class="icon"><fa icon="play" /></span>
                        <span>{{ $t('views.editor.buttons.play') }}</span>
                    </button>
                    <button class="button is-confirm" @click="pause">
                        <span class="icon"><fa icon="pause" /></span>
                        <span>{{ $t('views.editor.buttons.pause') }}</span>
                    </button>
                    <button type="button" class="button is-confirm" @click="setFrameIn(currentVideoTime)">
                        <span class="icon"><fa icon="fast-backward" /></span>
                        <span>{{ $t('views.editor.buttons.mark-in') }}</span>
                    </button>
                    <button type="button" class="button is-confirm" @click="setFrameOut(currentVideoTime)">
                        <span class="icon"><fa icon="fast-forward" /></span>
                        <span>{{ $t('views.editor.buttons.mark-out') }}</span>
                    </button>
                    <button class="button is-confirm" @click="addBookmark">
                        <span class="icon"><fa icon="bookmark" /></span>
                        <span>{{ $t('views.editor.buttons.add-bookmark') }}</span>
                    </button>
                </div>
            </div>
            <div id="timeline" ref="timeline" @click="seek">
                <div id="timeline-cut" v-bind:style="timelineCutStyle"></div>
                <div id="timeline-playhead" v-bind:style="timelinePlayheadStyle"></div>
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
                    <div class="videoplayer-chapter-title">{{ chapter.title }}</div>
                    <div class="videoplayer-chapter-game">{{ chapter.game_name }}</div>
                </div>
            </div>

            <div>
                <ul class="list">
                    <li v-for="(chapter, i) in vodData.chapters" :key="i">
                        <a v-if="chapter.offset !== undefined && chapter.duration !== undefined" @click="scrub(chapter.offset || 0, chapter.duration || 0)">
                            {{ formatDuration(chapter.offset) }} - {{ formatDuration(chapter.offset + chapter.duration) }}: {{ chapter.title }}
                        </a> 
                    </li>
                </ul>
            </div>

            <div class="videoplayer-form">
                <form method="POST" enctype="multipart/form-data" action="#" @submit="submitForm">

                    <h2>{{ $t('views.editor.edit-segment') }}</h2>

                    <input type="hidden" name="vod" value="{{ vodData.basename }}" />

                    <div class="field">
                        <label for="time_in" class="label">{{ $t('views.editor.time-in') }}</label>
                        <div class="control">
                            <input class="input" id="time_in" v-model="secondsIn" placeholder="In timestamp" />
                            <p class="input-help">Timestamp in seconds</p>
                        </div>
                    </div>

                    <div class="field">
                        <label for="time_out" class="label">{{ $t('views.editor.time-out') }}</label>
                        <div class="control">
                            <input class="input" id="time_out" v-model="secondsOut" placeholder="Out timestamp" />
                            <p class="input-help">Timestamp in seconds</p>
                        </div>
                    </div>

                    <div class="field">
                        <div class="control"><strong>{{ $t('vod.video-info.duration') }}:</strong> {{ cutSegmentlength > 0 ? humanDuration(cutSegmentlength) : "None" }}</div>
                    </div>

                    <div class="field">
                        <div class="control"><strong>{{ $t('views.editor.filesize') }}:</strong> {{ exportSize ? "~" + formatBytes(exportSize) : "None" }}</div>
                    </div>

                    <div class="field">
                        <div class="control">
                            <input class="input" type="text" name="name" v-model="cutName" placeholder="Name (optional)" />
                        </div>
                    </div>

                    <div class="field form-submit">
                        <div class="control">
                            <button type="submit" class="button is-confirm">
                                <span class="icon"><fa icon="save" /></span>
                                <span>{{ $t('views.editor.buttons.submit-cut') }}</span>
                            </button>
                        </div>
                        <div :class="formStatusClass">{{ formStatusText }}</div>
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
            <span class="icon"><fa icon="sync" spin></fa></span> {{ $t("messages.loading") }}
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { TwitchVODChapter } from "@/core/Providers/Twitch/TwitchVODChapter";
import TwitchVOD from "@/core/Providers/Twitch/TwitchVOD";
import { useStore } from "@/store";
import { ApiResponse } from "@common/Api/Api";


import { library } from "@fortawesome/fontawesome-svg-core";
import { faPause, faBookmark, faFastBackward, faFastForward } from "@fortawesome/free-solid-svg-icons";
library.add(faPause, faBookmark, faFastBackward, faFastForward);

export default defineComponent({
    name: "EditorView",
    title: "Editor",
    setup() {
        const store = useStore();
        return { store };
    },
    data() {
        return {
            vodData: {} as TwitchVOD,
            secondsIn: 0,
            secondsOut: 0,
            currentVideoTime: 0,
            cutName: "",
            formStatusText: "Ready",
            formStatus: "",
            videoDuration: 0,
        };
    },
    created() {
        this.fetchData();
    },
    props: {
        vod: String,
    },
    methods: {
        fetchData() {
            // this.vodData = [];
            /** TODO: axios */
            this.$http
                .get(`/api/v0/vod/${this.vod}`)
                .then((response) => {
                    const json = response.data;
                    this.vodData = TwitchVOD.makeFromApiResponse(json.data);
                    setTimeout(() => {
                        this.setupPlayer();
                    }, 500);
                })
                .catch((err) => {
                    console.error("about error", err.response);
                });
        },
        setupPlayer() {
            if (this.$route.query.start !== undefined) {
                (this.$refs.player as HTMLVideoElement).currentTime = parseInt(this.$route.query.start as string);
                if (this.$route.query.start !== undefined) this.secondsIn = parseInt(this.$route.query.start as string);
                if (this.$route.query.end !== undefined) this.secondsOut = parseInt(this.$route.query.end as string);
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

            this.formStatusText = this.$t("messages.loading");
            this.formStatus = "";

            const inputs = {
                vod: this.vodData.basename,
                time_in: this.secondsIn,
                time_out: this.secondsOut,
                name: this.cutName,
            };

            this.$http
                .post(`/api/v0/vod/${this.vod}/cut`, inputs)
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
        chapterWidth(chapter: TwitchVODChapter): number {
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
            this.$http.post(`/api/v0/vod/${this.vodData.basename}/bookmark`, { name: name, offset: offset }).then((response) => {
                const json: ApiResponse = response.data;
                if (json.message) alert(json.message);
                console.log(json);
                if (this.vod) this.store.fetchAndUpdateVod(this.vodData.basename);
                // if (this.editVodMenu) this.editVodMenu.show = false;
            }).catch((err) => {
                console.error("form error", err.response);
                if (err.response.data && err.response.data.message) alert(err.response.data.message);
            });
        },
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
        // videoDuration(): number {
        //     const player = this.$refs.player as HTMLVideoElement;
        //     if (!player) return 0;
        //     return player.duration;
        // },
    },
});
</script>
