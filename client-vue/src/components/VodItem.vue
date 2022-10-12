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
    >
        <div
            :id="'vod_' + vod.uuid"
            class="anchor"
        />

        <!-- title -->
        <div
            class="video-title"
            @click="minimized = !minimized"
        >
            <div class="video-title-text">
                <h3>
                    <span class="icon"><fa icon="file-video" /></span>
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
                <fa :icon="!minimized ? 'chevron-up' : 'chevron-down'" />
            </div>
        </div>

        <div
            v-if="!minimized"
            class="video-content"
        >
            <!-- description -->
            <div class="video-description">
                <!-- box art -->
                <div
                    v-if="vod && vod.provider == 'twitch' && vod.getUniqueGames()"
                    class="boxart-carousel is-small"
                >
                    <div
                        v-for="game in vod.getUniqueGames()"
                        :key="game.id"
                        class="boxart-item"
                    >
                        <img
                            v-if="game.image_url"
                            :title="game.name"
                            :alt="game.name"
                            :src="game.image_url"
                            loading="lazy"
                        >
                        <span v-else>{{ game.name }}</span>
                    </div>
                </div>

                <!-- comment -->
                <div
                    v-if="vod.comment"
                    class="video-comment"
                >
                    <p>{{ vod.comment }}</p>
                </div>
                <div v-else>
                    <p>
                        <a
                            href="#"
                            @click.prevent="editVodMenu ? (editVodMenu.show = true) : ''"
                        >
                            <fa icon="comment-dots" />
                            {{ $t("vod.add_comment") }}
                        </a>
                    </p>
                </div>

                <vod-item-video-info
                    :vod="vod"
                    :show-advanced="showAdvanced"
                />

                <div
                    v-if="vod.is_capturing"
                    class="info-columns"
                >
                    <div class="info-column">
                        <h4>Recording</h4>
                        <ul class="video-info">
                            <li v-if="vod.started_at">
                                <strong>Went live:</strong> {{ formatDate(vod.started_at) }}
                            </li>
                            <li v-if="vod.created_at">
                                <strong>Created:</strong> {{ formatDate(vod.created_at) }}
                            </li>
                            <li v-if="vod.capture_started && vod.started_at">
                                <strong>Capture launched:</strong> {{ formatDate(vod.capture_started) }} ({{
                                    humanDuration((vod.capture_started.getTime() - vod.started_at.getTime()) / 1000)
                                }}
                                missing)
                            </li>
                            <li v-if="vod.capture_started2">
                                <strong>Wrote file:</strong> {{ formatDate(vod.capture_started2) }}
                            </li>
                            <li>
                                <strong>Current duration:</strong> <duration-display
                                    v-if="vod.started_at"
                                    :start-date="vod.started_at.toISOString()"
                                    output-style="human"
                                />
                            </li>
                            <li v-if="vod.provider == 'twitch'">
                                <strong>Resolution:</strong> {{ vod.stream_resolution || "Unknown" }}
                            </li>
                            <li v-if="vod.provider == 'twitch'">
                                <strong>Watch live:</strong> <a
                                    :href="'https://twitch.tv/' + vod.streamer_login"
                                    rel="noreferrer"
                                    target="_blank"
                                >Twitch</a>
                            </li>
                        </ul>
                        <!--<button class="button is-small is-danger" @click="unbreak">Unbreak</button>-->
                    </div>
                </div>
            </div>

            <vod-item-segments :vod="vod" />

            <vod-item-bookmarks :vod="vod" />

            <!-- controls -->
            <div
                v-if="vod.is_finalized"
                class="video-controls buttons"
            >
                <button
                    :class="{ 'button': true, 'details-toggle': true, 'is-active': showAdvanced }"
                    title="Show advanced"
                    @click="showAdvanced = !showAdvanced"
                >
                    <span class="icon">
                        <fa
                            v-if="showAdvanced"
                            icon="minus"
                        />
                        <fa
                            v-else
                            icon="plus"
                        />
                    </span>
                </button>
                <!-- Editor -->
                <router-link
                    v-if="vod.video_metadata && vod.video_metadata.type !== 'audio'"
                    class="button is-blue"
                    :to="{ name: 'Editor', params: { uuid: vod?.uuid } }"
                >
                    <span class="icon"><fa
                        icon="cut"
                        type="fa"
                    /></span>
                    <span>{{ $t('vod.controls.editor') }}</span>
                </router-link>

                <!-- Player -->
                <a
                    v-if="vod.is_chat_downloaded || vod.is_chatdump_captured"
                    class="button is-blue"
                    target="_blank"
                    @click="playerMenu ? (playerMenu.show = true) : ''"
                >
                    <span class="icon"><fa
                        icon="play"
                        type="fa"
                    /></span>
                    <span>{{ $t('vod.controls.player') }}</span>
                </a>

                <!-- JSON -->
                <a
                    v-if="showAdvanced"
                    class="button"
                    :href="vod?.webpath + '/' + vod?.basename + '.json'"
                    target="_blank"
                >
                    <span class="icon"><fa
                        icon="database"
                        type="fa"
                    /></span>
                    <span>JSON</span>
                </a>

                <!-- Archive -->
                <a
                    class="button"
                    @click="doArchive"
                >
                    <span class="icon">
                        <fa
                            v-if="!taskStatus.archive"
                            icon="archive"
                            type="fa"
                        />
                        <fa
                            v-else
                            icon="sync"
                            type="fa"
                            spin
                        />
                    </span>
                    <span>{{ $t('vod.controls.archive') }}</span>
                </a>

                <!-- Download chat-->
                <a
                    v-if="vod.provider == 'twitch' && vod.twitch_vod_id && !vod?.is_chat_downloaded"
                    class="button"
                    @click="chatDownloadMenu ? (chatDownloadMenu.show = true) : ''"
                >
                    <span class="icon">
                        <fa
                            v-if="!taskStatus.downloadChat && !compDownloadChat"
                            icon="comments"
                            type="fa"
                        />
                        <fa
                            v-else
                            icon="sync"
                            type="fa"
                            spin
                        />
                    </span>
                    <span>{{ $t('vod.controls.download-chat') }}</span>
                </a>

                <template v-if="vod.provider == 'twitch' && vod.twitch_vod_id">
                    <!-- Download VOD -->
                    <a
                        v-if="!vod.is_vod_downloaded"
                        class="button"
                        @click="vodDownloadMenu ? (vodDownloadMenu.show = true) : ''"
                    >
                        <span class="icon">
                            <fa
                                v-if="!taskStatus.downloadVod"
                                icon="download"
                                type="fa"
                            />
                            <fa
                                v-else
                                icon="sync"
                                type="fa"
                                spin
                            />
                        </span>
                        <span v-if="vod.twitch_vod_muted == MuteStatus.MUTED">{{ $t('vod.controls.download-vod-muted') }}</span>
                        <span v-else>{{ $t('vod.controls.download-vod') }}</span>
                    </a>
                    <!-- Check mute -->
                    <a
                        v-if="showAdvanced"
                        class="button"
                        @click="doCheckMute"
                    >
                        <span class="icon">
                            <fa
                                v-if="!taskStatus.vodMuteCheck"
                                icon="volume-mute"
                                type="fa"
                            />
                            <fa
                                v-else
                                icon="sync"
                                type="fa"
                                spin
                            />
                        </span>
                        <span>{{ $t('vod.controls.check-mute') }}</span>
                    </a>
                </template>

                <a
                    v-if="vod.video_metadata && vod.video_metadata.type !== 'audio'"
                    class="button"
                    @click="burnMenu ? (burnMenu.show = true) : ''"
                >
                    <span class="icon">
                        <fa
                            icon="burn"
                            type="fa"
                        />
                    </span>
                    <span>{{ $t('vod.controls.render-menu') }}</span>
                </a>

                <!-- Fix issues -->
                <a
                    v-if="showAdvanced"
                    class="button"
                    @click="doFixIssues"
                >
                    <span class="icon">
                        <fa
                            icon="wrench"
                            type="fa"
                        />
                    </span>
                    <span>{{ $t('vod.controls.fix-issues') }}</span>
                </a>

                <!-- Vod export menu -->
                <button
                    v-if="showAdvanced"
                    class="button is-confirm"
                    @click="exportVodMenu ? (exportVodMenu.show = true) : ''"
                >
                    <span class="icon">
                        <fa
                            icon="upload"
                            type="fa"
                        />
                    </span>
                    <span>{{ $t('buttons.export') }}</span>
                </button>

                <!-- Vod edit menu -->
                <button
                    v-if="showAdvanced"
                    class="button is-confirm"
                    @click="editVodMenu ? (editVodMenu.show = true) : ''"
                >
                    <span class="icon">
                        <fa
                            icon="pencil"
                            type="fa"
                        />
                    </span>
                    <span>{{ $t('buttons.edit') }}</span>
                </button>

                <!-- Rename vod menu -->
                <button
                    v-if="showAdvanced"
                    class="button is-confirm"
                    @click="renameVodMenu ? (renameVodMenu.show = true) : ''"
                >
                    <span class="icon">
                        <fa
                            icon="pencil"
                            type="fa"
                        />
                    </span>
                    <span>{{ $t('buttons.rename') }}</span>
                </button>

                <!-- Delete segment -->
                <button
                    v-if="showAdvanced"
                    class="button is-danger"
                    :disabled="vod.prevent_deletion"
                    @click="doDeleteSegment(0)"
                >
                    <span class="icon">
                        <fa
                            icon="trash"
                            type="fa"
                        />
                    </span>
                    <span>{{ $t('buttons.delete-segment') }}</span>
                </button>

                <!-- Delete -->
                <button
                    class="button is-danger"
                    :disabled="vod.prevent_deletion"
                    @click="doDelete"
                >
                    <span class="icon">
                        <fa
                            v-if="!taskStatus.delete"
                            icon="trash"
                            type="fa"
                        />
                        <fa
                            v-else
                            icon="sync"
                            type="fa"
                            spin
                        />
                    </span>
                    <span>{{ $t('buttons.delete') }}</span>
                </button>
            </div>

            <div
                v-if="(vod.failed && !vod.is_finalized && !vod.is_capturing) || vod.hasError()"
                class="video-error"
            >
                <strong>
                    <span class="icon"><fa icon="exclamation-triangle" /></span> {{ $t('vod.failed') }}
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
                                v-if="!taskStatus.delete"
                                icon="trash"
                                type="fa"
                            />
                            <fa
                                v-else
                                icon="sync"
                                type="fa"
                                spin
                            />
                        </span>
                        <span>{{ $t('buttons.delete') }}</span>
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
                        <span>{{ $t('vod.controls.fix-issues') }}</span>
                    </button>
                </div>
            </div>
            <div
                v-else-if="!vod.is_finalized"
                class="video-status"
            >
                <template v-if="vod.is_converting">
                    <em>
                        <span class="icon"><fa icon="file-signature" /></span>
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
                                <span class="icon"><fa icon="exclamation-triangle" /></span> Not running, did it crash?
                            </strong>
                        </span>
                    </em>
                </template>
                <template v-else-if="vod && vod.is_capturing">
                    <em class="text-overflow">
                        <span class="icon"><fa icon="video" /></span>
                        Capturing to <strong>{{ vod.basename }}.ts</strong> (<strong>{{
                            vod.getRecordingSize() ? formatBytes(vod.getRecordingSize() as number) : "unknown"
                        }}</strong>)
                        <span
                            class="icon clickable"
                            title="Refresh"
                            @click="vod && store.fetchAndUpdateVod(vod.uuid)"
                        ><fa icon="sync" /></span>
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
                                    <span class="icon"><fa icon="exclamation-triangle" /></span>
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
                                        <span class="icon"><fa icon="exclamation-triangle" /></span>
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
                {{ $t('vod.capture-has-been-running-for-over-24-hours-streamlink-does-not-support-this-is-the-capture-stuck') }}
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
            v-if="vod && vod.is_finalized && vod.video_metadata && vod.video_metadata.type !== 'audio'"
            ref="burnMenu"
            title="Render Menu"
        >
            <render-modal :vod="vod" />
        </modal-box>
        <modal-box
            ref="chatDownloadMenu"
            title="Chat download"
        >
            <div class="buttons is-centered">
                <button
                    class="button is-confirm"
                    @click="doDownloadChat('tcd')"
                >
                    <span class="icon"><fa icon="download" /></span>
                    <span>{{ $t('vod.buttons.download-with', ['tcd']) }}</span>
                </button>
                <button
                    class="button is-confirm"
                    @click="doDownloadChat('td')"
                >
                    <span class="icon"><fa icon="download" /></span>
                    <span>{{ $t('vod.buttons.download-with', ['TwitchDownloader']) }}</span>
                </button>
            </div>
        </modal-box>
        <modal-box
            ref="vodDownloadMenu"
            title="VOD download"
        >
            <div class="is-centered">
                <div class="field">
                    <label class="label">Quality</label>
                    <select
                        v-model="vodDownloadSettings.quality"
                        class="input"
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
                <div class="field">
                    <button
                        class="button is-confirm"
                        @click="doDownloadVod"
                    >
                        <span class="icon"><fa icon="download" /></span>
                        <span>Download</span>
                    </button>
                </div>
            </div>
        </modal-box>
        <modal-box
            ref="playerMenu"
            title="Player"
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
                    <span class="icon"><fa icon="play" /></span>
                    <span>Play</span>
                </button>
            </div>
        </modal-box>
        <modal-box
            ref="editVodMenu"
            :title="$t('vod.edit.edit-vod')"
            max-width="1200px"
        >
            <edit-modal
                :vod="vod"
                @close="editVodMenu ? editVodMenu.show = false : ''"
            />
        </modal-box>
        <modal-box
            ref="exportVodMenu"
            title="Export VOD"
        >
            <export-modal :vod="vod" />
        </modal-box>
        <modal-box
            ref="renameVodMenu"
            :title="$t('vod.edit.rename-vod')"
        >
            <div class="field">
                {{ $t('vod.rename.current-name-vod-basename', [vod?.basename]) }}
            </div>
            <div class="field">
                <label class="label">{{ $t('vod.edit.template') }}</label>
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
                    <span class="icon"><fa icon="save" /></span>
                    <span>{{ $t("buttons.rename") }}</span>
                </button>
            </div>
        </modal-box>
    </div>
    <div v-else>
        No VOD found
    </div>
