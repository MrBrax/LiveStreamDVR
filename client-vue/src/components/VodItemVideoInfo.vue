<template>
    <!-- video info -->
    <div
        v-if="vod.is_finalized"
        class="info-columns"
    >
        <div class="info-column">
            <h4>{{ t('vod.video-info.general') }}</h4>
            <ul class="video-info">
                <li>
                    <strong>{{ t('vod.video-info.capture-id') }}:</strong>
                    {{ vod.capture_id || "None" }}
                </li>
                <li>
                    <strong>{{ t('vod.video-info.webhook-duration') }}:</strong>
                    {{ vod.getWebhookDuration() }}
                </li>
                <li>
                    <strong>{{ t('vod.video-info.created') }}:</strong> 
                    <template v-if="vod.created_at">
                        {{ formatDate(vod.created_at, "yyyy-MM-dd HH:mm:ss") }}
                    </template>
                    <span
                        v-else
                        class="text-is-error"
                    >No created_at</span>
                </li>
                <li v-if="showAdvanced">
                    <strong>{{ t('vod.video-info.went-live') }}:</strong> 
                    <template v-if="vod.started_at">
                        {{ formatDate(vod.started_at, "yyyy-MM-dd HH:mm:ss") }}
                    </template>
                    <span
                        v-else
                        class="text-is-error"
                    >No started_at</span>
                </li>
                <li v-if="showAdvanced">
                    <strong>{{ t('vod.video-info.capture-launched') }}:</strong> 
                    <template v-if="vod.capture_started">
                        {{ formatDate(vod.capture_started, "yyyy-MM-dd HH:mm:ss") }}
                    </template>
                    <span
                        v-else
                        class="text-is-error"
                    >No capture_started</span>
                </li>
                <li v-if="showAdvanced">
                    <strong>{{ t('vod.video-info.wrote-file') }}:</strong> 
                    <template v-if="vod.capture_started2">
                        {{ formatDate(vod.capture_started2, "yyyy-MM-dd HH:mm:ss") }}
                    </template>
                    <span
                        v-else
                        class="text-is-error"
                    >No capture_started2</span>
                </li>
                <li>
                    <strong>{{ t('vod.video-info.stream-end') }}:</strong> 
                    <template v-if="vod.ended_at">
                        {{ formatDate(vod.ended_at, "yyyy-MM-dd HH:mm:ss") }}
                    </template>
                    <span
                        v-else
                        class="text-is-error"
                    >No ended_at</span>
                </li>
                <template v-if="vod.capture_started && vod.conversion_started">
                    <li>
                        <strong>{{ t('vod.video-info.capture-start') }}:</strong>
                        {{ formatDate(vod.capture_started, "yyyy-MM-dd HH:mm:ss") }}
                    </li>
                    <li>
                        <strong>{{ t('vod.video-info.conversion-start') }}:</strong>
                        {{ formatDate(vod.conversion_started, "yyyy-MM-dd HH:mm:ss") }}
                    </li>
                </template>
                <li v-if="vod.getDuration() && showAdvanced">
                    <strong>{{ t('vod.video-info.missing-from-captured-file') }}:</strong>
                    <span
                        v-if="vod.provider == 'twitch' && vod.twitch_vod_duration"
                        class="px-1"
                    >
                        {{ humanDuration(vod.twitch_vod_duration - vod.getDuration()) }}
                        <strong
                            v-if="vod.twitch_vod_duration - vod.getDuration() > 600"
                            class="text-is-error"
                        ><br>A lot missing!</strong>
                    </span>
                    <span
                        v-else
                        class="px-1"
                    >
                        <strong><em>No data</em></strong>
                    </span>
                </li>
                <li>
                    <strong>{{ t('vod.video-info.chat-downloaded') }}:</strong>
                    {{ vod.is_chat_downloaded ? t('boolean.yes') : t('boolean.no') }}
                </li>
                <li>
                    <strong>{{ t('vod.video-info.chat-dumped') }}:</strong>
                    {{ vod.is_chatdump_captured ? t('boolean.yes') : t('boolean.no') }}
                </li>
                <li>
                    <strong>{{ t('vod.video-info.chat-rendered') }}:</strong>
                    {{ vod.is_chat_rendered ? t('boolean.yes') : t('boolean.no') }}
                </li>
                <li>
                    <strong>{{ t('vod.video-info.chat-burned') }}:</strong>
                    {{ vod.is_chat_burned ? t('boolean.yes') : t('boolean.no') }}
                </li>
            </ul>
        </div>

        <div class="info-column">
            <h4>{{ t('vod.video-info.capture') }}</h4>
            <ul class="video-info">
                <li v-if="vod.getDuration()">
                    <strong>{{ t('metadata.file-duration') }}:</strong>
                    {{ humanDuration(vod.getDuration()) }}
                </li>
                <li v-if="vod.segments && vod.segments.length > 0 && vod.segments[0].filesize">
                    <strong>Size:</strong>
                    {{ formatBytes(vod.segments[0].filesize) }}
                </li>
                <template v-if="vod.video_metadata && vod.video_metadata.type == 'audio'">
                    <li>
                        <strong>Total:</strong>
                        {{ Math.round(vod.video_metadata.bitrate / 1000) }}kbps
                    </li>
                    <li>
                        <strong>Audio:</strong>
                        {{ vod.video_metadata.audio_codec }}
                        {{ vod.video_metadata.audio_bitrate_mode }}
                        {{ Math.round(vod.video_metadata.audio_bitrate / 1000) }}kbps
                    </li>
                </template>
                <template v-else-if="vod.video_metadata">
                    <li>
                        <strong>{{ t('metadata.dimensions') }}:</strong>
                        {{ vod.video_metadata.width }}x{{ vod.video_metadata.height }}
                    </li>
                    <li>
                        <strong>{{ t('metadata.framerate') }}:</strong>
                        {{ vod.video_metadata.fps_mode }}
                        {{ vod.video_metadata.fps }}
                    </li>
                    <li>
                        <strong>{{ t('metadata.total') }}:</strong>
                        {{ Math.round(vod.video_metadata.bitrate / 1000) }}kbps
                    </li>
                    <li>
                        <strong>{{ t('metadata.video') }}:</strong>
                        {{ vod.video_metadata.video_codec }}
                        {{ vod.video_metadata.video_bitrate_mode }}
                        {{ Math.round(vod.video_metadata.video_bitrate / 1000) }}kbps
                    </li>
                    <li>
                        <strong>{{ t('metadata.audio') }}:</strong>
                        {{ vod.video_metadata.audio_codec }}
                        {{ vod.video_metadata.audio_bitrate_mode }}
                        {{ Math.round(vod.video_metadata.audio_bitrate / 1000) }}kbps
                    </li>
                </template>
            </ul>
        </div>

        <!-- Twitch VOD -->
        <div
            v-if="vod.provider == 'twitch'"
            class="info-column"
        >
            <h4>Twitch VOD</h4>
            <ul class="video-info">
                <template v-if="vod.twitch_vod_exists === true">
                    <li>
                        <strong>{{ t('vod.video-info.duration') }}:</strong>
                        <span
                            v-if="vod.twitch_vod_duration"
                            class="px-1"
                        >{{ humanDuration(vod.twitch_vod_duration) }}</span>
                        <span
                            v-else
                            class="px-1"
                        >
                            <strong><em>No data</em></strong>
                        </span>
                    </li>
                    <li>
                        <strong>{{ t('vod.video-info.id') }}:</strong>
                        <span
                            v-if="vod.twitch_vod_id"
                            class="px-1"
                        >
                            <a
                                :href="twitchVideoLink(vod.twitch_vod_id)"
                                rel="noreferrer"
                                target="_blank"
                                title="Open external video"
                            >{{ vod.twitch_vod_id }}</a>
                            &nbsp;<a
                                href="javascript:void(0)"
                                title="Match VOD"
                                @click="matchVod()"
                            ><fa icon="sync" /></a>
                        </span>
                        <span
                            v-else
                            class="px-1"
                        >
                            <strong><em>Not matched or VOD deleted</em></strong>
                        </span>
                    </li>
                    <li>
                        <strong>{{ t('vod.video-info.date') }}:</strong>&#32;
                        <span
                            v-if="vod.twitch_vod_date"
                            class="px-1"
                        >{{ formatDate(vod.twitch_vod_date) }}</span>
                        <span
                            v-else
                            class="px-1"
                        >
                            <strong><em>No data</em></strong>
                        </span>
                    </li>
                    <li>
                        <strong>{{ t('vod.video-info.title') }}:</strong>
                        <span
                            v-if="vod.twitch_vod_title"
                            class="px-1 text-overflow"
                        >
                            {{ vod.twitch_vod_title }}
                        </span>
                        <span
                            v-else
                            class="px-1"
                        >
                            <strong><em>No data</em></strong>
                        </span>
                    </li>
                    <li>
                        <strong>{{ t('vod.video-info.is-muted') }}:</strong>
                        <span
                            v-if="vod.twitch_vod_muted === MuteStatus.MUTED"
                            class="px-1"
                        ><strong class="text-is-error">{{ t('boolean.yes') }}</strong></span>
                        <span
                            v-else-if="vod.twitch_vod_muted === MuteStatus.UNMUTED"
                            class="px-1"
                        >{{ t('boolean.no') }}</span>
                        <span
                            v-else
                            class="px-1"
                        ><em>{{ t('boolean.no-data') }}</em></span>
                    </li>
                </template>
                <template v-else-if="vod.twitch_vod_exists === false">
                    <li>
                        <strong class="text-is-error">{{ t('vod.video-info.vod-is-deleted') }}</strong>
                        &nbsp;<a
                        href="javascript:void(0)"
                        title="Retry VOD match"
                        @click="matchVod()"
                        ><fa icon="sync" /></a>
                    </li>
                    <li>
                        <template v-if="vod.twitch_vod_id">
                            The ID was <a
                                :href="twitchVideoLink(vod.twitch_vod_id)"
                                rel="noreferrer"
                                target="_blank"
                            >{{ vod.twitch_vod_id }}</a>.
                        </template>
                        <template v-else>
                            {{ t('vod.video-info.the-vod-probably-never-got-saved') }}
                        </template>
                    </li>
                </template>
                <template v-else>
                    <li>
                        <em>{{ t('vod.video-info.vod-has-not-been-checked') }}</em>
                    </li>
                </template>
                <li>
                    <strong>{{ t('vod.video-info.downloaded') }}:</strong>
                    {{ vod.is_vod_downloaded ? t('boolean.yes') : t('boolean.no') }}
                </li>
            </ul>
        </div>

        <!-- Export Data -->
        <div
            v-if="vod.exportData && Object.keys(vod.exportData).length > 0"
            class="info-column"
        >
            <h4>{{ t('vod.video-info.export-data.title') }}</h4>
            <ul class="video-info">
                <li v-if="vod.exportData.exporter">
                    <strong>{{ t('vod.video-info.export-data.exporter') }}:</strong>
                    {{ vod.exportData.exporter }}
                </li>
                <li v-if="vod.exportData.exported_at">
                    <strong>{{ t('vod.video-info.export-data.exported-at') }}:</strong>
                    {{ formatDate(vod.exportData.exported_at) }}
                </li>
                <li v-if="vod.exportData.youtube_id">
                    <strong>{{ t('vod.video-info.export-data.youtube-id') }}:</strong>
                    {{ vod.exportData.youtube_id }}
                </li>
                <li v-if="vod.exportData.youtube_playlist_id">
                    <strong>{{ t('vod.video-info.export-data.youtube-playlist-id') }}:</strong>
                    {{ vod.exportData.youtube_playlist_id }}
                </li>
            </ul>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { useStore, VODTypes } from '@/store';
