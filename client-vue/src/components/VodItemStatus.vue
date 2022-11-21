<template>
    <div
        v-if="(vod.failed && !vod.is_finalized && !vod.is_capturing) || vod.hasError()"
        class="video-block video-error"
    >
        <!-- capture failed-->
        <div class="video-block-content">
            <strong>
                <span class="icon"><font-awesome-icon icon="exclamation-triangle" /></span> {{ t('vod.failed') }}
            </strong>&nbsp;
            <div class="buttons">
                <!-- Delete -->
                <d-button
                    class="is-danger"
                    color="danger"
                    size="small"
                    icon="trash"
                    :disabled="vod.prevent_deletion"
                    @click="emit('delete')"
                >
                    {{ t('buttons.delete') }}
                </d-button>

                <!-- Fix issues -->
                <d-button
                    color="success"
                    size="small"
                    icon="wrench"
                    @click="emit('fixIssues')"
                >
                    {{ t('vod.controls.fix-issues') }}
                </d-button>
            </div>
        </div>
    </div>
    
    <div
        v-else-if="!vod.is_finalized"
        class="video-block video-status"
    >
        <!-- not finalized, error check -->
        <div class="video-block-content">
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
                    <button
                        class="icon-button"
                        title="Refresh"
                        @click="vod && store.fetchAndUpdateVod(vod.uuid)"
                    ><span class="icon"><font-awesome-icon icon="sync" /></span></button>
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
    </div>
    
    <div
        v-if="vod.is_capturing && vod.getDurationLive() > 86400"
        class="video-block video-error"
    >
        <!-- capture length warning -->
        <div class="video-block-content">
            {{ t('vod.capture-has-been-running-for-over-24-hours-streamlink-does-not-support-this-is-the-capture-stuck') }}
        </div>
    </div>

    <div
        v-if="!vod.chapters"
        class="video-block video-error"
    >
        <!-- no chapters error -->
        <div class="video-block-content">
            No chapter data!?
        </div>
    </div>
</template>

<script lang="ts" setup>
import { formatBytes, formatDate } from '@/mixins/newhelpers';
import { useStore } from '@/store';
import type { VODTypes } from '@/twitchautomator';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
    vod: VODTypes;
}>();

const emit = defineEmits<{
    (event: 'delete'): void;
    (event: 'fixIssues'): void;
}>();

const store = useStore();
const { t } = useI18n();

</script>

<style lang="scss" scoped>
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

.video-status {
    background-color: #b3ddad;
    color: #222;
}
</style>