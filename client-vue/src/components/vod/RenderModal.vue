<template>
    <div>
        <div>
            <pre>{{ vod.basename }}</pre>
            <ul
                v-if="vod.video_metadata"
                class="list"
            >
                <li>
                    <strong>{{ $t('metadata.format') }}</strong>
                    {{ vod.video_metadata.width }}x{{ vod.video_metadata.height }}@
                    {{ vod.video_metadata.fps }}
                </li>

                <li>
                    <strong>{{ $t('metadata.video') }}</strong>
                    {{ vod.video_metadata.video_codec }}
                    {{ vod.video_metadata.video_bitrate_mode }}
                    {{ Math.round(vod.video_metadata.video_bitrate / 1000) }}kbps
                </li>

                <li>
                    <strong>{{ $t('metadata.audio') }}</strong>
                    {{ vod.video_metadata.audio_codec }}
                    {{ vod.video_metadata.audio_bitrate_mode }}
                    {{ Math.round(vod.video_metadata.audio_bitrate / 1000) }}kbps
                </li>

                <li>
                    <strong>{{ $t('metadata.general') }}</strong>
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
                > {{ $t('render-menu.render-chat') }} <strong
                    v-if="vod.is_chat_rendered"
                >(Exists)</strong></label>
            </div>
            <template v-if="burnSettings.renderChat">
                <!--<div class="field">
                        <label><input type="checkbox" v-model="burnSettings.renderTest" /> Test duration</label>
                    </div>-->
                <div class="field">
                    <label class="label">{{ $t('render-menu.chat-width') }}</label>
                    <div class="control">
                        <input
                            v-model="burnSettings.chatWidth"
                            class="input"
                            type="range"
                            min="1"
                            :max="vod.video_metadata.width"
                        >
                        <br><input
                            v-model="burnSettings.chatWidth"
                            class="input"
                            type="number"
                        >
                        <span :class="{ 'input-help': true, error: burnSettings.chatWidth % 2 }">
                            {{ $t('render-menu.chat-width-must-be-an-even-number') }}
                        </span>
                    </div>
                </div>

                <div class="field">
                    <label class="label">{{ $t('render-menu.chat-height') }}</label>
                    <div class="control">
                        <input
                            v-model="burnSettings.chatHeight"
                            class="input"
                            type="range"
                            min="1"
                            :max="vod.video_metadata.height"
                        >
                        <br><input
                            v-model="burnSettings.chatHeight"
                            class="input"
                            type="number"
                        >
                        <span :class="{ 'input-help': true, error: burnSettings.chatHeight % 2 }">
                            {{ $t('render-menu.chat-height-must-be-an-even-number') }}
                        </span>
                    </div>
                </div>

                <div class="field">
                    <label class="label">{{ $t('render-menu.video-source') }}</label>
                    <div class="select">
                        <select
                            v-model="burnSettings.vodSource"
                        >
                            <option value="captured">
                                {{ $t('render-menu.source-captured') }}
                            </option>
                            <option
                                value="downloaded"
                                :disabled="!vod.is_vod_downloaded"
                            >
                                {{ $t('render-menu.source-downloaded') }}
                            </option>
                        </select>
                    </div>
                </div>

                <div class="field">
                    <label class="label">{{ $t('render-menu.chat-source') }}</label>
                    <div class="select">
                        <select
                            v-model="burnSettings.chatSource"
                        >
                            <option value="captured">
                                {{ $t('render-menu.source-captured') }}
                            </option>
                            <option
                                value="downloaded"
                                :disabled="!vod.is_chat_downloaded"
                            >
                                {{ $t('render-menu.source-downloaded') }}
                            </option>
                        </select>
                    </div>
                </div>

                <div class="field">
                    <label class="label">{{ $t('render-menu.font') }}</label>
                    <div class="control">
                        <input
                            v-model="burnSettings.chatFont"
                            class="input"
                            list="font"
                        >
                        <datalist id="font">
                            <option value="Arial" />
                            <option value="Inter" />
                        </datalist>
                    </div>
                </div>
                <div class="field">
                    <label class="label">{{ $t('render-menu.font-size') }}</label>
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
                    <label class="label">{{ $t('render-menu.offset-seconds') }}</label>
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
                        {{ $t('render-menu.test-duration-dont-burn-entire-video') }}
                    </div>
                </div>
                <div class="field">
                    <label class="label">{{ $t('render-menu.chat-horizontal') }}</label>
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
                    <label class="label">{{ $t('render-menu.chat-vertical') }}</label>
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
        <div class="field">
            <button
                class="button is-confirm"
                @click="doRenderWizard"
            >
                <span class="icon">
                    <fa icon="burn" />
                </span>
                <span>Execute</span>
            </button>
            <span v-if="burnLoading">Running...</span>
        </div>
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

