<template>
    <div
        v-if="vod"
        :class="{
            video: true,
            'is-animated': store.clientCfg('animationsEnabled'),
            'is-recording': vod.is_capturing,
            'is-converting': vod.is_converting,
            'is-finalized': vod.is_finalized,
            'is-favourite': vod.provider == 'twitch' && vod.hasFavouriteGame(),
        }"
        :aria-label="vod.basename"
    >
        <div
            :id="'vod_' + vod.uuid"
            class="anchor"
        />

        <!-- title -->
        <div
            class="video-title"
            aria-label="Video title"
            :aria-pressed="!minimized"
            tabindex="0"
            role="button"
            @click="emit('toggleMinimize')"
            @keydown.prevent.enter="emit('toggleMinimize')"
            @keydown.prevent.space="emit('toggleMinimize')"
        >
            <div class="video-title-text">
                <h3>
                    <span class="icon"><font-awesome-icon icon="file-video" /></span>
                    <span
                        v-if="vod.started_at"
                        class="video-date"
                        :title="formatDate(vod.started_at)"
                    >{{
                        store.clientCfg('useRelativeTime') ? humanDate(vod.started_at, true) : formatDate(vod.started_at)
                    }}</span>
                    <span class="video-sxe">
                        {{ vod.stream_season }}x{{ vod.stream_number?.toString().padStart(2, "0") }}
                    </span>
                    <span class="video-filename">{{ vod.basename }}</span>
                </h3>
            </div>
            <div class="video-title-actions">
                <font-awesome-icon :icon="!minimized ? 'chevron-up' : 'chevron-down'" />
            </div>
        </div>

        <div
            v-if="!minimized"
            class="video-content"
        >
            <vod-item-general
                :vod="vod"
                @show-modal="showModalEv($event as any)"
            />

            <vod-item-viewers :vod="vod" />

            <vod-item-segments :vod="vod" />

            <vod-item-bookmarks :vod="vod" />

            <vod-item-controls
                :vod="vod"
                :show-advanced="showAdvanced"
                @show-modal="showModalEv($event as any)"
                @toggle-advanced="showAdvanced = !showAdvanced"
                @delete="doDelete"
                @fix-issues="doFixIssues"
                @check-mute="doCheckMute"
            />

            <div
                v-if="(vod.failed && !vod.is_finalized && !vod.is_capturing) || vod.hasError()"
                class="video-error"
            >
                <strong>
                    <span class="icon"><font-awesome-icon icon="exclamation-triangle" /></span> {{ t('vod.failed') }}
                </strong>&nbsp;
                <div class="buttons">
                    <!-- Delete -->
                    <button
                        class="button is-danger is-small"
                        :disabled="vod.prevent_deletion"
                        @click="doDelete"
                    >
                        <span class="icon">
                            <fa
                                icon="trash"
                                type="fa"
                            />
                        </span>
                        <span>{{ t('buttons.delete') }}</span>
                    </button>

                    <!-- Fix issues -->
                    <button
                        class="button is-confirm is-small"
                        @click="doFixIssues"
                    >
                        <span class="icon">
                            <fa
                                icon="wrench"
                                type="fa"
                            />
                        </span>
                        <span>{{ t('vod.controls.fix-issues') }}</span>
                    </button>
                </div>
            </div>
            <div
                v-else-if="!vod.is_finalized"
                class="video-status"
            >
                <template v-if="vod.is_converting">
                    <em>
                        <span class="icon"><font-awesome-icon icon="file-signature" /></span>
                        Converting <strong>{{ vod.basename }}.ts</strong> to <strong>{{ vod.basename }}.mp4</strong>
                    </em>
                    <br>
                    <em>
                        <span v-if="vod.getConvertingStatus()">
                            <span class="icon"><fa
                                icon="sync"
                                spin
                            /></span>
                            Running (pid {{ vod.getConvertingStatus() }})
                        </span>
                        <span v-else>
                            <strong class="text-is-error flashing">
                                <span class="icon"><font-awesome-icon icon="exclamation-triangle" /></span> Not running, did it crash?
                            </strong>
                        </span>
                    </em>
                </template>
                <template v-else-if="vod && vod.is_capturing">
                    <em class="text-overflow">
                        <span class="icon"><font-awesome-icon icon="video" /></span>
                        Capturing to <strong>{{ vod.basename }}.ts</strong> (<strong>{{
                            vod.getRecordingSize() ? formatBytes(vod.getRecordingSize() as number) : "unknown"
                        }}</strong>)
                        <span
                            class="icon clickable"
                            title="Refresh"
                            @click="vod && store.fetchAndUpdateVod(vod.uuid)"
                        ><font-awesome-icon icon="sync" /></span>
                    </em>

                    <br>

                    <template v-if="store.cfg('playlist_dump')">
                        <em>
                            <span v-if="vod.getCapturingStatus()">
                                <span class="icon"><fa
                                    icon="sync"
                                    spin
                                /></span>
                                Video capture running (pid
                                {{ vod.getCapturingStatus() }})
                            </span>
                            <span v-else>
                                <strong class="text-is-error flashing">
                                    <span class="icon"><font-awesome-icon icon="exclamation-triangle" /></span>
                                    Video capture not running, did it crash?
                                </strong>
                            </span>
                        </em>
                        <template v-if="store.cfg('chat_dump')">
                            <br><em>
                                <span v-if="vod.getChatDumpStatus()">
                                    <span class="icon"><fa
                                        icon="sync"
                                        spin
                                    /></span>
                                    Chat dump running (pid
                                    {{ vod.getChatDumpStatus() }})
                                </span>
                                <span v-else>
                                    <strong class="text-is-error flashing">
                                        <span class="icon"><font-awesome-icon icon="exclamation-triangle" /></span>
                                        Chat dump not running, did it crash?
                                    </strong>
                                </span>
                            </em>
                        </template>
                    </template>
                </template>
                <template v-else-if="!vod.is_capturing && !vod.is_converting && !vod.is_finalized">
                    <em>Waiting to finalize video (since {{ vod.ended_at ? formatDate(vod.ended_at, "yyyy-MM-dd HH:mm:ss") : "(unknown)" }})</em>
                </template>
                <template v-else>
                    <em>No video file or error</em>
                </template>
            </div>

            <!-- capture length warning -->
            <div
                v-if="vod.is_capturing && vod.getDurationLive() > 86400"
                class="video-error"
            >
                {{ t('vod.capture-has-been-running-for-over-24-hours-streamlink-does-not-support-this-is-the-capture-stuck') }}
            </div>

            <!-- no chapters error -->
            <div
                v-if="!vod.chapters"
                class="video-error"
            >
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

            <vod-item-chapters
                :vod="vod"
                :show-advanced="showAdvanced"
            />
        </div>
        <modal-box
            :show="showModal.burn && vod && vod.is_finalized && vod.video_metadata && vod.video_metadata.type !== 'audio'"
            title="Render Menu"
            @close="showModal.burn = false"
        >
            <render-modal :vod="vod" />
        </modal-box>
        <modal-box
            :show="showModal.chatDownload"
            title="Chat download"
            @close="showModal.chatDownload = false"
        >
            <div class="buttons is-centered">
                <button
                    class="button is-confirm"
                    @click="doDownloadChat('tcd')"
                >
                    <span class="icon"><font-awesome-icon icon="download" /></span>
                    <span>{{ t('vod.buttons.download-with', ['tcd']) }}</span>
                </button>
                <button
                    class="button is-confirm"
                    @click="doDownloadChat('td')"
                >
                    <span class="icon"><font-awesome-icon icon="download" /></span>
                    <span>{{ t('vod.buttons.download-with', ['TwitchDownloader']) }}</span>
                </button>
            </div>
        </modal-box>
        <modal-box
            :show="showModal.vodDownload"
            title="VOD download"
            @close="showModal.vodDownload = false"
        >
            <div class="is-centered">
                <div class="field">
                    <label class="label">Quality</label>
                    <div class="select">
                        <select
                            v-model="vodDownloadSettings.quality"
                        >
                            <option
                                v-for="quality in VideoQualityArray"
                                :key="quality"
                                :value="quality"
                            >
                                {{ quality }}
                            </option>
                        </select>
                    </div>
                </div>
                <div class="field">
                    <button
                        class="button is-confirm"
                        @click="doDownloadVod"
                    >
                        <span class="icon"><font-awesome-icon icon="download" /></span>
                        <span>Download</span>
                    </button>
                </div>
            </div>
        </modal-box>
        <modal-box
            :show="showModal.player"
            title="Player"
            @close="showModal.player = false"
        >
            <div class="columns">
                <div class="column">
                    <h3>VOD source</h3>
                    <ul class="radio-list">
                        <li>
                            <label>
                                <input
                                    v-model="playerSettings.vodSource"
                                    type="radio"
                                    value="captured"
                                > Captured
                            </label>
                        </li>
                        <li>
                            <label>
                                <input
                                    v-model="playerSettings.vodSource"
                                    type="radio"
                                    value="downloaded"
                                    :disabled="!vod?.is_vod_downloaded"
                                > Downloaded
                            </label>
                        </li>
                    </ul>
                </div>
                <div class="column">
                    <h3>Chat source</h3>
                    <ul class="radio-list">
                        <li>
                            <label>
                                <input
                                    v-model="playerSettings.chatSource"
                                    type="radio"
                                    value="captured"
                                > Captured
                            </label>
                        </li>
                        <li>
                            <label>
                                <input
                                    v-model="playerSettings.chatSource"
                                    type="radio"
                                    value="downloaded"
                                    :disabled="!vod?.is_chat_downloaded"
                                > Downloaded
                            </label>
                        </li>
                    </ul>
                </div>
            </div>
            <br>
            <div class="field">
                <button
                    class="button is-confirm"
                    @click="openPlayer"
                >
                    <span class="icon"><font-awesome-icon icon="play" /></span>
                    <span>Play</span>
                </button>
            </div>
        </modal-box>
        <modal-box
            :show="showModal.edit"
            :title="t('vod.edit.edit-vod')"
            max-width="1200px"
            @close="showModal.edit = false"
        >
            <edit-modal
                :vod="vod"
                @close="showModal.edit = false"
            />
        </modal-box>
        <modal-box
            :show="showModal.export"
            title="Export VOD"
            @close="showModal.export = false"
        >
            <export-modal :vod="vod" />
        </modal-box>
        <modal-box
            :show="showModal.rename"
            :title="t('vod.edit.rename-vod')"
            @close="showModal.rename = false"
        >
            <div class="field">
                {{ t('vod.rename.current-name-vod-basename', [vod?.basename]) }}
            </div>
            <div class="field">
                <label class="label">{{ t('vod.edit.template') }}</label>
                <div class="control">
                    <input
                        v-model="renameVodSettings.template"
                        class="input"
                        type="text"
                    >
                    <ul class="template-replacements">
                        <li
                            v-for="(v, k) in VodBasenameFields"
                            :key="k"
                        >
                            {{ k }}
                        </li>
                    </ul>
                    <p class="template-preview">
                        {{ renameVodTemplatePreview }}
                    </p>
                </div>
            </div>
            <div class="field">
                <button
                    class="button is-confirm"
                    @click="doRenameVod"
                >
                    <span class="icon"><font-awesome-icon icon="save" /></span>
                    <span>{{ t("buttons.rename") }}</span>
                </button>
            </div>
        </modal-box>
    </div>
    <div v-else>
        No VOD found
    </div>
