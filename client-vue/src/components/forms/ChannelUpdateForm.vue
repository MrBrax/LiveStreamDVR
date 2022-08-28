<template>
    <div :id="'channelupdate_' + channel.login">
        <form @submit.prevent="submitForm">
            <div class="field">
                <label class="label" :for="`input_${channel.login}_quality`">{{ $t('forms.channel.quality') }} <span class="required">*</span></label>
                <div class="control">
                    <input
                        class="input input-required"
                        type="text"
                        :id="`input_${channel.login}_quality`"
                        v-model="formData.quality"
                        required
                        ref="quality"
                        name="quality"
                    />
                    <p class="input-help">{{ $t('forms.channel.quality-help-example') }}</p>
                    <p class="input-help"><strong>{{ $t('forms.channel.quality-help-warning') }}</strong></p>
                    <!--<p class="input-help">{{ $t('forms.channel.quality-help-choices', [VideoQualityArray.join(", ")]) }}</p>-->
                    <p class="input-help error" v-if="!qualityWarning">
                        {{ $t('forms.channel.quality-help-check') }}
                    </p>
                </div>
            </div>

            <div class="field">
                <label class="label" :for="`input_${channel.login}_match`">{{ $t('forms.channel.match-keywords') }}</label>
                <div class="control">
                    <input
                        class="input"
                        type="text"
                        :id="`input_${channel.login}_match`"
                        name="match"
                        v-model="formData.match"
                    />
                    <p class="input-help">Separate by commas, e.g. christmas,media share,opening,po box</p>
                </div>
            </div>

            <div class="field">
                <label class="label">{{ $t('forms.channel.max-storage') }}</label>
                <div class="control">
                    <input class="input" type="number" name="max_storage" v-model="formData.max_storage" />
                    <p class="input-help">{{ $t('forms.channel.max-storage-help') }}</p>
                </div>
            </div>

            <div class="field">
                <label class="label">{{ $t('forms.channel.max-vods') }}</label>
                <div class="control">
                    <input class="input" type="number" name="max_vods" v-model="formData.max_vods" />
                    <p class="input-help">{{ $t('forms.channel.max-vods-help') }}</p>
                </div>
            </div>

            <div class="field">
                <label class="checkbox">
                    <input
                        class="input"
                        type="checkbox"
                        name="download_chat"
                        v-model="formData.download_chat"
                    />
                    {{ $t('forms.channel.download-chat') }}
                </label>
            </div>

            <div class="field">
                <label class="checkbox">
                    <input
                        class="input"
                        type="checkbox"
                        name="live_chat"
                        v-model="formData.live_chat"
                    />
                    {{ $t('forms.channel.live-chat-download') }}
                </label>
                <p class="input-help">Requires Node binary path to be set in the settings</p>
            </div>

            <div class="field">
                <label class="checkbox">
                    <input
                        class="input"
                        type="checkbox"
                        name="burn_chat"
                        v-model="formData.burn_chat"
                    />
                    {{ $t('forms.channel.burn-chat') }}
                </label>
                <p class="input-help">Currently disabled</p>
            </div>

            <div class="field">
                <label class="checkbox">
                    <input
                        class="input"
                        type="checkbox"
                        name="no_capture"
                        v-model="formData.no_capture"
                    />
                    {{ $t('forms.channel.no-capture') }}
                </label>
            </div>

            <div class="field">
                <label class="checkbox">
                    <input
                        type="checkbox"
                        name="no_cleanup"
                        v-model="formData.no_cleanup"
                    />
                    {{ $t('forms.channel.no-cleanup') }}
                </label>
            </div>

            <div class="field">
                <label class="checkbox">
                    <input
                        type="checkbox"
                        name="download_vod_at_end"
                        v-model="formData.download_vod_at_end"
                    />
                    {{ $t('forms.channel.download_vod_at_end') }}
                </label>
            </div>

            <div class="field" v-if="formData.download_vod_at_end">
                <label class="label">{{ $t('forms.channel.download_vod_at_end_quality') }}</label>
                <div class="select">
                    <select name="download_vod_at_end_quality" v-model="formData.download_vod_at_end_quality">
                        <option v-for="quality in VideoQualityArray" :value="quality">{{ quality }}</option>
                    </select>
                </div>
                <p class="input-help">{{ $t('forms.channel.download_vod_at_end_quality_help') }}</p>
            </div>
            

            <div class="field form-submit">
                <div class="control">
                    <button class="button is-confirm" type="submit">
                        <span class="icon"><fa icon="save"></fa></span>
                        <span>{{ $t('buttons.save') }}</span>
                    </button>
                </div>
                <div :class="formStatusClass">{{ formStatusText }}</div>
            </div>
        </form>
        <hr />

        <div class="buttons">
            <button class="button is-small is-danger" @click="deleteChannel">
                <span class="icon"><fa icon="trash"></fa></span>
                <span>{{ $t('buttons.delete') }}</span>
            </button>
            <button class="button is-small is-danger" @click="deleteAllVods">
                <span class="icon"><fa icon="video-slash"></fa></span>
                <span>{{ $t('buttons.delete-all-vods') }}</span>
            </button>
            <button class="button is-small is-confirm" @click="subscribeChannel">
                <span class="icon"><fa icon="sync"></fa></span>
                <span>{{ $t('buttons.subscribe') }}</span>
            </button>
            <button class="button is-small is-confirm" @click="renameChannel">
                <span class="icon"><fa icon="pencil"></fa></span>
                <span>{{ $t('buttons.rename') }}</span>
            </button>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { VideoQualityArray } from "../../../../common/Defs";

import { library } from "@fortawesome/fontawesome-svg-core";
import { faSave } from "@fortawesome/free-solid-svg-icons";
import { ApiChannelConfig } from "@common/Api/Client";
import { AxiosError } from "axios";
import { useStore } from "@/store";
library.add(faSave);

