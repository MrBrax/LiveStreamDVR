<template>
    <div class="container">
        <div class="videoplayer" v-if="vodData && vodData.basename">
            <video id="video" ref="player" :src="vodData.webpath + '/' + vodData.basename + '.mp4'" @timeupdate="updateVideoTime" width="1280">
                <track kind="chapters" :src="vodData.webpath + '/' + vodData.basename + '.chapters.vtt'" label="Chapters" default />
            </video>
            <div id="videoplayer-controls">
                <button class="button" @click="play">Play</button>
                <button class="button" @click="pause">Pause</button>
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

            <div class="videoplayer-form">
                <form method="POST" enctype="multipart/form-data" action="#" @submit="submitForm">
                    <input type="hidden" name="vod" value="{{ vodData.basename }}" />

                    <div class="field">
                        <div class="control">
                            <button type="button" class="button" @click="setFrameIn(currentVideoTime)">Mark in</button>
                            <input class="input" name="time_in" v-model="frameIn" placeholder="In timestamp" />
                        </div>
                    </div>

                    <div class="field">
                        <div class="control">
                            <button type="button" class="button" @click="setFrameOut(currentVideoTime)">Mark out</button>
                            <input class="input" name="time_out" v-model="frameOut" placeholder="Out timestamp" />
                        </div>
                    </div>

                    <div class="field">
                        <div class="control"><strong>Duration:</strong> {{ cutSegmentlength > 0 ? humanDuration(cutSegmentlength) : "Error" }}</div>
                    </div>

                    <div class="field">
                        <div class="control">
                            <input class="input" type="text" name="name" v-model="cutName" placeholder="Name (optional)" />
                        </div>
                    </div>

                    <div class="field">
                        <div class="control">
                            <button type="submit" class="button">Submit cut</button>
                            <span :class="formStatusClass">{{ formStatusText }}</span>
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
            <span class="icon"><fa icon="sync" spin></fa></span> {{ $t("messages.loading") }}
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { TwitchVODChapter } from "@/core/chapter";
import TwitchVOD from "@/core/vod";

export default defineComponent({
    name: "EditorView",
    title: "Editor",
    data() {
        return {
            vodData: {} as TwitchVOD,
            frameIn: 0,
            frameOut: 0,
            currentVideoTime: 0,
            cutName: "",
            formStatusText: "Ready",
            formStatus: "",
            // videoDuration: 0,
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
                if (this.$route.query.start !== undefined) this.frameIn = parseInt(this.$route.query.start as string);
                if (this.$route.query.end !== undefined) this.frameOut = parseInt(this.$route.query.end as string);
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
            this.frameIn = Math.round(tIn - gameOffset);
            this.frameOut = Math.round(tIn + tOut - gameOffset);
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
        updateVideoTime(event: Event) {
            // console.log(v);
            this.currentVideoTime = (event.target as HTMLVideoElement).currentTime;
        },
        submitForm(event: Event) {

            this.formStatusText = this.$t("messages.loading");
            this.formStatus = "";

            const inputs = {
                vod: this.vodData.basename,
                time_in: this.frameIn,
                time_out: this.frameOut,
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
            this.frameIn = Math.round(frameNum);
        },
        setFrameOut(frameNum: number) {
            this.frameOut = Math.round(frameNum);
        },
    },
    computed: {
        timelineCutStyle(): Record<string, string> {
            if (!this.currentVideoTime) return { left: "0%", right: "100%" };
            const dur = (this.$refs.player as HTMLVideoElement).duration;
            return {
                left: (this.frameIn / dur) * 100 + "%",
                right: 100 - (this.frameOut / dur) * 100 + "%",
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
            if (!this.vodData.video_metadata || this.vodData.video_metadata.type == "audio") return 0;
            const fps = this.vodData.video_metadata?.fps;
            return (this.frameOut - this.frameIn) / fps;
        },
    },
});
</script>