<script lang="ts">
import { useStore } from '@/store';
import { ApiResponse } from '@common/Api/Api';
import { ApiJob } from '@common/Api/Client';
import { defineComponent } from 'vue';

export default defineComponent({
    name: 'BurnWizard',
    props: {
        vod: {
            type: Object,
            required: true,
        },
    },
    emits: ['refresh'],
    setup() {
        const store = useStore();
        return {
            store,
        };
    },
    data() {
        return {
            burnLoading: false,
            burnSettings: {
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
            },
        };
    },
    computed: {
        burnPreviewChat(): Record<string, string> {
            if (!this.vod || !this.vod.video_metadata || this.vod.video_metadata.type == 'audio') return {};
            return {
                width: `${(this.burnSettings.chatWidth / this.vod.video_metadata.width) * 100}%`,
                height: `${(this.burnSettings.chatHeight / this.vod.video_metadata.height) * 100}%`,
                left: this.burnSettings.burnHorizontal == "left" ? "0" : "",
                right: this.burnSettings.burnHorizontal == "right" ? "0" : "",
                top: this.burnSettings.burnVertical == "top" ? "0" : "",
                bottom: this.burnSettings.burnVertical == "bottom" ? "0" : "",
                fontSize: `${this.burnSettings.chatFontSize * 0.35}px`,
                fontFamily: this.burnSettings.chatFont,
            };
        },
        burnJobs(): ApiJob[] {
            if (!this.store.jobList) return [];
            const jobs: ApiJob[] = [];
            for (const job of this.store.jobList) {
                if (job.name == `tdrender_${this.vod?.basename}` || job.name == `burnchat_${this.vod?.basename}`) {
                    jobs.push(job);
                }
            }
            return jobs;
        },
    },
    mounted() {
        const chatHeight: number = 
            this.vod && 
            this.vod.video_metadata && 
            this.vod.video_metadata.type !== 'audio' && 
            this.store.cfg<boolean>("chatburn.default.auto_chat_height")
            ?
            this.vod.video_metadata.height
            :
            this.store.cfg<number>("chatburn.default.chat_height")
        ;

        this.burnSettings = {
            ...this.burnSettings,
            chatWidth: this.store.cfg<number>("chatburn.default.chat_width"),
            chatHeight: chatHeight,
            chatFont: this.store.cfg<string>("chatburn.default.chat_font"),
            chatFontSize: this.store.cfg<number>("chatburn.default.chat_font_size"),
            burnHorizontal: this.store.cfg<string>("chatburn.default.horizontal"),
            burnVertical: this.store.cfg<string>("chatburn.default.vertical"),
            ffmpegPreset: this.store.cfg<string>("chatburn.default.preset"),
            ffmpegCrf: this.store.cfg<number>("chatburn.default.crf"),
        };
    },
    methods: {
        doRenderWizard() {
            if (!this.vod) return;
            this.burnLoading = true;
            console.debug("doRenderWizard", this.burnSettings);
            this.$http
                .post(`/api/v0/vod/${this.vod.uuid}/renderwizard`, this.burnSettings)
                .then((response) => {
                    const json: ApiResponse = response.data;
                    if (json.message) alert(json.message);
                    console.log(json);
                    this.$emit("refresh");
                })
                .catch((err) => {
                    console.error("form error", err.response);
                    if (err.response.data && err.response.data.message) alert(err.response.data.message);
                })
                .finally(() => {
                    this.burnLoading = false;
                });
        },
    }
});

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