</template>

<script lang="ts" setup>
import type { VodBasenameTemplate } from "@common/Replacements";
import { VodBasenameFields, ExporterFilenameFields } from "@common/ReplacementsConsts";
import { computed, onMounted, ref, watch } from "vue";
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
import { ChapterTypes, useStore, VODTypes } from "@/store";
import ModalBox from "./ModalBox.vue";
import VodItemSegments from "./VodItemSegments.vue";
import VodItemBookmarks from "./VodItemBookmarks.vue";
import VodItemChapters from "./VodItemChapters.vue";
import RenderModal from "./vod/RenderModal.vue";
import ExportModal from "./vod/ExportModal.vue";
import EditModal from "./vod/EditModal.vue";
import { MuteStatus, VideoQualityArray } from "../../../common/Defs";
import { ApiResponse, ApiSettingsResponse } from "@common/Api/Api";
import { formatString } from "@common/Format";
import { format } from "date-fns";
import { TwitchVODChapter } from "@/core/Providers/Twitch/TwitchVODChapter";
import axios from "axios";
import { useRoute } from "vue-router";
import { isTwitchVOD } from "@/mixins/newhelpers";
import VodItemVideoInfo from "./VodItemVideoInfo.vue";
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
});
const emit = defineEmits(["forceFetchData", "refresh"]);
    