</template>

<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import type { VodBasenameTemplate } from "@common/Replacements";
import { VodBasenameFields, ExporterFilenameFields } from "@common/ReplacementsConsts";
import { computed, onMounted, ref } from "vue";
import DurationDisplay from "@/components/DurationDisplay.vue";
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
    faFileSignature,
    faWrench,
    faSync,
    faMinus,
    faPlus,
    faCommentDots,
    faSave,
    faUpload,
    faKey,
} from "@fortawesome/free-solid-svg-icons";
import { useStore } from "@/store";
import ModalBox from "./ModalBox.vue";
import VodItemSegments from "./VodItemSegments.vue";
import VodItemBookmarks from "./VodItemBookmarks.vue";
import VodItemChapters from "./VodItemChapters.vue";
import VodItemViewers from "./VodItemViewers.vue";
import VodItemGeneral from "./VodItemGeneral.vue";
import RenderModal from "./vod/RenderModal.vue";
import ExportModal from "./vod/ExportModal.vue";
import EditModal from "./vod/EditModal.vue";
import { MuteStatus, VideoQualityArray } from "../../../common/Defs";
import type { ApiResponse, ApiSettingsResponse } from "@common/Api/Api";
import { formatString } from "@common/Format";
import { format } from "date-fns";
import axios from "axios";
import { useRoute } from "vue-router";
import { isTwitchVOD } from "@/mixins/newhelpers";
import VodItemControls from "./VodItemControls.vue";
import { formatDate, humanDate, humanDuration, formatBytes } from "@/mixins/newhelpers";
import type { VODTypes } from "@/twitchautomator";
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
    faFileSignature,
    faWrench,
    faSync,
    faMinus,
    faPlus,
    faCommentDots,
    faSave,
    faUpload,
    faKey
);

