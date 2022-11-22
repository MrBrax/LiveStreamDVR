<template>
    <div class="container">
        <div
            v-if="vodData && vodData.basename"
            class="video-editor-wrapper"
            @mousemove="onMouseMove"
            @mouseout="onMouseOut"
            @mouseup="onMouseUp"
        >
            <div class="video-editor">
                <div class="video-editor-video">
                    <video
                        id="video"
                        ref="player"
                        :src="videoSource"
                        @timeupdate="videoTimeUpdate"
                        @canplay="videoCanPlay"
                        @seeked="videoSeeked"
                        @error="videoError"
                        @play="videoPlay"
                        @pause="videoPause"
                        @loadedmetadata="videoLoadedMetadata"
                        @loadeddata="videoLoadedData"
                        @waiting="videoWaiting"
                        @stalled="videoStalled"
                    >
                        <track
                            kind="chapters"
                            :src="chapterSource"
                            label="Chapters"
                            default
                        >
                    </video>
                </div>
                <div class="video-editor-chapter-hover">
                    <template v-if="currentChapterHoverIndex">
                        <div class="chapter-title">
                            {{ vodData.chapters[currentChapterHoverIndex].title }}
                        </div>
                        <div class="chapter-game">
                            {{ vodData.chapters[currentChapterHoverIndex].game_name }}
                        </div>
                    </template>
                </div>

                <div
                    id="timeline"
                    ref="timeline"
                    @click="seekMouseHandler"
                    @mousemove="timelineMouseMove"
                    @mouseenter="timelineHover = true"
                    @mouseleave="timelineMouseLeave"
                >
                    <div
                        class="timeline-playhead"
                        :style="timelinePlayheadStyle"
                    />
                    <div
                        v-if="cutSegmentlength > 0"
                        class="timeline-cut"
                        :style="timelineCutStyle"
                    />
                    <div class="video-editor-chapters">
                        <div
                            v-for="(chapter, chapterIndex) in vodData.chapters"
                            :key="chapterIndex"
                            class="video-editor-chapter"
                            :style="chapterStyle(chapterIndex, chapter)"
                        />
                    </div>
                    <div
                        v-if="timelineHover"
                        class="timeline-hover"
                        :style="timelineSeekHoverBarStyle"
                    />
                </div>

                <div class="video-editor-cut">
                    <div
                        v-if="cutSegmentlength > 0"
                        class="video-editor-cut-display"
                        :style="cutDisplayStyle"
                    >
                        <div
                            class="drag-handle in"
                            :class="{ 'is-active': isDraggingInPoint }"
                            @mousedown="isDraggingInPoint = true"
                            @mouseup="isDraggingInPoint = false"
                        />
                        <div
                            class="drag-handle out"
                            :class="{ 'is-active': isDraggingOutPoint }"
                            @mousedown="isDraggingOutPoint = true"
                            @mouseup="isDraggingOutPoint = false"
                        />
                        <div class="duration">
                            {{ humanDuration(cutSegmentlength) }}
                        </div>
                        <div class="size">
                            {{ formatBytes(exportSize) }}
                        </div>
                    </div>
                </div>

                <div class="video-editor-time">
                    <span v-if="videoDuration">
                        <span class="icon">
                            <font-awesome-icon
                                :icon="videoStatusIcon"
                                :spin="videoStatus == 'loading'"
                            />
                        </span>
                        {{ humanDuration(currentVideoTime) }} / {{ videoDuration ? humanDuration(videoDuration) : '-' }}
                    </span>
                    <span v-else>
                        <span class="icon">
                            <font-awesome-icon
                                icon="spinner"
                                spin
                            />
                        </span>
                        {{ t("messages.loading") }}
                    </span>
                </div>

                <div class="video-editor-controls">
                    <div class="buttons no-margin">
                        <d-button
                            type="button"
                            color="success"
                            icon="play"
                            @click="play"
                        >
                            {{ t('views.editor.buttons.play') }}
                        </d-button>
                        <d-button
                            type="button"
                            color="success"
                            icon="pause"
                            @click="pause"
                        >
                            {{ t('views.editor.buttons.pause') }}
                        </d-button>
                        <d-button
                            type="button"
                            color="success"
                            icon="backward-step"
                            @click="seekRelative(-1)"
                        >
                            {{ t('views.editor.buttons.step-back') }}
                        </d-button>
                        <d-button
                            type="button"
                            color="success"
                            icon="forward-step"
                            @click="seekRelative(1)"
                        >
                            {{ t('views.editor.buttons.step-forward') }}
                        </d-button>
                        <d-button
                            type="button"
                            color="success"
                            icon="fast-backward"
                            :disabled="secondsIn == Math.round(currentVideoTime)"
                            @click="setFrameIn(currentVideoTime)"
                        >
                            {{ t('views.editor.buttons.mark-in') }}
                        </d-button>
                        <d-button
                            type="button"
                            color="success"
                            icon="fast-forward"
                            :disabled="secondsOut == Math.round(currentVideoTime)"
                            @click="setFrameOut(currentVideoTime)"
                        >
                            {{ t('views.editor.buttons.mark-out') }}
                        </d-button>
                        <d-button
                            type="button"
                            color="success"
                            icon="bookmark"
                            @click="addBookmark"
                        >
                            {{ t('views.editor.buttons.add-bookmark') }}
                        </d-button>
                        <d-button
                            type="button"
                            color="success"
                            icon="expand"
                            @click="fullscreen"
                        >
                            {{ t('views.editor.buttons.fullscreen') }}
                        </d-button>
                        <d-button
                            type="button"
                            :icon="previewClip ? 'eye' : 'eye-slash'"
                            :class="{ 'is-confirm': previewClip, 'is-danger': !previewClip }"
                            @click="previewClip = !previewClip"
                        >
                            {{ t('views.editor.buttons.preview') }}
                        </d-button>
                    </div>
                </div>

                <div
                    v-if="timelineHover"
                    ref="hoverTimeTooltip"
                    class="video-editor-hover-time"
                    :style="timelineSeekTooltipStyle"
                >
                    {{ humanDuration(hoverTime) }}
                </div>

                <!--{{ currentVideoTime }} / {{ $refs.player ? $refs.player.currentTime : 'init' }} / {{ $refs.player ? $refs.player.duration : 'init' }}-->
            </div>

            <div class="video-editor-help">
                <p>
                    Note that video cuts are not frame perfect. Make sure to verify the end result. 
                </p>
            </div>

            <div class="video-editor-chapter-list">
                <h2>Chapters</h2>
                <ul class="list">
                    <li
                        v-for="(chapter, i) in vodData.chapters"
                        :key="i"
                    >
                        <a
                            v-if="chapter.offset !== undefined && chapter.duration !== undefined"
                            @click="setCutpoints(chapter.offset || 0, chapter.duration || 0)"
                        >
                            <div class="chapter-time">
                                {{ humanDuration(chapter.offset) }} - {{ humanDuration(chapter.offset + chapter.duration) }} ({{ humanDuration(chapter.duration) }})
                            </div> 
                            <div class="chapter-game">
                                <img
                                    :src="chapter.image_url"
                                    height="20"
                                >
                                {{ chapter.game_name }}
                            </div>
                            <div class="chapter-title text-overflow">{{ chapter.title }}</div>
                        </a> 
                    </li>
                </ul>
            </div>

            <!--{{ videoSource }}-->

            <div class="video-editor-form">
                <h2>{{ t('views.editor.edit-segment') }}</h2>
                <form
                    method="POST"
                    enctype="multipart/form-data"
                    action="#"
                    @submit="submitForm"
                >
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

                    <FormSubmit
                        :form-status="formStatus"
                        :form-status-text="formStatusText"
                    >
                        <div class="control">
                            <d-button
                                type="submit"
                                class="button is-confirm"
                                color="success"
                                icon="scissors"
                                :disabled="!cutSegmentlength"
                            >
                                {{ t('views.editor.buttons.submit-cut') }}
                            </d-button>
                        </div>
                    </FormSubmit>
                </form>
            </div>
        </div>
        <LoadingBox v-else />
    </div>
