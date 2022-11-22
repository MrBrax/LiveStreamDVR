<template>
    <div>
        <div>
            <pre>{{ vod.basename }}</pre>
            <ul
                v-if="vod.video_metadata"
                class="list"
            >
                <li v-if="vod.video_metadata.type == 'video'">
                    <strong>{{ t('metadata.format') }}</strong>
                    {{ vod.video_metadata.width }}x{{ vod.video_metadata.height }}@
                    {{ vod.video_metadata.fps }}
                </li>

                <li v-if="vod.video_metadata.type == 'video'">
                    <strong>{{ t('metadata.video') }}</strong>
                    {{ vod.video_metadata.video_codec }}
                    {{ vod.video_metadata.video_bitrate_mode }}
                    {{ Math.round(vod.video_metadata.video_bitrate / 1000) }}kbps
                </li>

                <li>
                    <strong>{{ t('metadata.audio') }}</strong>
                    {{ vod.video_metadata.audio_codec }}
                    {{ vod.video_metadata.audio_bitrate_mode }}
                    {{ Math.round(vod.video_metadata.audio_bitrate / 1000) }}kbps
                </li>

                <li>
                    <strong>{{ t('metadata.general') }}</strong>
                    {{ formatBytes(vod.video_metadata.size) }} / {{ vod.video_metadata.duration }}
                </li>
            </ul>
            <div class="notice is-error">
                Burning chat seems to work pretty good, but dumped chat+video has a pretty large offset, I have yet to
                find the offset anywhere.
            </div>
        </div>
        <hr>
        <div class="burn-preview">
            <div
                class="burn-preview-chat"
                :style="burnPreviewChat"
            >
                Anon: Hello World<br>
                Anon: Hello World<br>
                Anon: Hello World<br>
                Anon: Hello World<br>
                Anon: Hello World<br>
                Anon: Hello World<br>
                Anon: Hello World<br>
                Anon: Hello World<br>
                Anon: Hello World<br>
                Anon: Hello World<br>
                Anon: Hello World<br>
                Anon: Hello World<br>
                Anon: Hello World<br>
                Anon: Hello World<br>
                Anon: Hello World<br>
                Anon: Hello World<br>
                Anon: Hello World<br>
                Anon: Hello World<br>
                Anon: Hello World<br>
                Anon: Hello World<br>
                Anon: Hello World<br>
                Anon: Hello World<br>
                Anon: Hello World<br>
                Anon: Hello World<br>
                Anon: Hello World<br>
                Anon: Hello World<br>
                Anon: Hello World<br>
                Anon: Hello World<br>
                Anon: Hello World<br>
                Anon: Hello World<br>
                Anon: Hello World<br>
                Anon: Hello World<br>
                Anon: Hello World<br>
                Anon: Hello World<br>
                Anon: Hello World<br>
                Anon: Hello World<br>
            </div>
        </div>
        <div class="field-group">
            <div class="field">
                <label><input
                    v-model="burnSettings.renderChat"
                    type="checkbox"
                > {{ t('render-menu.render-chat') }} <strong
                    v-if="vod.is_chat_rendered"
                >(Exists)</strong></label>
            </div>
            <template v-if="burnSettings.renderChat">
                <!--<div class="field">
                        <label><input type="checkbox" v-model="burnSettings.renderTest" /> Test duration</label>
                    </div>-->
                <div class="field">
                    <label class="label">{{ t('render-menu.chat-width') }}</label>
                    <div class="control">
                        <input
                            v-model="burnSettings.chatWidth"
                            class="input"
                            type="range"
                            min="1"
                            :max="vod.video_metadata && vod.video_metadata.type == 'video' ? vod.video_metadata.width : undefined"
                        >
                        <br><input
                            v-model="burnSettings.chatWidth"
                            class="input"
                            type="number"
                        >
                        <span :class="{ 'input-help': true, error: burnSettings.chatWidth % 2 }">
                            {{ t('render-menu.chat-width-must-be-an-even-number') }}
                        </span>
                    </div>
                </div>

                <div class="field">
                    <label class="label">{{ t('render-menu.chat-height') }}</label>
                    <div class="control">
                        <input
                            v-model="burnSettings.chatHeight"
                            class="input"
                            type="range"
                            min="1"
                            :max="vod.video_metadata && vod.video_metadata.type == 'video' ? vod.video_metadata.height : undefined"
                        >
                        <br><input
                            v-model="burnSettings.chatHeight"
                            class="input"
                            type="number"
                        >
                        <span :class="{ 'input-help': true, error: burnSettings.chatHeight % 2 }">
                            {{ t('render-menu.chat-height-must-be-an-even-number') }}
                        </span>
                    </div>
                </div>

                <div class="field">
                    <label class="label">{{ t('render-menu.video-source') }}</label>
                    <div class="select">
                        <select
                            v-model="burnSettings.vodSource"
                        >
                            <option value="captured">
                                {{ t('render-menu.source-captured') }}
                            </option>
                            <option
                                value="downloaded"
                                :disabled="!vod.is_vod_downloaded"
                            >
                                {{ t('render-menu.source-downloaded') }}
                            </option>
                        </select>
                    </div>
                </div>

                <div class="field">
                    <label class="label">{{ t('render-menu.chat-source') }}</label>
                    <div
                        v-if="vod.is_chatdump_captured || vod.is_chat_downloaded"
                        class="select"
                    >
                        <select
                            v-model="burnSettings.chatSource"
                        >
                            <option
                                value="captured"
                                :disabled="!vod.is_chatdump_captured"
                            >
                                {{ t('render-menu.source-captured') }}
                            </option>
                            <option
                                value="downloaded"
                                :disabled="!vod.is_chat_downloaded"
                            >
                                {{ t('render-menu.source-downloaded') }}
                            </option>
                        </select>
                    </div>
                    <div
                        v-else
                        class="notice is-error"
                    >
                        {{ t('render-menu.chat-source-not-available') }}
                    </div>
                </div>

                <div class="field">
                    <label class="label">{{ t('render-menu.font') }}</label>
                    <div class="control">
                        <input
                            v-model="burnSettings.chatFont"
                            class="input is-fullwidth"
                            list="font"
                        >
                        <datalist id="font">
                            <option value="Arial" />
                            <option value="Inter" />
                        </datalist>
                    </div>
                </div>
                <div class="field">
                    <label class="label">{{ t('render-menu.font-size') }}</label>
                    <div class="control">
                        <input
                            v-model="burnSettings.chatFontSize"
                            class="input"
                            type="range"
                            min="1"
                            max="72"
                        >
                        <br><input
                            v-model="burnSettings.chatFontSize"
                            class="input"
                            type="number"
                        >
                    </div>
                </div>
            </template>
        </div>
        <div class="field-group">
            <div class="field">
                <label>
                    <input
                        v-model="burnSettings.burnChat"
                        type="checkbox"
                        :disabled="!burnSettings.renderChat && !vod.is_chat_rendered"
                    >
                    Burn chat <strong v-if="vod.is_chat_burned">(Exists)</strong>
                </label>
            </div>
            <template v-if="burnSettings.burnChat">
                <!--<div class="field">
                        <label><input type="checkbox" v-model="burnSettings.burnTest" /> Test duration</label>
                    </div>-->
                <div class="field">
                    <label class="label">{{ t('render-menu.offset-seconds') }}</label>
                    <div class="control">
                        <input
                            v-model="burnSettings.burnOffset"
                            class="input"
                            type="number"
                        >
                    </div>
                </div>
                <div class="field">
                    <div class="control">
                        <input
                            v-model="burnSettings.testDuration"
                            type="checkbox"
                        >
                        {{ t('render-menu.test-duration-dont-burn-entire-video') }}
                    </div>
                </div>
                <div class="field">
                    <label class="label">{{ t('render-menu.chat-horizontal') }}</label>
                    <div class="select">
                        <select
                            v-model="burnSettings.burnHorizontal"
                        >
                            <option value="left">
                                Left
                            </option>
                            <option value="right">
                                Right
                            </option>
                        </select>
                    </div>
                </div>
                <div class="field">
                    <label class="label">{{ t('render-menu.chat-vertical') }}</label>
                    <div class="select">
                        <select
                            v-model="burnSettings.burnVertical"
                        >
                            <option value="top">
                                Top
                            </option>
                            <option value="bottom">
                                Bottom
                            </option>
                        </select>
                    </div>
                </div>
                <div class="field">
                    <label class="label">ffmpeg preset</label>
                    <div class="select">
                        <select
                            v-model="burnSettings.ffmpegPreset"
                        >
                            <option value="ultrafast">
                                Ultrafast
                            </option>
                            <option value="superfast">
                                Superfast
                            </option>
                            <option value="veryfast">
                                Veryfast
                            </option>
                            <option value="faster">
                                Faster
                            </option>
                            <option value="fast">
                                Fast
                            </option>
                            <option value="medium">
                                Medium
                            </option>
                            <option value="slow">
                                Slow
                            </option>
                            <option value="slower">
                                Slower
                            </option>
                            <option value="veryslow">
                                Veryslow
                            </option>
                        </select>
                    </div>
                </div>
                <div class="field">
                    <label class="label">ffmpeg crf</label>
                    <div class="control">
                        <input
                            v-model="burnSettings.ffmpegCrf"
                            class="input"
                            type="range"
                            min="0"
                            max="51"
                        >
                        <br>{{ burnSettings.ffmpegCrf }}
                    </div>
                </div>
            </template>
        </div>
        <FormSubmit
            :form-status="formStatus"
            :form-status-text="formStatusText"
        >
            <d-button
                color="success"
                icon="burn"
                @click="doRenderWizard"
            >
                {{ t('buttons.execute') }}
            </d-button>
        </FormSubmit>
        <div class="job-status">
            <table>
                <tr
                    v-for="job in burnJobs"
                    :key="job.pid"
                >
                    <td>
                        <span v-if="job.status">
                            <span class="fa fa-spinner fa-spin" />
                        </span>
                        <span v-else>
                            <span class="fa fa-times" />
                        </span>
                    </td>
                    <td>
                        {{ job.name }}
                    </td>
                </tr>
            </table>
        </div>
    </div>