const store = useStore();
const route = useRoute();
const burnMenu = ref<InstanceType<typeof ModalBox>>();
const chatDownloadMenu = ref<InstanceType<typeof ModalBox>>();
const vodDownloadMenu = ref<InstanceType<typeof ModalBox>>();
const playerMenu = ref<InstanceType<typeof ModalBox>>();
const editVodMenu = ref<InstanceType<typeof ModalBox>>();
const exportVodMenu = ref<InstanceType<typeof ModalBox>>();
const renameVodMenu = ref<InstanceType<typeof ModalBox>>();

const showBurnMenu = ref(false);


const config = ref<ApiSettingsResponse>();
const taskStatus = ref({
    /** @deprecated */
    vodMuteCheck: false,
    archive: false,
    downloadChat: false,
    renderChat: false,
    downloadVod: false,
    fullBurn: false,
    delete: false,
    fixIssues: false,
});
const chatDownloadMethod = ref("tcd");
const showAdvanced = ref(false);
const minimized = ref(getDefaultMinimized());
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

const compDownloadChat = computed(() => {
    if (!store.jobList) return false;
    for (const job of store.jobList) {
        if (job.name == `tcd_${props.vod.basename}`) {
            return true;
        }
    }
    return false;
});

const audioOnly = computed(() => {
    if (!props.vod) return false;
    if (!props.vod.video_metadata) return false;
    return props.vod.video_metadata.type == 'audio';
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

watch(() => route.hash, (to, from) => {
    if (to !== from) {
        const uuid = to.substring(5);
        if (props.vod && uuid == props.vod.uuid) minimized.value = false;
    }
});

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


function doArchive() {
    if (!props.vod) return;
    if (!confirm(`Do you want to archive "${props.vod?.basename}"?`)) return;
    // taskStatus.archive = true;
    axios
        .post(`/api/v0/vod/${props.vod.uuid}/save`)
        .then((response) => {
            const json: ApiResponse = response.data;
            if (json.message) alert(json.message);
            console.log(json);
            // this.taskStatus.archive = false;
            emit("refresh");
        })
        .catch((err) => {
            console.error("form error", err.response);
            if (err.response.data && err.response.data.message) alert(err.response.data.message);
            // this.taskStatus.archive = false;
        });
}

function doDownloadChat(method = "tcd") {
    if (!props.vod) return;
    if (!confirm(`Do you want to download the chat for "${props.vod.basename}" with ${method}?`)) return;
    axios
        .post(`/api/v0/vod/${props.vod.uuid}/download_chat?method=${method}`)
        .then((response) => {
            const json: ApiResponse = response.data;
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

// doRenderChat(useVod = false) {
//     /** TODO: implement */
//     alert(`RenderChat not implemented: ${useVod}`);
// },

function doDownloadVod() {
    if (!props.vod) return;
    if (!VideoQualityArray.includes(vodDownloadSettings.value.quality)) {
        alert(`Invalid quality: ${vodDownloadSettings.value.quality}`);
        return;
    }

    axios
        .post(`/api/v0/vod/${props.vod.uuid}/download?quality=${vodDownloadSettings.value.quality}`)
        .then((response) => {
            const json: ApiResponse = response.data;
            if (json.message) alert(json.message);
            console.log(json);
            emit("refresh");
        })
        .catch((err) => {
            console.error("form error", err.response);
            if (err.response.data && err.response.data.message) alert(err.response.data.message);
        });
}

function doCheckMute() {
    if (!props.vod) return;
    axios
        .post(`/api/v0/vod/${props.vod.uuid}/check_mute`)
        .then((response) => {
            const json: ApiResponse = response.data;
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

// doFullBurn() {
//     /** TODO: implement */
//     alert("FullBurn");
// },

function doDelete() {
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

function doDeleteSegment(index = 0) {
    if (!props.vod) return;
    if (!confirm(`Do you want to delete segment ${index} of "${props.vod?.basename}"?`)) return;
    const keepEntry = confirm(`Do you want to keep the entry and mark it as cloud storage?`);
    if (isTwitchVOD(props.vod) && props.vod.twitch_vod_exists === false && !confirm(`The VOD "${props.vod?.basename}" has been deleted from twitch, are you still sure?`)) return;
    axios
        .post(`/api/v0/vod/${props.vod.uuid}/delete_segment?segment=${index}&keep_entry=${keepEntry ? "true" : "false"}`)
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

function doFixIssues() {
    if (!props.vod) return;
    axios
        .post(`/api/v0/vod/${props.vod.uuid}/fix_issues`)
        .then((response) => {
            const json: ApiResponse = response.data;
            if (json.message) alert(json.message);
            console.log(json);
            emit("refresh");
        })
        .catch((err) => {
            console.error("form error", err.response);
            if (err.response.data && err.response.data.message) alert(err.response.data.message);
        });
}

/*
unbreak() {
    if (!this.vod) return;
    // this.burnLoading = true;
    console.debug("doUnbreak", this.vod);
    axios
        .post(`/api/v0/vod/${this.vod.uuid}/unbreak`)
        .then((response) => {
            const json: ApiResponse = response.data;
            if (json.message) alert(json.message);
            console.log(json);
            emit("refresh");
        })
        .catch((err) => {
            console.error("unbreak response error", err.response);
            if (err.response.data && err.response.data.message) alert(err.response.data.message);
        })
        .finally(() => {
            // this.burnLoading = false;
        });
},
*/


function getDefaultMinimized() {
    if (!props.vod) return false;
    if (store.clientCfg("minimizeVodsByDefault")) {
        return !props.vod.is_capturing;
    }
    return false;
}

function openPlayer() {
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

function doRenameVod() {
    if (!props.vod) return;
    axios.post(`/api/v0/vod/${props.vod.uuid}/rename`, renameVodSettings.value).then((response) => {
        const json: ApiResponse = response.data;
        if (json.message) alert(json.message);
        console.log(json);
        store.fetchAndUpdateStreamerList();
        if (renameVodMenu.value) renameVodMenu.value.show = false;
    }).catch((err) => {
        console.error("form error", err.response);
        if (err.response.data && err.response.data.message) alert(err.response.data.message);
    });
}

function twitchVideoLink(video_id: string): string {
    return `https://www.twitch.tv/videos/${video_id}`;
}

function isTwitchChapter(chapter: ChapterTypes): chapter is TwitchVODChapter {
    return chapter instanceof TwitchVODChapter;
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

.video-description {
    padding: 10px;
    background: var(--video-description-background-color);
    // border-left: 1px solid #e3e3e3;
    // border-right: 1px solid #e3e3e3;
}

.video-controls {
    padding: 10px;
    background-color: var(--video-controls-background-color);
    // border-top: 1px solid #d6dbf2;
    // border-bottom: 1px solid #d6dbf2;
    // border-left: 1px solid #e3e3e3;
    // border-right: 1px solid #e3e3e3;

    .icon {
        margin-right: 0.3em;
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

.video-comment {
    padding: 1em;
    background-color: var(--video-comment-background-color);
    border-radius: 1em;
    width: max-content;
    p {
        margin: 0;
        padding: 0;
        white-space: pre;
    }

    position: relative;

    box-shadow: 0 5px 10px rgba(0, 0, 0, 0.2);

    margin: 1em 0 1.5em 0;

    // comment bubble tip
    &:before {
        content: "";
        position: absolute;
        bottom: -10px;
        left: 15px;
        width: 0;
        height: 0;
        border-style: solid;
        border-width: 10px 10px 0 10px;
        border-color: var(--video-comment-background-color) transparent transparent transparent;

    }
}

</style>