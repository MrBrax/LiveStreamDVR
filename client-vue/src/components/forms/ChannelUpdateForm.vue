<template>
    <div :id="'channelupdate_' + channel.uuid">
        <form @submit.prevent="submitForm">
            <div class="field">
                <label class="label">{{ t('forms.channel.provider') }}</label>
                <div class="control">
                    <input
                        class="input input-required"
                        type="text"
                        :value="channel.provider"
                        disabled
                        readonly
                    >
                </div>
            </div>

            <div class="field">
                <label class="label">{{ t('forms.channel.uuid') }}</label>
                <div class="control">
                    <input
                        class="input input-required"
                        type="text"
                        :value="channel.uuid"
                        disabled
                        readonly
                    >
                </div>
            </div>

            <div
                v-if="'login' in channel"
                class="field"
            >
                <label class="label">{{ t('forms.channel.login') }}</label>
                <div class="control">
                    <input
                        class="input"
                        type="text"
                        :value="channel.login"
                        disabled
                        readonly
                    >
                </div>
            </div>

            <div
                v-if="'channel_id' in channel"
                class="field"
            >
                <label class="label">{{ t('forms.channel.id') }}</label>
                <div class="control">
                    <input
                        class="input"
                        type="text"
                        :value="channel.channel_id"
                        disabled
                        readonly
                    >
                </div>
            </div>

            <div class="field">
                <label
                    class="label"
                    :for="`input_${channel.uuid}_quality`"
                >{{ t('forms.channel.quality') }} <span class="required">*</span></label>
                <div class="control">
                    <input
                        :id="`input_${channel.uuid}_quality`"
                        ref="quality"
                        v-model="formData.quality"
                        class="input input-required"
                        type="text"
                        required
                        name="quality"
                    >
                    <p class="input-help">
                        {{ t('forms.channel.quality-help-example') }}
                    </p>
                    <p class="input-help">
                        <strong>{{ t('forms.channel.quality-help-warning') }}</strong>
                    </p>
                    <!--<p class="input-help">{{ t('forms.channel.quality-help-choices', [VideoQualityArray.join(", ")]) }}</p>-->
                    <p
                        v-if="!qualityWarning"
                        class="input-help error"
                    >
                        {{ t('forms.channel.quality-help-check') }}
                    </p>
                </div>
            </div>

            <div class="field">
                <label
                    class="label"
                    :for="`input_${channel.uuid}_match`"
                >{{ t('forms.channel.match-keywords') }}</label>
                <div class="control">
                    <input
                        :id="`input_${channel.uuid}_match`"
                        v-model="formData.match"
                        class="input"
                        type="text"
                        name="match"
                    >
                    <p class="input-help">
                        Separate by commas, e.g. christmas,media share,opening,po box
                    </p>
                </div>
            </div>

            <div class="field">
                <label class="label">{{ t('forms.channel.max-storage') }}</label>
                <div class="control">
                    <input
                        v-model="formData.max_storage"
                        class="input"
                        type="number"
                        name="max_storage"
                    >
                    <p class="input-help">
                        {{ t('forms.channel.max-storage-help') }}
                    </p>
                </div>
            </div>

            <div class="field">
                <label class="label">{{ t('forms.channel.max-vods') }}</label>
                <div class="control">
                    <input
                        v-model="formData.max_vods"
                        class="input"
                        type="number"
                        name="max_vods"
                    >
                    <p class="input-help">
                        {{ t('forms.channel.max-vods-help') }}
                    </p>
                </div>
            </div>

            <div class="field">
                <label class="checkbox">
                    <input
                        v-model="formData.download_chat"
                        type="checkbox"
                        name="download_chat"
                    >
                    {{ t('forms.channel.download-chat') }}
                </label>
            </div>

            <div class="field">
                <label class="checkbox">
                    <input
                        v-model="formData.live_chat"
                        type="checkbox"
                        name="live_chat"
                    >
                    {{ t('forms.channel.live-chat-download') }}
                </label>
                <p class="input-help">
                    Requires Node binary path to be set in the settings
                </p>
            </div>

            <div class="field">
                <label class="checkbox">
                    <input
                        v-model="formData.burn_chat"
                        type="checkbox"
                        name="burn_chat"
                    >
                    {{ t('forms.channel.burn-chat') }}
                </label>
                <p class="input-help">
                    Currently disabled
                </p>
            </div>

            <div class="field">
                <label class="checkbox">
                    <input
                        v-model="formData.no_capture"
                        type="checkbox"
                        name="no_capture"
                    >
                    {{ t('forms.channel.no-capture') }}
                </label>
            </div>

            <div class="field">
                <label class="checkbox">
                    <input
                        v-model="formData.no_cleanup"
                        type="checkbox"
                        name="no_cleanup"
                    >
                    {{ t('forms.channel.no-cleanup') }}
                </label>
            </div>

            <div class="field">
                <label class="checkbox">
                    <input
                        v-model="formData.download_vod_at_end"
                        type="checkbox"
                        name="download_vod_at_end"
                    >
                    {{ t('forms.channel.download_vod_at_end') }}
                </label>
            </div>

            <div
                v-if="formData.download_vod_at_end"
                class="field"
            >
                <label class="label">{{ t('forms.channel.download_vod_at_end_quality') }}</label>
                <div class="select">
                    <select
                        v-model="formData.download_vod_at_end_quality"
                        name="download_vod_at_end_quality"
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
                <p class="input-help">
                    {{ t('forms.channel.download_vod_at_end_quality_help') }}
                </p>
            </div>

            <div class="field form-submit">
                <div class="control">
                    <button
                        class="button is-confirm"
                        type="submit"
                    >
                        <span class="icon"><fa icon="save" /></span>
                        <span>{{ t('buttons.save') }}</span>
                    </button>
                </div>
                <div :class="formStatusClass">
                    {{ formStatusText }}
                </div>
            </div>
        </form>
        <hr>
        <div class="buttons">
            <button
                class="button is-small is-danger"
                @click="deleteChannel"
            >
                <span class="icon"><fa icon="trash" /></span>
                <span>{{ t('buttons.delete') }}</span>
            </button>
            <button
                class="button is-small is-danger"
                @click="deleteAllVods"
            >
                <span class="icon"><fa icon="video-slash" /></span>
                <span>{{ t('buttons.delete-all-vods') }}</span>
            </button>
            <button
                class="button is-small"
                @click="subscribeChannel"
            >
                <span class="icon"><fa icon="sync" /></span>
                <span>{{ t('buttons.subscribe') }}</span>
            </button>
            <button
                class="button is-small"
                @click="checkSubscriptions"
            >
                <span class="icon"><fa icon="list" /></span>
                <span>{{ t('buttons.check-subscriptions') }}</span>
            </button>
            <button
                class="button is-small"
                @click="renameChannel"
            >
                <span class="icon"><fa icon="pencil" /></span>
                <span>{{ t('buttons.rename') }}</span>
            </button>
        </div>
        <hr>
        <div>
            <h2>History</h2>
            <div class="field">
                <button
                    class="button is-small is-confirm"
                    @click="fetchHistory"
                >
                    <span class="icon"><fa icon="sync" /></span>
                    <span>{{ t('buttons.fetch') }}</span>
                </button>
            </div>
            <table
                v-if="history.length"
                class="table is-striped"
            >
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Action</th>
                        <th>Title</th>
                        <th>View count</th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="(item, i) in history"
                        :key="i"
                    >
                        <template v-if="'action' in item">
                            <td>{{ formatDate(item.time) }}</td>
                            <td>{{ item.action }}</td>
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
                        </template>
                        <template v-else>
                            <td>{{ formatDate(item.started_at) }}</td>
                            <td>Chapter change</td>
                            <td>{{ item.title }}</td>
                            <td>{{ item.viewer_count?.toLocaleString() }}</td>
                        </template>
                    </tr>
                </tbody>
            </table>
            <div v-if="history.length">
                <strong>Average start time:</strong> {{ averageOnlineStartTime }}
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { VideoQualityArray } from "../../../../common/Defs";
import { HistoryEntry, HistoryEntryOnline } from "../../../../common/History";

