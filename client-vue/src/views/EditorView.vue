<template>
    <div class="container">
        <div class="videoplayer" v-if="vodData && vodData.basename">
            <video id="video" ref="player" :src="vodData.webpath + '/' + vodData.basename + '.mp4'" @timeupdate="updateVideoTime" width="1280"></video>
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
                    :style="{ width: chapter.width + '%' }"
                    @click="scrub(chapter.offset, chapter.duration)"
                >
                    <div class="videoplayer-chapter-title">{{ chapter.title }}</div>
                    <div class="videoplayer-chapter-game">{{ chapter.game_name }}</div>
                </div>
            </div>

            <div class="videoplayer-cut">
                <form method="POST" enctype="multipart/form-data" action="#" @submit="submitForm">
                    <input type="hidden" name="vod" value="{{ vodData.basename }}" />

                    <div>
                        <button type="button" class="button" @click="timeIn = Math.round(currentVideoTime)">Mark in</button>
                        <input class="input" name="time_in" v-model="timeIn" placeholder="In timestamp" />
                    </div>

                    <div>
                        <button type="button" class="button" @click="timeOut = Math.round(currentVideoTime)">Mark out</button>
                        <input class="input" name="time_out" v-model="timeOut" placeholder="Out timestamp" />
                    </div>

                    <div>
                        <input class="input" type="text" name="name" v-model="cutName" placeholder="Name (optional)" />
                    </div>

                    <div>
                        <button type="submit" class="button">Submit cut</button>
                        <span :class="formStatusClass">{{ formStatusText }}</span>
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
            <span class="icon"><fa icon="sync" spin></fa></span> Loading...
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import type { ApiVod } from "@/twitchautomator.d";

export default defineComponent({
    name: "EditorView",
    title: "Editor",
    data() {
        return {
            vodData: {} as ApiVod,
            timeIn: 0,
            timeOut: 0,
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
            /** @todo: axios */
            this.$http
                .get(`/api/v0/vod/${this.vod}`)
                .then((response) => {
                    const json = response.data;
                    this.vodData = json.data;
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
            const gameOffset = this.vodData.game_offset;
            this.timeIn = Math.round(tIn - gameOffset);
            this.timeOut = Math.round(tIn + tOut - gameOffset);
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
            console.log("submit", this.timeIn, this.timeOut, this.cutName);

            const form = event.target as HTMLFormElement;
            const inputs = new FormData(form);

            this.formStatusText = "Loading...";
            this.formStatus = "";

            console.log("form", form);
            console.log("entries", inputs, inputs.entries(), inputs.values());

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
                    console.error("form error", err.response);
                });

            event.preventDefault();
            return false;
        },
    },
    computed: {
        timelineCutStyle(): Record<string, string> {
            if (!this.currentVideoTime) return { left: "0%", right: "100%" };
            const dur = (this.$refs.player as HTMLVideoElement).duration;
            return {
                left: (this.timeIn / dur) * 100 + "%",
                right: 100 - (this.timeOut / dur) * 100 + "%",
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
    },
});
</script>