const props = defineProps({
    vod: {
        type: Object as () => VODTypes,
        default: null,
        // required: true,
    },
    minimized: {
        type: Boolean,
        default: false,
    },
});
const emit = defineEmits(["forceFetchData", "refresh", "toggleMinimize"]);

const store = useStore();

const route = useRoute();

const { t } = useI18n();

const config = ref<ApiSettingsResponse>();
/*
const taskStatus = ref({
    /** @deprecated *
    vodMuteCheck: false,
    archive: false,
    downloadChat: false,
    renderChat: false,
    downloadVod: false,
    fullBurn: false,
    delete: false,
    fixIssues: false,
});
*/

const showAdvanced = ref(false);

// const minimized = ref(getDefaultMinimized());

const vodDownloadSettings = ref({
    quality: "best",
});

const playerSettings = ref({
    vodSource: "captured",
    chatSource: "captured",
});

const renameVodSettings = ref({
    template: "",
});

const showModal = ref({
    burn: false,
    chatDownload: false,
    vodDownload: false,
    player: false,
    edit: false,
    export: false,
    rename: false,
});

const renameVodTemplatePreview = computed(() => {
    if (!props.vod) return "";
    const date = props.vod.started_at;
    const replacements: VodBasenameTemplate = {
        login:              props.vod.provider == 'twitch' ? props.vod.streamer_login : "",
        internalName:       props.vod.getChannel().internalName,
        displayName:        props.vod.getChannel().displayName,
        date:               date ? format(date, "yyyy-MM-dd'T'HH:mm:ss'Z'").replaceAll(":", "_") : "",
        year:               date ? format(date, "yyyy") : "",
        year_short:         date ? format(date, "yy") : "",
        month:              date ? format(date, "MM") : "",
        day:                date ? format(date, "dd") : "",
        hour:               date ? format(date, "HH") : "",
        minute:             date ? format(date, "mm") : "",
        second:             date ? format(date, "ss") : "",
        id:                 "1234",
        season:             props.vod.stream_season || "",
        absolute_season:    props.vod.stream_absolute_season ? props.vod.stream_absolute_season.toString().padStart(2, "0") : "",
        episode:            props.vod.stream_number ? props.vod.stream_number.toString().padStart(2, "0") : "",
    };
    const replaced_string = formatString(renameVodSettings.value.template, replacements);
    return replaced_string;
});