import { ApiResponse } from '@common/Api/Api';
import axios from 'axios';
import { useI18n } from 'vue-i18n';
import { MuteStatus } from "../../../common/Defs";

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

const store = useStore();
const { t } = useI18n();

function twitchVideoLink(video_id: string): string {
    return `https://www.twitch.tv/videos/${video_id}`;
}

function matchVod() {
    if (!props.vod) return;
    axios
        .post(`/api/v0/vod/${props.vod.uuid}/match`)
        .then((response) => {
            const json: ApiResponse = response.data;
            if (json.message) alert(json.message);
            console.log(json);
            // emit("refresh");
        })
        .catch((err) => {
            console.error("form error", err.response);
            if (err.response.data && err.response.data.message) alert(err.response.data.message);
        });
}

</script>

<style lang="scss" scoped>

.info-columns {
    margin-top: 1em;
    display: flex;

    padding: 0.5em;

    h4 {
        font-size: 110%;
        margin: 0;
        padding: 0;
    }

    // strong {
    //     font-weight: bold;
    //     margin-right: 0.2em;
    // }

    .info-column {
        flex-grow: 1;
        padding-right: 2em;

        &:last-child {
            padding-right: 0;
        }
    }

    .video-info {
        color: var(--text-darker);
        margin: 0;
        padding: 0;
        list-style: none;
        list-style-type: none;
        line-height: 1.4em;
        text-overflow: ellipsis;
        overflow: hidden;
        word-break: break-word;
    }
}

</style>