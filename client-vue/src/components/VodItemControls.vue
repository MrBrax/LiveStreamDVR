<template>
    <!-- controls -->
    <div
        v-if="vod.is_finalized"
        class="video-block video-controls buttons no-margin"
        aria-label="Controls"
    >
        <div class="video-block-content">
            <button
                :class="{ 'button': true, 'details-toggle': true, 'is-active': showAdvanced }"
                title="Show advanced"
                @click="emit('toggleAdvanced')"
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
                <span>{{ t('vod.controls.editor') }}</span>
            </router-link>
            <!-- Player -->
            <button
                v-if="vod.is_chat_downloaded || vod.is_chatdump_captured"
                class="button is-blue"
                target="_blank"
                @click="emit('showModal', 'player')"
            >
                <span class="icon"><fa
                    icon="play"
                    type="fa"
                /></span>
                <span>{{ t('vod.controls.player') }}</span>
            </button>
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
            <button
                class="button"
                @click="doArchive"
            >
                <span class="icon">
                    <fa
                        icon="archive"
                        type="fa"
                    />
                </span>
                <span>{{ t('vod.controls.archive') }}</span>
            </button>
            <!-- Download chat-->
            <button
                v-if="vod.provider == 'twitch' && vod.twitch_vod_id && !vod?.is_chat_downloaded"
                class="button"
                @click="emit('showModal', 'chatDownload')"
            >
                <span class="icon">
                    <fa
                        v-if="!compDownloadChat"
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
                <span>{{ t('vod.controls.download-chat') }}</span>
            </button>
            <template v-if="vod.provider == 'twitch' && vod.twitch_vod_id">
                <!-- Download VOD -->
                <button
                    v-if="!vod.is_vod_downloaded"
                    class="button"
                    @click="emit('showModal', 'vodDownload')"
                >
                    <span class="icon">
                        <fa
                            icon="download"
                            type="fa"
                        />
                    </span>
                    <span v-if="vod.twitch_vod_muted == MuteStatus.MUTED">{{ t('vod.controls.download-vod-muted') }}</span>
                    <span v-else>{{ t('vod.controls.download-vod') }}</span>
                </button>
                <!-- Check mute -->
                <button
                    v-if="showAdvanced"
                    class="button"
                    @click="doCheckMute"
                >
                    <span class="icon">
                        <fa
                            icon="volume-mute"
                            type="fa"
                        />
                    </span>
                    <span>{{ t('vod.controls.check-mute') }}</span>
                </button>
            </template>
            <button
                v-if="vod.video_metadata && vod.video_metadata.type !== 'audio'"
                class="button"
                @click="emit('showModal', 'burn')"
            >
                <span class="icon">
                    <fa
                        icon="burn"
                        type="fa"
                    />
                </span>
                <span>{{ t('vod.controls.render-menu') }}</span>
            </button>
            <!-- Fix issues -->
            <button
                v-if="showAdvanced"
                class="button"
                @click="emit('fixIssues')"
            >
                <span class="icon">
                    <fa
                        icon="wrench"
                        type="fa"
                    />
                </span>
                <span>{{ t('vod.controls.fix-issues') }}</span>
            </button>
            <!-- Fix issues -->
            <button
                v-if="showAdvanced"
                class="button"
                @click="doRefreshMetadata"
            >
                <span class="icon">
                    <fa
                        icon="sync"
                        type="fa"
                    />
                </span>
                <span>{{ t('vod.controls.refresh-metadata') }}</span>
            </button>
            <!-- Vod export menu -->
            <button
                v-if="showAdvanced"
                class="button is-confirm"
                @click="emit('showModal', 'export')"
            >
                <span class="icon">
                    <fa
                        icon="upload"
                        type="fa"
                    />
                </span>
                <span>{{ t('buttons.export') }}</span>
            </button>
            <!-- Vod edit menu -->
            <button
                v-if="showAdvanced"
                class="button is-confirm"
                @click="emit('showModal', 'edit')"
            >
                <span class="icon">
                    <fa
                        icon="pencil"
                        type="fa"
                    />
                </span>
                <span>{{ t('buttons.edit') }}</span>
            </button>
            <!-- Rename vod menu -->
            <button
                v-if="showAdvanced"
                class="button is-confirm"
                @click="emit('showModal', 'rename')"
            >
                <span class="icon">
                    <fa
                        icon="pencil"
                        type="fa"
                    />
                </span>
                <span>{{ t('buttons.rename') }}</span>
            </button>
            <!-- Delete segment -->
            <!--
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
                <span>{{ t('buttons.delete-segment') }}</span>
            </button>
            -->
            <!-- Delete -->
            <button
                class="button is-danger"
                :disabled="vod.prevent_deletion"
                @click="emit('delete')"
            >
                <span class="icon">
                    <fa
                        icon="trash"
                        type="fa"
                    />
                </span>
                <span>{{ t('buttons.delete') }}</span>
            </button>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { useStore } from '@/store';