/*  
watch: {
    // watch hash
    $route(to, from) {
        if (to.hash !== from.hash) {
            const basename = to.hash.substr(5);
            if (basename == props.vod.basename) this.minimized = false;
        }
    },
},
*/

/*
watch(() => route.hash, (to, from) => {
    if (to !== from) {
        const uuid = to.substring(5);
        if (props.vod && uuid == props.vod.uuid) minimized.value = false;
    }
});
*/

onMounted(() => {
    if (props.vod) {
        if (!props.vod.chapters) {
            console.error("No chapters found for vod", props.vod.basename, props.vod);
        } else if (props.vod.chapters && props.vod.chapters.length == 0) {
            console.error("Chapters array found but empty for vod", props.vod.basename, props.vod);
        }
    } else {
        console.error("No vod found");
    }
    renameVodSettings.value.template = store.cfg("filename_vod", "");
});

function doDownloadChat(method = "tcd"): void {
    if (!props.vod) return;
    if (!confirm(`Do you want to download the chat for "${props.vod.basename}" with ${method}?`)) return;
    axios
        .post<ApiResponse>(`/api/v0/vod/${props.vod.uuid}/download_chat?method=${method}`)
        .then((response) => {
            const json = response.data;
            if (json.message) alert(json.message);
            console.log(json);
            emit("refresh");
            if (props.vod) store.fetchAndUpdateVod(props.vod.uuid);
        })
        .catch((err) => {
            console.error("form error", err.response);
            if (err.response.data && err.response.data.message) alert(err.response.data.message);
        });
}

