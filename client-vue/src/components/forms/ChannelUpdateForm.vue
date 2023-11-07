<template>
    <div :id="`channelupdate_${channel.uuid}`">
        <form @submit.prevent="submitForm">
            <div class="field">
                <label class="label">{{ t("forms.channel.provider") }}</label>
                <div class="control">
                    <input class="input input-required" type="text" :value="channel.provider" disabled readonly />
                </div>
            </div>

            <div class="field">
                <label class="label">{{ t("forms.channel.uuid") }}</label>
                <div class="control">
                    <input class="input input-required" type="text" :value="channel.uuid" disabled readonly />
                </div>
            </div>

            <div v-if="'login' in channel" class="field">
                <label class="label">{{ t("forms.channel.login") }}</label>
                <div class="control">
                    <input class="input" type="text" :value="channel.login" disabled readonly />
                </div>
            </div>

            <div class="field">
                <label class="label">{{ t("forms.channel.internal-id") }}</label>
                <div class="control">
                    <input class="input" type="text" :value="localChannelData?.internalId" disabled readonly />
                </div>
            </div>

            <div v-if="'channel_id' in channel" class="field">
                <label class="label">{{ t("forms.channel.id") }}</label>
                <div class="control">
                    <input class="input" type="text" :value="channel.channel_id" disabled readonly />
                </div>
            </div>

            <div class="field">
                <label class="label" :for="`input_${channel.uuid}_quality`">{{ t("forms.channel.quality") }} <span class="required">*</span></label>
                <div class="control">
                    <input
                        :id="`input_${channel.uuid}_quality`"
                        ref="quality"
                        v-model="formData.quality"
                        class="input input-required"
                        type="text"
                        required
                        name="quality"
                    />
                    <p class="input-help">
                        {{ t("forms.channel.quality-help-example") }}
                    </p>
                    <p class="input-help">
                        <strong>{{ t("forms.channel.quality-help-warning") }}</strong>
                    </p>
                    <!--<p class="input-help">{{ t('forms.channel.quality-help-choices', [VideoQualityArray.join(", ")]) }}</p>-->
                    <p v-if="!qualityWarning" class="input-help error">
                        {{ t("forms.channel.quality-help-check") }}
                    </p>
                </div>
            </div>

            <div class="field">
                <label class="label" :for="`input_${channel.uuid}_match`">{{ t("forms.channel.match-keywords") }}</label>
                <div class="control">
                    <input :id="`input_${channel.uuid}_match`" v-model="formData.match" class="input" type="text" name="match" />
                    <p class="input-help">Separate by commas, e.g. christmas,media share,opening,po box</p>
                </div>
            </div>

            <div class="field">
                <label class="label">{{ t("forms.channel.max-storage") }}</label>
                <div class="control">
                    <input v-model="formData.max_storage" class="input" type="number" name="max_storage" />
                    <p class="input-help">
                        {{ t("forms.channel.max-storage-help") }}
                    </p>
                </div>
            </div>

            <div class="field">
                <label class="label">{{ t("forms.channel.max-vods") }}</label>
                <div class="control">
                    <input v-model="formData.max_vods" class="input" type="number" name="max_vods" />
                    <p class="input-help">
                        {{ t("forms.channel.max-vods-help") }}
                    </p>
                </div>
            </div>

            <div class="field">
                <label class="checkbox">
                    <input v-model="formData.download_chat" type="checkbox" name="download_chat" />
                    {{ t("forms.channel.download-chat") }}
                </label>
            </div>

            <div class="field">
                <label class="checkbox">
                    <input v-model="formData.live_chat" type="checkbox" name="live_chat" />
                    {{ t("forms.channel.live-chat-download") }}
                </label>
                <p class="input-help">Requires Node binary path to be set in the settings</p>
            </div>

            <div class="field">
                <label class="checkbox">
                    <input v-model="formData.burn_chat" type="checkbox" name="burn_chat" />
                    {{ t("forms.channel.burn-chat") }}
                </label>
                <p class="input-help">
                    {{ t("forms.channel.uses-default-settings-defined-in-the-settings") }}
                </p>
            </div>

            <div class="field">
                <label class="checkbox">
                    <input v-model="formData.no_capture" type="checkbox" name="no_capture" />
                    {{ t("forms.channel.no-capture") }}
                </label>
            </div>

            <div class="field">
                <label class="checkbox">
                    <input v-model="formData.no_cleanup" type="checkbox" name="no_cleanup" />
                    {{ t("forms.channel.no-cleanup") }}
                </label>
            </div>

            <div class="field">
                <label class="checkbox">
                    <input v-model="formData.download_vod_at_end" type="checkbox" name="download_vod_at_end" />
                    {{ t("forms.channel.download_vod_at_end") }}
                </label>
            </div>

            <div v-if="formData.download_vod_at_end" class="field">
                <label class="label">{{ t("forms.channel.download_vod_at_end_quality") }}</label>
                <div class="select">
                    <select v-model="formData.download_vod_at_end_quality" name="download_vod_at_end_quality">
                        <option v-for="quality in VideoQualityArray" :key="quality" :value="quality">
                            {{ quality }}
                        </option>
                    </select>
                </div>
                <p class="input-help">
                    {{ t("forms.channel.download_vod_at_end_quality_help") }}
                </p>
            </div>

            <FormSubmit :form-status="formStatus" :form-status-text="formStatusText">
                <d-button color="success" type="submit" icon="save">
                    {{ t("buttons.save") }}
                </d-button>
                <d-button color="danger" type="button" icon="sync" @click="resetForm">
                    {{ t("buttons.reset") }}
                </d-button>
            </FormSubmit>
        </form>
        <hr />
        <div class="buttons">
            <d-button size="small" color="danger" icon="trash" @click="deleteChannel">
                {{ t("buttons.delete") }}
            </d-button>
            <d-button size="small" color="danger" icon="video-slash" @click="deleteAllVods">
                {{ t("buttons.delete-all-vods") }}
            </d-button>
            <d-button size="small" icon="sync" @click="subscribeChannel">
                {{ t("buttons.subscribe") }}
            </d-button>
            <d-button size="small" icon="trash" @click="unsubscribeChannel">
                {{ t("buttons.unsubscribe") }}
            </d-button>
            <d-button size="small" icon="list" @click="checkSubscriptions">
                {{ t("buttons.check-subscriptions") }}
            </d-button>
            <d-button size="small" icon="pencil" @click="renameChannel">
                {{ t("buttons.rename") }}
            </d-button>
        </div>
        <hr />
        <div>
            <h2>History</h2>
            <div class="field">
                <d-button size="small" color="success" icon="sync" @click="fetchHistory">
                    {{ t("buttons.fetch") }}
                </d-button>
            </div>
            <table v-if="history.length" class="table is-striped">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Action</th>
                        <th>Title</th>
                        <th>View count</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(item, i) in history" :key="i">
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
            <LoadingBox v-if="loadingHistory" />
            <div v-if="history.length"><strong>Average start time:</strong> {{ averageOnlineStartTime }}</div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import FormSubmit from "@/components/reusables/FormSubmit.vue";