</template>

<script lang="ts" setup>
import FormSubmit from "@/components/reusables/FormSubmit.vue";
import { formatBytes } from "@/mixins/newhelpers";
import { useStore } from '@/store';
import type { FormStatus, VODTypes } from '@/twitchautomator';
import type { ApiResponse } from '@common/Api/Api';
import type { ApiJob } from '@common/Api/Client';
import axios from 'axios';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
    vod: VODTypes,
}>();

const emit = defineEmits<{
    (event: 'refresh'): void
}>();

const store = useStore();
const { t } = useI18n();

const formStatusText = ref<string>("Ready");
const formStatus = ref<FormStatus>("IDLE");

const burnSettings = ref({
    renderChat: false,
    burnChat: false,
    renderTest: false,
    burnTest: false,
    chatWidth: 300,
    chatHeight: 300,
    vodSource: "captured",
    chatSource: "captured",
    chatFont: "Inter",
    chatFontSize: 12,
    burnHorizontal: "left",
    burnVertical: "top",
    ffmpegPreset: "slow",
    ffmpegCrf: 26,
    burnOffset: 0,
    testDuration: false,
});

const burnPreviewChat = computed((): Record<string, string> => {
    if (!props.vod || !props.vod.video_metadata || props.vod.video_metadata.type == 'audio') return {};
    return {
        width: `${(burnSettings.value.chatWidth / props.vod.video_metadata.width) * 100}%`,
        height: `${(burnSettings.value.chatHeight / props.vod.video_metadata.height) * 100}%`,
        left: burnSettings.value.burnHorizontal == "left" ? "0" : "",
        right: burnSettings.value.burnHorizontal == "right" ? "0" : "",
        top: burnSettings.value.burnVertical == "top" ? "0" : "",
        bottom: burnSettings.value.burnVertical == "bottom" ? "0" : "",
        fontSize: `${burnSettings.value.chatFontSize * 0.35}px`,
        fontFamily: burnSettings.value.chatFont,
    };
});