function doDownloadVod(): void {
    if (!props.vod) return;
    if (!VideoQualityArray.includes(vodDownloadSettings.value.quality)) {
        alert(`Invalid quality: ${vodDownloadSettings.value.quality}`);
        return;
    }

    axios
        .post<ApiResponse>(`/api/v0/vod/${props.vod.uuid}/download?quality=${vodDownloadSettings.value.quality}`)
        .then((response) => {
            const json = response.data;
            if (json.message) alert(json.message);
            console.log(json);
            emit("refresh");
        })
        .catch((err) => {
            console.error("form error", err.response);
            if (err.response.data && err.response.data.message) alert(err.response.data.message);
        });
}

function doCheckMute(): void {
    if (!props.vod) return;
    axios
        .post<ApiResponse>(`/api/v0/vod/${props.vod.uuid}/check_mute`)
        .then((response) => {
            const json = response.data;
            if (json.message) alert(json.message);
            console.log(json);

            if (json.data) {
                if (json.data.muted === null || json.data.muted === MuteStatus.UNKNOWN) {
                    alert(`The vod "${props.vod?.basename}" could not be checked.`);
                } else {
                    alert(`The vod "${props.vod?.basename}" is${json.data.muted === MuteStatus.MUTED ? "" : " not"} muted.`);
                }
            }
            emit("refresh");
        })
        .catch((err) => {
            console.error("doCheckMute error", err.response);
            if (err.response.data) {
                const json = err.response.data;
                if (json.message) alert(json.message);
            }
        });
}

function doDelete(): void {
    if (!props.vod) return;
    if (!confirm(`Do you want to delete "${props.vod?.basename}"?`)) return;
    if (isTwitchVOD(props.vod) && props.vod.twitch_vod_exists === false && !confirm(`The VOD "${props.vod?.basename}" has been deleted from twitch, are you still sure?`)) return;
    axios
        .delete(`/api/v0/vod/${props.vod.uuid}`)
        .then((response) => {
            const json: ApiResponse = response.data;
            if (json.message) alert(json.message);
            console.log(json);
            emit("refresh");
            if (props.vod && isTwitchVOD(props.vod)) store.fetchAndUpdateStreamer(props.vod.channel_uuid);
        })
        .catch((err) => {
            console.error("form error", err.response);
            if (err.response.data && err.response.data.message) alert(err.response.data.message);
        });
}

function doFixIssues(): void {
    if (!props.vod) return;
    const c = confirm(
        `Do you want to fix issues for "${props.vod?.basename}"?\n` +
        `Please only do this if you know what you are doing.\n` +
        `Using this function can cause issues with the VOD, especially if it is currently capturing or converting.`
    );
    if (!c) return;
    axios
        .post<ApiResponse>(`/api/v0/vod/${props.vod.uuid}/fix_issues`)
        .then((response) => {
            const json = response.data;
            if (json.message) alert(json.message);
            console.log(json);
            emit("refresh");
        })
        .catch((err) => {
            console.error("form error", err.response);
            if (err.response.data && err.response.data.message) alert(err.response.data.message);
        });
}

function openPlayer(): void {
    if (!props.vod) return;
    let url = `${store.cfg<string>("basepath", "")}/vodplayer/index.html#&`;
    url += "source=file_http";
    if (playerSettings.value.vodSource == "captured"){
        url += `&video_path=${props.vod.webpath}/${props.vod.basename}.mp4`;
    } else {
        url += `&video_path=${props.vod.webpath}/${props.vod.basename}_vod.mp4`;
    }

    if (playerSettings.value.chatSource == "captured"){
        url += `&chatfile=${props.vod.webpath}/${props.vod.basename}.chatdump`;
    } else {
        url += `&chatfile=${props.vod.webpath}/${props.vod.basename}_chat.json`;
    }

    // url.searchParams.set("offset", this.playerSettings.offset.toString());
    window.open(url.toString(), "_blank");

}

function templatePreview(template: string): string {
    /*
    const replacements = {
        login: "TestLogin",
        title: "TestTitle",
        date: "2020-01-01",
        resolution: "1080p",
        stream_number: "102",
        comment: "TestComment", 
    };
    const replaced_string = formatString(template, replacements);
    return replaced_string;
    */
    const replaced_string = formatString(template, Object.fromEntries(Object.entries(ExporterFilenameFields).map(([key, value]) => [key, value.display])));
    return replaced_string;
}