import { formatDate } from "@/mixins/newhelpers";
import { useStore } from "@/store";
import type { FormStatus } from "@/twitchautomator";
import type { ApiResponse } from "@common/Api/Api";
import type { ApiChannelConfig } from "@common/Api/Client";
import { VideoQualityArray } from "@common/Defs";
import type { HistoryEntry, HistoryEntryOnline } from "@common/History";
import { library } from "@fortawesome/fontawesome-svg-core";
import { faList, faPencil, faSave, faTrash, faVideoSlash } from "@fortawesome/free-solid-svg-icons";
import axios, { AxiosError } from "axios";
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
library.add(faSave, faList, faTrash, faVideoSlash, faPencil);

// props
const props = defineProps<{
    channel: ApiChannelConfig;
}>();

// emit
const emit = defineEmits(["formSuccess"]);

// setup
const store = useStore();
const { t } = useI18n();

// data
const formStatusText = ref<string>("Ready");
const formStatus = ref<FormStatus>("IDLE");
const formData = ref({
    // ref or reactive?
    quality: "",
    match: "",
    download_chat: false,
    live_chat: false,
    burn_chat: false,
    no_capture: false,
    no_cleanup: false,
    max_storage: 0,
    max_vods: 0,
    download_vod_at_end: false,
    download_vod_at_end_quality: "best",
});
const history = ref<HistoryEntry[]>([]);
const loadingHistory = ref<boolean>(false);

const qualityWarning = computed((): boolean => {
    return formData.value.quality.includes("best") || formData.value.quality.includes("worst");
});

const averageOnlineStartTime = computed((): string => {
    const startTimes = history.value
        .filter<HistoryEntryOnline>((h): h is HistoryEntryOnline => "action" in h && h.action == "online")
        .map((h) => new Date(h.time).getHours() * 60 + new Date(h.time).getMinutes() + new Date(h.time).getSeconds() / 60);
    const average = startTimes.reduce((a, b) => a + b, 0) / startTimes.length;
    const hours = Math.floor(average / 60);
    const minutes = Math.floor(average % 60);
    return `${hours}:${minutes}`;
});

const localChannelData = computed(() => {
    return store.streamerList.find((c) => c.uuid == props.channel.uuid);
});

// watch
watch(() => props.channel, resetForm, { immediate: true });

// mounted
onMounted(() => {
    resetForm();
});

// methods
function resetForm() {
    // console.debug("Resetting form", JSON.stringify(this.channel));
    formStatus.value = "IDLE";
    formStatusText.value = "Ready";

    formData.value = {
        quality: props.channel.quality ? props.channel.quality.join(" ") : "",
        match: props.channel.match ? props.channel.match.join(",") : "",
        download_chat: props.channel.download_chat || false,
        live_chat: props.channel.live_chat || false,
        burn_chat: props.channel.burn_chat || false,
        no_capture: props.channel.no_capture || false,
        no_cleanup: props.channel.no_cleanup || false,
        max_storage: props.channel.max_storage || 0,
        max_vods: props.channel.max_vods || 0,
        download_vod_at_end: props.channel.download_vod_at_end || false,
        download_vod_at_end_quality: props.channel.download_vod_at_end_quality || "best",
    };

    // console.debug("Form data", JSON.stringify(formData.value));
}