const burnJobs = computed((): ApiJob[] => {
    if (!store.jobList) return [];
    const jobs: ApiJob[] = [];
    for (const job of store.jobList) {
        if (job.name == `tdrender_${props.vod?.basename}` || job.name == `burnchat_${props.vod?.basename}`) {
            jobs.push(job);
        }
    }
    return jobs;
});

onMounted(() => {
        const chatHeight: number = 
            props.vod && 
            props.vod.video_metadata && 
            props.vod.video_metadata.type !== 'audio' && 
            store.cfg<boolean>("chatburn.default.auto_chat_height")
            ?
            props.vod.video_metadata.height
            :
            store.cfg<number>("chatburn.default.chat_height")
        ;

        burnSettings.value = {
            ...burnSettings.value,
            chatWidth: store.cfg<number>("chatburn.default.chat_width"),
            chatHeight: chatHeight,
            chatFont: store.cfg<string>("chatburn.default.chat_font"),
            chatFontSize: store.cfg<number>("chatburn.default.chat_font_size"),
            burnHorizontal: store.cfg<string>("chatburn.default.horizontal"),
            burnVertical: store.cfg<string>("chatburn.default.vertical"),
            ffmpegPreset: store.cfg<string>("chatburn.default.preset"),
            ffmpegCrf: store.cfg<number>("chatburn.default.crf"),
        };
});

function doRenderWizard() {
    if (!props.vod) return;
    formStatus.value = "LOADING";
    console.debug("doRenderWizard", burnSettings.value);
    axios
        .post<ApiResponse>(`/api/v0/vod/${props.vod.uuid}/renderwizard`, burnSettings.value)
        .then((response) => {
            const json: ApiResponse = response.data;
            // if (json.message) alert(json.message);
            formStatus.value = json.status;
            formStatusText.value = json.message || "No message";
            console.log(json);
            emit("refresh");
        })
        .catch((err) => {
            console.error("form error", err.response);
            // if (err.response.data && err.response.data.message) alert(err.response.data.message);
            formStatus.value = "ERROR";
            formStatusText.value = err.response.data.message || "No message";
        })
        .finally(() => {
            // burnLoading.value = false;
        });
} 

</script>

<style lang="scss" scoped>
    .burn-preview {
        position: relative;
        width: 320px;
        aspect-ratio: 16/9;
        background-color: #eee;
        margin-bottom: 1rem;
        border: 1px solid #333;
        .burn-preview-chat {
            position: absolute;
            // top: 0;
            // left: 0;
            height: 100%;
            width: 50px;
            background-color: #000;
            opacity: 0.5;
            color: #fff;
            // font-size: 2px;
            overflow: hidden;
            padding: 1px;
        }
    }
    </style>