function doRenameVod(): void {
    if (!props.vod) return;
    axios.post<ApiResponse>(`/api/v0/vod/${props.vod.uuid}/rename`, renameVodSettings.value).then((response) => {
        const json = response.data;
        if (json.message) alert(json.message);
        console.log(json);
        store.fetchAndUpdateStreamerList();
        showModal.value.rename = false;
    }).catch((err) => {
        console.error("form error", err.response);
        if (err.response.data && err.response.data.message) alert(err.response.data.message);
    });
}

function showModalEv(modal: keyof typeof showModal.value): void {
    if (showModal.value[modal] === undefined) {
        console.error("showModalEv: unknown modal", modal);
        return;
    }
    showModal.value[modal] = true;
}

</script>

<style lang="scss" scoped>
@import "../assets/_variables";

.video {
    margin-bottom: 10px;
    // border-bottom: 1px solid #eee;

    &.is-recording {
        &.is-animated {
            .video-title {
                animation: recording ease-in-out 1s infinite;
            }
        }

        .video-title {
            background-color: $recording-base;

            &:hover {
                background-color: lighten($favourite-base, 5%);
            }

        }
    }

    &.is-converting {
        .video-title {
            background-color: $converting-base;

            &:hover {
                background-color: lighten($favourite-base, 5%);
            }

        }
    }

    &.is-favourite {
        .video-title {
            background-color: $favourite-base;

            &:hover {
                background-color: lighten($favourite-base, 5%);
            }

        }
    }
}

.video-title {
    padding: 10px;
    $bg-color: #2b61d6;
    background: $bg-color;
    color: #fff;

    // good idea?
    position: sticky;
    top: 50px;
    z-index: 1;

    display: flex;

    word-break: break-all;

    cursor: pointer;

    &:hover {
        background-color: lighten($bg-color, 5%);
    }

    .icon {
        margin-right: 0.3em;
    }

    h3 {
        margin: 0;
        padding: 0;
        // text-shadow: 0 2px 0 #1e4599;
        // text-shadow: 0 2px 0 rgba(0, 0, 0, 0.2);
        color: #fff;
    }

    .video-title-text {
        flex-grow: 1;
    }

    .video-title-actions {
        display: flex;
        // center horizontal and vertical
        justify-content: center;
        align-items: center;
    }
}

.video-content {
    overflow: hidden;
}

.video-sxe {
    font-family: "Roboto Condensed";
    color: rgba(255, 255, 255, 0.5);

    &:before {
        content: " · ";
    }
}

.video-filename {
    font-family: "Roboto Condensed";
    color: rgba(255, 255, 255, 0.5);

    &:before {
        content: " · ";
    }
}

.video-status {
    padding: 10px;
    background-color: #b3ddad;
    color: #222;
    // border-top: 1px solid #a1bd9b;
    // border-bottom: 1px solid #a1bd9b;
    // border-left: 1px solid #e3e3e3;
    // border-right: 1px solid #e3e3e3;
}

.video-chapters {
    // border-left: 1px solid #e3e3e3;
    // border-right: 1px solid #e3e3e3;
    // border-bottom: 1px solid #e3e3e3;
}

.video-error {
    background: #f00;
    padding: 10px;
    color: #fff;
    font-weight: 700;

    a {
        color: #ffff00;

        &:hover {
            color: #fff;
        }
    }
}


.video:deep(.video-block) {
    .video-block-header {
        padding: 0.5em;
        h4 {
            margin: 0;
            padding: 0;
        }
        // background-image: linear-gradient(to right, #2b61d6, #2b61d6 50%, #2b61d6 50%, #2b61d6);
        // background-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.02));
        border-top: 1px solid rgba(0, 0, 0, 0.2);
        // background-color: rgba(0, 0, 0, 0.2);
        // border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        &.collapsible {
            cursor: pointer;
            user-select: none;
            &:hover {
                // background-image: linear-gradient(to bottom, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.02));
                background-color: rgba(255, 255, 255, 0.05);
                color: #fff;
                text-shadow: 0 0 2px rgba(255, 255, 255, 0.5);
            }
        }
    }
    .video-block-content {
        padding: 1em;
        &.no-padding {
            padding: 0;
        }
    }
}

</style>