function submitForm(event: Event) {
    formStatusText.value = t("messages.loading");
    formStatus.value = "LOADING";

    axios
        .put(`/api/v0/channels/${props.channel.uuid}`, formData.value)
        .then((response) => {
            const json = response.data;
            formStatusText.value = json.message;
            formStatus.value = json.status;
            if (json.status == "OK") {
                emit("formSuccess", json);
                store.fetchAndUpdateStreamerList();
            }
        })
        .catch((err: Error | AxiosError) => {
            if (axios.isAxiosError(err) && err.response) {
                console.error("channel update form error", err.response);
                formStatusText.value = err.response.data.message;
                formStatus.value = err.response.data.status;
            } else {
                console.error("channel update form error", err);
                alert(`Error: ${err.message}`);
            }
        });

    event.preventDefault();
    return false;
}

function deleteChannel() {
    if (!confirm(`Do you want to delete "${props.channel.login}"? This cannot be undone.`)) return;

    const deleteVodsToo = confirm(
        `Do you also want to delete all VODs for "${props.channel.login}"? OK to delete all VODs and channel, Cancel to delete only the channel.`,
    );

    axios
        .delete(`/api/v0/channels/${props.channel.uuid}`, {
            params: {
                deletevods: deleteVodsToo ? "1" : "0",
            },
        })
        .then((response) => {
            const json = response.data;
            if (json.message) alert(json.message);
            console.log(json);
            emit("formSuccess", json);
            store.fetchAndUpdateStreamerList();
        })
        .catch((err) => {
            console.error("form error", err.response);
            if (err.response.data && err.response.data.message) {
                alert(err.response.data.message);
            }
        });
}

function subscribeChannel() {
    if ((!store.cfg("app_url") || store.cfg("app_url") == "debug") && store.cfg("twitchapi.twitchapi.eventsub_type") === "webhook") {
        alert("Please set the app url in the settings");
        return;
    }

    axios
        .post<ApiResponse>(`/api/v0/channels/${props.channel.uuid}/subscribe`)
        .then((response) => {
            const json = response.data;
            if (json.message) alert(json.message);
            console.log(json);
            emit("formSuccess", json);
        })
        .catch((err) => {
            console.error("form error", err.response);
            if (err.response.data && err.response.data.message) {
                alert(err.response.data.message);
            }
        });
}

function unsubscribeChannel() {
    axios
        .post<ApiResponse>(`/api/v0/channels/${props.channel.uuid}/unsubscribe`)
        .then((response) => {
            const json = response.data;
            if (json.message) alert(json.message);
            console.log(json);
            emit("formSuccess", json);
        })
        .catch((err) => {
            console.error("form error", err.response);
            if (err.response.data && err.response.data.message) {
                alert(err.response.data.message);
            }
        });
}

function checkSubscriptions() {
    axios
        .get<ApiResponse>(`/api/v0/channels/${props.channel.uuid}/checksubscriptions`)
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
}

/*
validateQuality() {
    const input = formData.value.quality.split(" ");
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
function renameChannel() {
    const newLogin = prompt("Enter new channel login. If channel has not changed login, this will fail in the future.\n", props.channel.login);
    if (!newLogin || newLogin == props.channel.login) return;
    axios
        .post<ApiResponse>(`/api/v0/channels/${props.channel.uuid}/rename`, {
            new_login: newLogin,
        })
        .then((response) => {
            const json = response.data;
            if (json.message) alert(json.message);
            console.log(json);
            emit("formSuccess", json);
            store.fetchAndUpdateStreamerList();
        })
        .catch((err) => {
            console.error("form error", err.response);
            if (err.response.data && err.response.data.message) {
                alert(err.response.data.message);
            }
        });
}

function deleteAllVods() {
    if (!confirm(`Do you want to delete all VODs for "${store.channelUUIDToInternalName(props.channel.uuid)}"? This cannot be undone.`)) return;
    axios
        .post<ApiResponse>(`/api/v0/channels/${props.channel.uuid}/deleteallvods`)
        .then((response) => {
            const json = response.data;
            if (json.message) alert(json.message);
            console.log(json);
            emit("formSuccess", json);
            store.fetchAndUpdateStreamerList();
        })
        .catch((err) => {
            console.error("form error", err.response);
            if (err.response.data && err.response.data.message) {
                alert(err.response.data.message);
            }
        });
}

function fetchHistory() {
    loadingHistory.value = true;
    axios
        .get<ApiResponse>(`/api/v0/channels/${props.channel.uuid}/history`)
        .then((response) => {
            const json = response.data;
            if (json.message) alert(json.message);
            history.value = json.data;
        })
        .catch((err) => {
            console.error("history fetch error", err.response);
            if (err.response.data && err.response.data.message) {
                alert(err.response.data.message);
            }
        })
        .finally(() => {
            loadingHistory.value = false;
        });
}
</script>