</template>

<script lang="ts" setup>
import FormSubmit from "@/components/reusables/FormSubmit.vue";
import type { BaseVODChapter } from "@/core/Providers/Base/BaseVODChapter";
import TwitchVOD from "@/core/Providers/Twitch/TwitchVOD";
import YouTubeVOD from "@/core/Providers/YouTube/YouTubeVOD";
import { formatBytes, humanDuration } from "@/mixins/newhelpers";
import { useStore } from "@/store";
import type { FormStatus, VODTypes } from "@/twitchautomator";
import type { ApiResponse, ApiVodResponse } from "@common/Api/Api";
import { library } from "@fortawesome/fontawesome-svg-core";
import { faBookmark, faFastBackward, faFastForward, faPause, faPlay, faScissors, faSpinner, faStop, faExpand, faBackwardStep, faForwardStep, faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import axios from "axios";
import { computed, onMounted, ref, watch, type HTMLAttributes } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
library.add(faPlay, faPause, faBookmark, faFastBackward, faFastForward, faSpinner, faScissors, faStop, faExpand, faBackwardStep, faForwardStep, faEye, faEyeSlash);

const props = defineProps<{
    uuid: string;
}>();

const store = useStore();
const { t } = useI18n();
const route = useRoute();

type VideoStatus = "loading" | "playing" | "paused" | "finished" | "stopped" | "error" | "seeking";

const vodData = ref<VODTypes | undefined>(undefined);
const secondsIn = ref<number>(0);
const secondsOut = ref<number>(0);
const currentVideoTime = ref<number>(0);
const cutName = ref<string>("");
const formStatusText = ref<string>("Ready");
const formStatus = ref<FormStatus>("IDLE");
const videoDuration = ref<number>(0);
const hasBeenSetup = ref<boolean>(false);
const timelineHover = ref<boolean>(false);
const hoverTime = ref<number>(0);
const videoStatus = ref<VideoStatus>("loading");
const previewClip = ref<boolean>(false);
const isDraggingInPoint = ref<boolean>(false);
const isDraggingOutPoint = ref<boolean>(false);
const currentChapterHoverIndex = ref<number | undefined>(undefined);

const player = ref<HTMLVideoElement | null>(null);
const timeline = ref<HTMLDivElement | null>(null);
const hoverTimeTooltip = ref<HTMLDivElement | null>(null);

const timelineCutStyle = computed((): HTMLAttributes["style"] => {
    if (!secondsIn.value && !secondsOut.value) return { display: "none" };
    const dur = videoDuration.value;
    return {
        left: (secondsIn.value / dur) * 100 + "%",
        right: 100 - (secondsOut.value / dur) * 100 + "%",
    };
});

const timelinePlayheadStyle = computed((): HTMLAttributes["style"] => {
    if (!currentVideoTime.value || !videoDuration.value) return { left: "0%" };
    const percent = (currentVideoTime.value / (videoDuration.value)) * 100;
    return {
        width: `${percent}%`,
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

const videoStatusIcon = computed((): string => {
    switch (videoStatus.value) {
        case "loading":
            return "spinner";
        case "playing":
            return "play";
        case "paused":
            return "pause";
        case "finished":
            return "stop";
        case "stopped":
            return "stop";
        case "error":
            return "play";
        case "seeking":
            return "spinner";
    }
    return "play";
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
            // setTimeout(() => {
            //     setupPlayer();
            // }, 500);
        })
        .catch((err) => {
            console.error("about error", err.response);
        });
}

function setupPlayer(): void {
    if (route.query.start !== undefined && !hasBeenSetup.value) {
        if (player.value) player.value.currentTime = parseInt(route.query.start as string);
        if (route.query.start !== undefined) secondsIn.value = parseInt(route.query.start as string);
        if (route.query.end !== undefined) secondsOut.value = parseInt(route.query.end as string);
        hasBeenSetup.value = true;
    }
}

function play(): void {
    if (!player.value) return;
    console.log("play", player.value);
    player.value.play();
}

function pause(): void {
    if (!player.value) return;
    console.log("pause", player.value);
    player.value.pause();
}

function setCutpoints(tIn: number, tOut: number): void {
    // const gameOffset = vodData.value.game_offset; // TODO: why
    const gameOffset = 0;

    if (secondsIn.value !== 0 && secondsOut.value !== 0) {
        if (!confirm(t("views.editor.confirm-cutpoints"))) return;
    }
    secondsIn.value = Math.round(tIn - gameOffset);
    secondsOut.value = Math.min(Math.round(tIn + tOut - gameOffset), videoDuration.value);
    console.debug("setCutpoints", secondsIn.value, secondsOut.value);
}

function seekMouseHandler(event: MouseEvent): void {
    console.log("seek", event);
    if (!player.value || !timeline.value) return;
    const rect = timeline.value.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / timeline.value.clientWidth;
    const seconds = Math.round(videoDuration.value * percent);
    
    if (previewClip.value && (seconds > secondsOut.value || seconds < secondsIn.value)) {
        previewClip.value = false; // stop preview
    }
    
    seekAbsolute(seconds);
    
}

function seekAbsolute(seconds: number): void {
    if (!player.value) return;
    player.value.currentTime = seconds;
}

function seekRelative(seconds: number): void {
    if (!player.value) return;
    player.value.currentTime += seconds;
}

function timelineMouseMove(event: MouseEvent): void {
    if (!player.value || !timeline.value) return;
    const rect = timeline.value.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / timeline.value.clientWidth;
    const seconds = Math.round(videoDuration.value * percent);
    hoverTime.value = seconds;

    if (vodData.value) {
        const idx = vodData.value.chapters.findIndex((chapter, i) => {
            const o = i == 0 ? 0 : (chapter.offset || 0);
            return chapter.offset && chapter.duration && seconds >= o && seconds < o + chapter.duration;
        });
        if (idx !== -1) {
            currentChapterHoverIndex.value = idx;
        } else {
            currentChapterHoverIndex.value = undefined;
        }
    }
}

function timelineMouseLeave(): void {
    currentChapterHoverIndex.value = undefined;
    timelineHover.value = false;
}

const timelineSeekHoverBarStyle = computed((): HTMLAttributes["style"] => {
    if (!player.value || !timeline.value) return { left: "0%" };
    const percent = (hoverTime.value / videoDuration.value) * 100;
    return {
        left: percent + "%",
        // transform: `translateX(${percent}%)`,
    };
});

const timelineSeekTooltipStyle = computed((): HTMLAttributes["style"] => {
    if (!player.value || !timeline.value || !hoverTimeTooltip.value) return { left: "0%" };
    const percent = (hoverTime.value / videoDuration.value) * 100;

    const timeline_bound = timeline.value.getBoundingClientRect();
    const hover_bound = hoverTimeTooltip.value.getBoundingClientRect();

    const offset = timeline.value.getBoundingClientRect().left + timeline.value.clientWidth * (percent / 100);

    return {
        left: `${offset - hover_bound.width / 2}px`,
        top: `${timeline_bound.top - hover_bound.height - 3}px`,
        // transform: `translateX(${percent}%)`,
    };
});

const cutDisplayStyle = computed((): HTMLAttributes["style"] => {
    if (!secondsIn.value && !secondsOut.value) return { display: "none" };
    return {
        left: (secondsIn.value / videoDuration.value) * 100 + "%",
        right: 100 - (secondsOut.value / videoDuration.value) * 100 + "%",
    };
});

// Video hooks

function videoTimeUpdate(event: Event): void {
    // console.log(v);
    currentVideoTime.value = (event.target as HTMLVideoElement).currentTime;
    if (previewClip.value && currentVideoTime.value >= secondsOut.value) {
        seekAbsolute(secondsIn.value);
    }
}

function videoCanPlay(event: Event): void {
    console.debug("can play", event);
    // videoDuration.value = (event.target as HTMLVideoElement).duration;
}

function videoLoadedMetadata(event: Event): void {
    console.debug("loaded metadata", event);
    setupPlayer();
    videoDuration.value = (event.target as HTMLVideoElement).duration;
    videoStatus.value = "stopped";
    console.debug("video duration", videoDuration.value);
}

function videoLoadedData(event: Event): void {
    console.debug("loaded data", event);
}

function videoWaiting(event: Event): void {
    console.debug("waiting", event);
    videoStatus.value = "loading";
}

function videoSeeked(event: Event): void {
    console.debug("seeked", event);
    videoStatus.value = player.value && player.value.paused ? "paused" : "playing";
}

function videoError(event: Event): void {
    console.error("video error", event);
    alert("Video error, does the video exist?");
}

function videoPlay(event: Event): void {
    console.debug("play", event);
    videoStatus.value = "playing"
}

function videoPause(event: Event): void {
    console.debug("pause", event);
    videoStatus.value = "paused";
}

function videoStalled(event: Event): void {
    console.debug("stalled", event);
    // videoStatus.value = "loading";
}

function submitForm(event: Event): void {

    if (!vodData.value) return;

    formStatus.value = "LOADING";

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
}

function chapterWidth(chapter: BaseVODChapter): number {
    // const chapterOffset = chapter.offset || 0;
    const chapterDuration = chapter.duration || 0;
    const width = (chapterDuration / videoDuration.value) * 100;
    return width;
}

function setFrameIn(frameNum: number): void {
    secondsIn.value = Math.round(frameNum);
    if (secondsOut.value < secondsIn.value) secondsOut.value = secondsIn.value;
}

function setFrameOut(frameNum: number): void {
    secondsOut.value = Math.round(frameNum);
    if (secondsIn.value > secondsOut.value) secondsIn.value = secondsOut.value;
}

function addBookmark(): void {
    if (!vodData.value) return;
    pause();
    const offset = currentVideoTime.value;
    const name = prompt(`Bookmark name for offset ${offset}:`);
    if (!name) return;
    axios.post<ApiResponse>(`/api/v0/vod/${vodData.value.uuid}/bookmark`, { name: name, offset: offset }).then((response) => {
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

function fullscreen(): void {
    if (!player.value) return;
    if (player.value.requestFullscreen) {
        player.value.requestFullscreen();
    } else {
        alert("Fullscreen not supported");
    }
}

function onMouseMove(event: MouseEvent): void {
    if (!timeline.value) return;
    if (isDraggingInPoint.value) {
        const percent = (event.clientX - timeline.value.getBoundingClientRect().left) / timeline.value.clientWidth;
        const seconds = Math.round(percent * videoDuration.value);
        setFrameIn(seconds);
    } else if (isDraggingOutPoint.value) {
        const percent = (event.clientX - timeline.value.getBoundingClientRect().left) / timeline.value.clientWidth;
        const seconds = Math.round(percent * videoDuration.value);
        setFrameOut(seconds);
    }
}

function onMouseUp(event: MouseEvent): void {
    isDraggingInPoint.value = false;
    isDraggingOutPoint.value = false;
}

function onMouseOut(event: MouseEvent): void {
    // console.debug("mouse out", event.target);
    // isDraggingInPoint.value = false;
    // isDraggingOutPoint.value = false;
}

watch(() => previewClip.value, (clip) => {
    if (!clip) return;
    seekAbsolute(secondsIn.value);
});

function chapterStyle(index: number, chapter: BaseVODChapter): HTMLAttributes["style"] {
    const chapterOffset = index == 0 ? 0 : (chapter.offset || 0);
    const chapterDuration = chapter.duration || 0;
    const left = (chapterOffset / videoDuration.value) * 100;
    // cap width at duration
    const width = Math.min((chapterDuration / videoDuration.value) * 100, 100 - left);
    return {
        left: `${left}%`,
        width: `${width}%`,
    };
}

</script>

<style lang="scss" scoped>
@import "../assets/_variables";

.video-editor-wrapper {
    // width: 1280px;
    margin: auto;

    #timeline {
        background: var(--section-title-hover-background-color);
        height: 2em;
        position: relative;
        border-radius: 0.5em;
        overflow: hidden;
        cursor: pointer;
    }

    .timeline-cut {
        // background-color: rgba(255, 0, 0, 0.7);
        border-left: 1px solid rgba(255, 0, 0, 0.4);
        border-right: 1px solid rgba(255, 0, 0, 0.4);
        position: absolute;
        top: 0;
        height: 100%;
        // transition: all 0.2s ease-in-out;
        // bottom: 0;

        // scrolling stripes background
        background-image: linear-gradient(45deg, rgba(220, 50, 20, 0.7) 25%, transparent 25%, transparent 50%, rgba(220, 50, 20, 0.7) 50%, rgba(220, 50, 20, 0.7) 75%, transparent 75%, transparent);
        background-size: 2em 2em;
        animation: stripes 6s linear infinite;
    }

    // #timeline:hover > .timeline-cut {
    //     height: 50%;
    // }

    .timeline-playhead {
        background-color: #45ee45;
        background-image: linear-gradient(to bottom, #45ee45, #1ecc1e);
        border-right: 1px solid #000;
        position: absolute;
        top: 0;
        bottom: 0;
        left: 0;
        pointer-events: none;
        //width: 1px;
    }
}

@keyframes stripes {
    0% {
        background-position: 0 0;
    }
    100% {
        background-position: -2em 2em;
    }
}

.video-editor {
    margin: 1em auto;
    width: 60vw;
    padding: 1em;
    background: var(--section-background-color);
    // border: 1px solid #444;
    border-radius: 1em;
    box-shadow: 0 5px 20px rgba(0, 0, 0, 0.2);
    box-sizing: content-box;
    #video {
        width: 100%;
        height: auto;
        background: #000;
    }
    .video-editor-container {
        width: 100%;
        height: auto;
        background: #000;
    }
}

.timeline-hover {
    background-color: #fff;
    // box-shadow: 0 0 3px 1px rgba(255, 255, 255, 1);
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    pointer-events: none;
}

.video-editor-cut {
    position: relative;
    height: 2em;
}

.video-editor-cut-display {
    position: absolute;
    // overflow: hidden;
    text-align: center;
    padding: 0.2em;
    background-color: rgba(128, 128, 128, 0.1);
    // border-radius: 0 0 1em 1em;
    .size {
        font-size: 0.8em;
        color: #888;
    }
    .drag-handle {
        user-select: none;
        float: left;

        // tactile background
        background-image: radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.2) 50%, transparent 50%, transparent);
        background-size: 0.25em 0.25em;
        background-position: 0 0;
        background-repeat: repeat;
        background-color: #3d3d3d;

        width: 1em;
        height: 2em;
        position: relative;
        left: -0.5em;
        cursor: ew-resize;
        &.is-active {
            background-color: #555;
        }
        &.out {
            float: right;
            left: 0.5em;
        }
    }
}

.video-editor-hover-time {
    padding: 0.5em;
    background: rgba(0, 0, 0, 0.8);
    color: #fff;
    position: fixed;
    border-radius: 0.5em;
    pointer-events: none;
}

.video-editor-controls {
    background-color: var(--video-controls-background-color);
    padding: 0.5em;
    border-radius: 0.5em;
}

.video-editor-chapter-hover {
    height: 3em;
    padding: 0.5em;
    background: rgba(128, 128, 128, 0.1);
    border-radius: 0.5em;
    margin-bottom: 0.5em;
    .chapter-game {
        font-size: 0.8em;
    }
}

.video-editor-chapters {
    // display: flex;
    width: 100%;
    height: 2em;
    margin-bottom: 0.5em;
    position: relative;
}

.video-editor-chapter {
    position: absolute;
    font-family: "Roboto Condensed", "Roboto", "Arial";
    font-size: 0.8em;
    padding: 0.5em;
    text-align: center;
    // background: rgba(128, 128, 128, 0.3);
    border-left: 1px solid #aaa;
    //flex-shrink: 1;
    //flex-grow: 1;
    word-break: break-all;
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
    height: 100%;
    box-sizing: border-box;

    // &:hover {
    //     background: rgba(128, 128, 128, 0.5);
    //     cursor: pointer;
    // }
}

.video-editor-chapter-title {
    font-weight: 700;
}

.video-editor-chapter-game {
    font-weight: 400;
    font-size: 90%;
    color: #888;
}

.video-editor-form {
    padding: 1em;
    margin-top: 1em;
}

.video-editor-time {
    font-size: 0.9em;
    padding: 0.5em;
}

.video-editor-help {
    padding: 1em;
    margin-top: 1em;
    background: rgba(128, 128, 128, 0.1);
    border-radius: 0.5em;
    p {
        margin: 0;
    }
}

.video-editor-chapter-list {
    padding: 1em;
    .chapter-game img {
        vertical-align: middle;
    }
}

.video-editor-chapter-list ul li {
    &:not(:last-child) {
        margin-bottom: 0.75em;
    }
}

.video-editor-chapter-list a {
    display: block;
    padding: 0.5em;
    &:hover {
        background-color: rgba(128, 128, 128, 0.1);
    }
}

.chapter-time {
    font-weight: 700;
}

.video-editor-chapter-list span {
    display: inline-block;
    margin-right: 0.3em;
}



</style>