import { library } from "@fortawesome/fontawesome-svg-core";
import { faSave, faList } from "@fortawesome/free-solid-svg-icons";
import { ApiChannelConfig } from "@common/Api/Client";
import axios, { AxiosError } from "axios";
import { useStore } from "@/store";
import { useI18n } from "vue-i18n";
import { formatDate } from "@/mixins/newhelpers";
library.add(faSave, faList);

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
        const { t } = useI18n();
        return { VideoQualityArray, store, t, formatDate };
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
            history: [] as HistoryEntry[],
        };
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
        },
        averageOnlineStartTime(): string {
            const startTimes = this.history
                .filter<HistoryEntryOnline>((h): h is HistoryEntryOnline => "action" in h && h.action == "online")
                .map((h) => new Date(h.time).getHours() * 60 + new Date(h.time).getMinutes() + new Date(h.time).getSeconds() / 60);
            const average = startTimes.reduce((a, b) => a + b, 0) / startTimes.length;
            const hours = Math.floor(average / 60);
            const minutes = Math.floor(average % 60);
            return `${hours}:${minutes}`;
        },
    },
    methods: {
        submitForm(event: Event) {

            this.formStatusText = this.t('messages.loading');
            this.formStatus = "";

            axios
                .put(`/api/v0/channels/${this.channel.uuid}`, this.formData)
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
                    if (axios.isAxiosError(err) && err.response) {
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

            axios
                .delete(`/api/v0/channels/${this.channel.uuid}`,
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

            axios
                .post(`/api/v0/channels/${this.channel.uuid}/subscribe`)
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
        checkSubscriptions() {
            axios
                .get(`/api/v0/channels/${this.channel.uuid}/checksubscriptions`)
                .then((response) => {
                    const json = response.data;
                    if (json.message) alert(json.message);
                    console.log(json);
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
            axios
                .post(`/api/v0/channels/${this.channel.uuid}/rename`, {
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
            if (!confirm(`Do you want to delete all VODs for "${this.channel.uuid}"? This cannot be undone.`)) return;
            axios
                .post(`/api/v0/channels/${this.channel.uuid}/deleteallvods`)
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
        fetchHistory() {
            axios
                .get(`/api/v0/channels/${this.channel.uuid}/history`)
                .then((response) => {
                    const json = response.data;
                    if (json.message) alert(json.message);
                    this.history = json.data;
                })
                .catch((err) => {
                    console.error("history fetch error", err.response);
                    if (err.response.data && err.response.data.message) {
                        alert(err.response.data.message);
                    }
                });
        },
    },
});
</script>