export default defineComponent({
    name: "ChannelUpdateForm",
    props: {
        channel: {
            type: Object as () => ApiChannelConfig,
            required: true,
        },
    },
    emits: ["formSuccess"],
    setup() {
        const store = useStore();
        return { VideoQualityArray, store };
    },
    data() {
        return {
            formStatusText: "Ready",
            formStatus: "",
            formData: {
                quality: this.channel.quality ? this.channel.quality.join(" ") : "",
                match: this.channel.match ? this.channel.match.join(",") : "",
                download_chat: this.channel.download_chat || false,
                live_chat: this.channel.live_chat || false,
                burn_chat: this.channel.burn_chat || false,
                no_capture: this.channel.no_capture || false,
                no_cleanup: this.channel.no_cleanup || false,
                max_storage: this.channel.max_storage || 0,
                max_vods: this.channel.max_vods || 0,
                download_vod_at_end: this.channel.download_vod_at_end || false,
                download_vod_at_end_quality: this.channel.download_vod_at_end_quality || "best",
            },
        };
    },
    methods: {
        submitForm(event: Event) {

            this.formStatusText = this.$t('messages.loading');
            this.formStatus = "";

            this.$http
                .put(`/api/v0/channels/${this.channel.login}`, this.formData)
                .then((response) => {
                    const json = response.data;
                    this.formStatusText = json.message;
                    this.formStatus = json.status;
                    if (json.status == "OK") {
                        this.$emit("formSuccess", json);
                        this.store.fetchAndUpdateStreamerList();
                    }
                })
                .catch((err: Error | AxiosError) => {
                    if (this.axios.isAxiosError(err) && err.response) {
                        console.error("channel update form error", err.response);
                        this.formStatusText = err.response.data.message;
                        this.formStatus = err.response.data.status;
                    } else {
                        console.error("channel update form error", err);
                        alert(`Error: ${err.message}`);
                    }
                });

            event.preventDefault();
            return false;
        },
        deleteChannel() {
            if (!confirm(`Do you want to delete "${this.channel.login}"? This cannot be undone.`)) return;

            const deleteVodsToo = confirm(
                `Do you also want to delete all VODs for "${this.channel.login}"? OK to delete all VODs and channel, Cancel to delete only the channel.`
            );

            this.$http
                .delete(`/api/v0/channels/${this.channel.login}`,
                    {
                        params: {
                            deletevods: deleteVodsToo ? "1" : "0",
                        },
                    })
                .then((response) => {
                    const json = response.data;
                    if (json.message) alert(json.message);
                    console.log(json);
                    this.$emit("formSuccess", json);
                    this.store.fetchAndUpdateStreamerList();
                })
                .catch((err) => {
                    console.error("form error", err.response);
                    if (err.response.data && err.response.data.message) {
                        alert(err.response.data.message);
                    }
                });
        },
        subscribeChannel() {

            if (!this.store.cfg("app_url") || this.store.cfg("app_url") == "debug") {
                alert("Please set the app url in the settings");
                return;
            }

            this.$http
                .post(`/api/v0/channels/${this.channel.login}/subscribe`)
                .then((response) => {
                    const json = response.data;
                    if (json.message) alert(json.message);
                    console.log(json);
                    this.$emit("formSuccess", json);
                })
                .catch((err) => {
                    console.error("form error", err.response);
                    if (err.response.data && err.response.data.message) {
                        alert(err.response.data.message);
                    }
                });
        },
        /*
        validateQuality() {
            const input = this.formData.quality.split(" ");
            const valid = input.every((quality) => VideoQualityArray.includes(quality));
            const field = this.$refs.quality as HTMLInputElement;
            if (!valid) {
                field.setCustomValidity("Invalid quality");
                field.reportValidity();
            } else {
                if (input.includes("audio_only") && input.length > 1) {
                    field.setCustomValidity("Audio only cannot be combined with other qualities");
                    field.reportValidity();
                } else {
                    field.setCustomValidity("");
                }
            }
        },
        */
        renameChannel() {
            const newLogin = prompt("Enter new channel login. If channel has not changed login, this will fail in the future.\n", this.channel.login);
            if (!newLogin || newLogin == this.channel.login) return;
            this.$http
                .post(`/api/v0/channels/${this.channel.login}/rename`, {
                    new_login: newLogin,
                })
                .then((response) => {
                    const json = response.data;
                    if (json.message) alert(json.message);
                    console.log(json);
                    this.$emit("formSuccess", json);
                    this.store.fetchAndUpdateStreamerList();
                })
                .catch((err) => {
                    console.error("form error", err.response);
                    if (err.response.data && err.response.data.message) {
                        alert(err.response.data.message);
                    }
                });
        },
        deleteAllVods() {
            if (!confirm(`Do you want to delete all VODs for "${this.channel.login}"? This cannot be undone.`)) return;
            this.$http
                .post(`/api/v0/channels/${this.channel.login}/deleteallvods`)
                .then((response) => {
                    const json = response.data;
                    if (json.message) alert(json.message);
                    console.log(json);
                    this.$emit("formSuccess", json);
                    this.store.fetchAndUpdateStreamerList();
                })
                .catch((err) => {
                    console.error("form error", err.response);
                    if (err.response.data && err.response.data.message) {
                        alert(err.response.data.message);
                    }
                });
        },
    },
    computed: {
        formStatusClass(): Record<string, boolean> {
            return {
                "form-status": true,
                "is-error": this.formStatus == "ERROR",
                "is-success": this.formStatus == "OK",
            };
        },
        qualityWarning(): boolean {
            return this.formData.quality.includes("best") || this.formData.quality.includes("worst");
        }
    },
});
</script>