import type { ApiResponse } from '@common/Api/Api';
import { MuteStatus } from "../../../common/Defs";
import axios from 'axios';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { VODTypes } from '@/twitchautomator';

const props = defineProps({
    vod: {
        type: Object as () => VODTypes,
        default: null,
        // required: true,
    },
    showAdvanced: {
        type: Boolean,
        default: false,
    },
});

/*
const emit = defineEmits([
    'toggle-advanced',
    // 'delete',
    // 'delete-segment',
    // 'fix-issues',
    // 'check-mute'
    'showModal'
]);
*/

const emit = defineEmits<{
    (event: 'toggleAdvanced'): void;
    (event: 'showModal', modal: string): void;
    (event: 'delete'): void;
    // (event: 'deleteSegment', segment: number): void;
    (event: 'fixIssues'): void;
    // (event: 'checkMute'): void;
}>();

const store = useStore();
const { t } = useI18n();

const compDownloadChat = computed(() => {
    if (!store.jobList) return false;
    for (const job of store.jobList) {
        if (job.name == `tcd_${props.vod.basename}`) {
            return true;
        }
    }
    return false;
});

function doArchive() {
    if (!props.vod) return;
    if (!confirm(`Do you want to archive "${props.vod?.basename}"?`)) return;
    // taskStatus.archive = true;
    axios
        .post<ApiResponse>(`/api/v0/vod/${props.vod.uuid}/save`)
        .then((response) => {
            const json = response.data;
            if (json.message) alert(json.message);
            console.log(json);
            // this.taskStatus.archive = false;
            // emit("refresh");
        })
        .catch((err) => {
            console.error("form error", err.response);
            if (err.response.data && err.response.data.message) alert(err.response.data.message);
            // this.taskStatus.archive = false;
        });
}

function doRefreshMetadata() {
    if (!props.vod) return;
    if (!confirm(`Do you want to refresh metadata for "${props.vod?.basename}"?`)) return;
    // taskStatus.archive = true;
    axios
        .post<ApiResponse>(`/api/v0/vod/${props.vod.uuid}/refresh_metadata`)
        .then((response) => {
            const json = response.data;
            if (json.message) alert(json.message);
            console.log(json);
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
            // emit("refresh");
        })
        .catch((err) => {
            console.error("doCheckMute error", err.response);
            if (err.response.data) {
                const json = err.response.data;
                if (json.message) alert(json.message);
            }
        });
}

</script>

<style lang="scss" scoped>

.video-controls {
    // padding: 1em 1em 0.5em 1em;
    // background-color: var(--video-controls-background-color);
    background-color: var(--video-block-background-color);
    // border-top: 1px solid #d6dbf2;
    // border-bottom: 1px solid #d6dbf2;
    // border-left: 1px solid #e3e3e3;
    // border-right: 1px solid #e3e3e3;

    .icon {
        margin-right: 0.3em;
    }
    
}

.details-toggle {
    // padding: 0.2em 0.5em;
    text-align: center;
    background-color: #eaeaea;
    // border-radius: 2px;
    border: 1px solid #aaa;
    margin: 1px;
    box-shadow: inset 0 -2px 0px rgba(0, 0, 0, 0.05);
    transition: all 0.1s ease-in-out;
    &.is-active {
        background-color: #b4b4b4;
        border-color: #8d8d8d;
        color: #333;
        box-shadow: inset 0 2px 0px rgba(0, 0, 0, 0.05);
    }
}

</style>