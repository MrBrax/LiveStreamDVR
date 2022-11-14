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
                        <span class="icon"><font-awesome-icon icon="play" /></span>
                        <span>{{ t('views.editor.buttons.play') }}</span>
                    </button>
                    <button
                        class="button is-confirm"
                        @click="pause"
                    >
                        <span class="icon"><font-awesome-icon icon="pause" /></span>
                        <span>{{ t('views.editor.buttons.pause') }}</span>
                    </button>
                    <button
                        type="button"
                        class="button is-confirm"
                        @click="setFrameIn(currentVideoTime)"
                    >
                        <span class="icon"><font-awesome-icon icon="fast-backward" /></span>
                        <span>{{ t('views.editor.buttons.mark-in') }}</span>
                    </button>
                    <button
                        type="button"
                        class="button is-confirm"
                        @click="setFrameOut(currentVideoTime)"
                    >
                        <span class="icon"><font-awesome-icon icon="fast-forward" /></span>
                        <span>{{ t('views.editor.buttons.mark-out') }}</span>
                    </button>
                    <button
                        class="button is-confirm"
                        @click="addBookmark"
                    >
                        <span class="icon"><font-awesome-icon icon="bookmark" /></span>
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
                <ul class="list chapter-list">
                    <li
                        v-for="(chapter, i) in vodData.chapters"
                        :key="i"
                    >
                        <a
                            v-if="chapter.offset !== undefined && chapter.duration !== undefined"
                            @click="scrub(chapter.offset || 0, chapter.duration || 0)"
                        >
                            <div class="chapter-time">
                                {{ formatDuration(chapter.offset) }} - {{ formatDuration(chapter.offset + chapter.duration) }} ({{ formatDuration(chapter.duration) }})
                            </div> 
                            <div class="chapter-game">
                                <img :src="chapter.image_url" height="20" />
                                {{ chapter.game_name }}
                            </div>
                            <div class="chapter-title text-overflow">{{ chapter.title }}</div>
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
                                type="number"
                                step="1"
                                min="0"
                                :max="videoDuration"
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
                                type="number"
                                step="1"
                                min="0"
                                :max="videoDuration"
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
                                <span class="icon"><font-awesome-icon icon="save" /></span>
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
        <LoadingBox v-else />
    </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import TwitchVOD from "@/core/Providers/Twitch/TwitchVOD";
import { useStore } from "@/store";
import type { ApiResponse, ApiVodResponse } from "@common/Api/Api";
import { formatDuration, humanDuration, formatBytes } from "@/mixins/newhelpers";
import { library } from "@fortawesome/fontawesome-svg-core";
import { faPlay, faPause, faBookmark, faFastBackward, faFastForward } from "@fortawesome/free-solid-svg-icons";
import type { BaseVODChapter } from "@/core/Providers/Base/BaseVODChapter";
import { useI18n } from "vue-i18n";
import axios from "axios";
import { useRoute } from "vue-router";
import YouTubeVOD from "@/core/Providers/YouTube/YouTubeVOD";
import type { VODTypes } from "@/twitchautomator";
library.add(faPlay, faPause, faBookmark, faFastBackward, faFastForward);

const props = defineProps<{
    uuid: string;
}>();

const store = useStore();
const { t } = useI18n();
const route = useRoute();

const vodData = ref<VODTypes | undefined>(undefined);
const secondsIn = ref<number>(0);
const secondsOut = ref<number>(0);
const currentVideoTime = ref<number>(0);
const cutName = ref<string>("");
const formStatusText = ref<string>("Ready");
const formStatus = ref<string>("");
const videoDuration = ref<number>(0);

const player = ref<HTMLVideoElement | null>(null);
const timeline = ref<HTMLDivElement | null>(null);

const timelineCutStyle = computed((): Record<string, string> => {
    if (!currentVideoTime.value || !player.value) return { left: "0%", right: "100%" };
    const dur = player.value.duration;
    return {
        left: (secondsIn.value / dur) * 100 + "%",
        right: 100 - (secondsOut.value / dur) * 100 + "%",
    };
});

const timelinePlayheadStyle = computed((): Record<string, string> => {
    if (!currentVideoTime.value || !player.value) return { left: "0%" };
    const percent = (currentVideoTime.value / (player.value).duration) * 100;
    return {
        left: percent + "%",
    };
});

const formStatusClass = computed((): Record<string, boolean> => {
    return {
        "form-status": true,
        "is-error": formStatus.value == "ERROR",
        "is-success": formStatus.value == "OK",
    };
});

const cutSegmentlength = computed((): number => {
    if (secondsIn.value === undefined || secondsOut.value === undefined) return 0;
    return (secondsOut.value - secondsIn.value);
});

const exportSize = computed((): number => {
    if (secondsIn.value === undefined || secondsOut.value === undefined) return 0;
    if (!vodData.value || vodData.value.segments.length == 0) return 0;
    const duration = secondsOut.value - secondsIn.value;
    const original_size = vodData.value.segments[0].filesize;
    if (!original_size) return 0;
    return Math.round(original_size * (duration / videoDuration.value));
});

const videoSource = computed((): string => {
    if (!vodData.value) return "";
    return `${vodData.value.webpath}/${vodData.value.basename}.mp4`
});

const chapterSource = computed((): string => {
    if (!vodData.value) return "";
    return `${vodData.value.webpath}/${vodData.value.basename}.chapters.vtt`;
});

// videoDuration(): number {
//     const player = player.value;
//     if (!player) return 0;
//     return player.duration;
// },

onMounted(() => {
    fetchData();
});
    
function fetchData() {
    // vodData.value = [];
    /** TODO: axios */
    axios
        .get<ApiVodResponse>(`/api/v0/vod/${props.uuid}`)
        .then((response) => {
            const json = response.data;
            if (json.data.provider == "twitch") {
                vodData.value = TwitchVOD.makeFromApiResponse(json.data);
            } else {
                vodData.value = YouTubeVOD.makeFromApiResponse(json.data);
            }
            setTimeout(() => {
                setupPlayer();
            }, 500);
        })
        .catch((err) => {
            console.error("about error", err.response);
        });
}
function setupPlayer() {
    if (route.query.start !== undefined) {
        if (player.value) player.value.currentTime = parseInt(route.query.start as string);
        if (route.query.start !== undefined) secondsIn.value = parseInt(route.query.start as string);
        if (route.query.end !== undefined) secondsOut.value = parseInt(route.query.end as string);
    }
}

function play() {
    if (!player.value) return;
    console.log("play", player.value);
    player.value.play();
}

function pause() {
    if (!player.value) return;
    console.log("pause", player.value);
    player.value.pause();
}

function scrub(tIn: number, tOut: number) {
    // const gameOffset = vodData.value.game_offset; // TODO: why
    const gameOffset = 0;
    secondsIn.value = Math.round(tIn - gameOffset);
    secondsOut.value = Math.round(tIn + tOut - gameOffset);
    // this.$forceUpdate();
}

function seek(event: MouseEvent) {
    console.log("seek", event);
    if (!player.value || !timeline.value) return;
    const duration = player.value.duration;
    const rect = timeline.value.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / timeline.value.clientWidth;
    const seconds = Math.round(duration * percent);
    player.value.currentTime = seconds;

    // this.$forceUpdate();
}

function videoTimeUpdate(event: Event) {
    // console.log(v);
    currentVideoTime.value = (event.target as HTMLVideoElement).currentTime;
}

function videoCanPlay(event: Event) {
    console.log("can play", event);
    videoDuration.value = (event.target as HTMLVideoElement).duration;
}

function videoSeeked(event: Event) {
    console.log("seeked", event);
}

function videoError(event: Event) {
    console.error("video error", event);
    alert("Video error, does the video exist?");
}

function submitForm(event: Event) {

    if (!vodData.value) return;

    formStatusText.value = t("messages.loading");
    formStatus.value = "";

    const inputs = {
        vod: vodData.value.basename,
        time_in: secondsIn.value,
        time_out: secondsOut.value,
        name: cutName.value,
    };

    axios
        .post<ApiResponse>(`/api/v0/vod/${props.uuid}/cut`, inputs)
        .then((response) => {
            const json = response.data;
            formStatusText.value = json.message || "No message";
            formStatus.value = json.status;
            if (json.status == "OK") {
                // this.$emit("formSuccess", json);
            }
        })
        .catch((err) => {
            const json = err.response.data;
            console.error("form error", err.response);
            formStatus.value = json.status;
            formStatusText.value = json.message;
        });

    event.preventDefault();
    return false;
}

function chapterWidth(chapter: BaseVODChapter): number {
    if (!player.value) return 0;
    // const chapterOffset = chapter.offset || 0;
    const chapterDuration = chapter.duration || 0;
    const videoDuration = player.value.duration;
    const width = (chapterDuration / videoDuration) * 100;
    return width;
}

function setFrameIn(frameNum: number) {
    secondsIn.value = Math.round(frameNum);
    if (secondsOut.value < secondsIn.value) secondsOut.value = secondsIn.value;
}

function setFrameOut(frameNum: number) {
    secondsOut.value = Math.round(frameNum);
    if (secondsIn.value > secondsOut.value) secondsIn.value = secondsOut.value;
}

function addBookmark() {
    if (!vodData.value) return;
    pause();
    const offset = currentVideoTime.value;
    const name = prompt(`Bookmark name for offset ${offset}:`);
    if (!name) return;
    axios.post<ApiResponse>(`/api/v0/vod/${vodData.value.basename}/bookmark`, { name: name, offset: offset }).then((response) => {
        const json = response.data;
        if (json.message) alert(json.message);
        console.log(json);
        if (props.uuid) store.fetchAndUpdateVod(props.uuid);
        // if (this.editVodMenu) this.editVodMenu.show = false;
    }).catch((err) => {
        console.error("form error", err.response);
        if (err.response.data && err.response.data.message) alert(err.response.data.message);
    });
}
    
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

.chapter-list li {
    &:not(:last-child) {
        margin-bottom: 0.75em;
    }
}

.chapter-list a {
    display: block;
    padding: 0.5em;
    &:hover {
        background-color: rgba(128, 128, 128, 0.1);
    }
}

.chapter-time {
    font-weight: 700;
}

.chapter-list span {
    display: inline-block;
    margin-right: 0.3em;
}

.chapter-game img {
    vertical-align: middle;
}

</style>