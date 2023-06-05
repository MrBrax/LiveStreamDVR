<template>
    <form
        ref="form"
        method="POST"
        enctype="multipart/form-data"
        action="#"
        @submit="submitForm"
    >
        <div class="field">
            <label class="label">{{ t('forms.channel.provider') }}</label>
            <div class="select">
                <select
                    v-model="formData.provider"
                    class="select"
                    name="provider"
                >
                    <option value="twitch">
                        Twitch
                    </option>
                    <option value="youtube">
                        YouTube
                    </option>
                </select>
            </div>
            <p class="input-help">
                YouTube will not work properly until they add webhooks for livestreams. It works with manual recordings and videos.
            </p>
        </div>

        <div
            v-if="formData.provider == 'twitch'"
            class="field"
        >
            <label class="label">{{ t('forms.channel.login') }} <span class="required">*</span></label>
            <div class="control has-addon">
                <input
                    ref="login"
                    v-model="formData.login"
                    class="input"
                    type="text"
                    name="login"
                    required
                    pattern="^[a-z0-9_]{3,25}$"
                    @keyup="checkLogin"
                >
                <d-button
                    type="button"
                    color="success"
                    icon="sync"
                    :disabled="!formData.login"
                    @click="fetchLogin"
                >
                    {{ t('forms.channel.check') }}
                </d-button>
            </div>
            <p class="input-help">
                {{ t('forms.channel.login_help') }}
            </p>
        </div>

        <div
            v-if="formData.provider == 'youtube'"
            class="field"
        >
            <label class="label">{{ t('forms.channel.url') }}</label>
            <div class="control has-addon">
                <input
                    v-model="channelUrl"
                    class="input"
                    type="text"
                    :disabled="fetchingUrl"
                >
                <d-button
                    type="button"
                    color="success"
                    icon="sync"
                    :loading="fetchingUrl"
                    @click="getChannelId"
                >
                    {{ t('buttons.fetch') }}
                </d-button>
            </div>
        </div>

        <div
            v-if="formData.provider == 'youtube'"
            class="field"
        >
            <label class="label">{{ t('forms.channel.id') }} <span class="required">*</span></label>
            <div class="control has-addon">
                <input
                    ref="channel_id"
                    v-model="formData.channel_id"
                    class="input"
                    type="text"
                    name="channel_id"
                    required
                    :disabled="fetchingUrl"
                >
                <!--
                <button class="button is-confirm" type="button" @click="fetchLogin" :disabled="!formData.login">
                    <span class="icon"><font-awesome-icon icon="sync" /></span>
                    <span>{{ t('forms.channel.check') }}</span>
                </button>
                -->
            </div>
            <p class="input-help">
                {{ t('forms.channel.id_help') }}
            </p>
        </div>

        <div
            v-if="channelData && channelData.login"
            class="field"
        >
            <ul>
                <li>Login: <strong>{{ channelData.login }}</strong></li>
                <li>Display name: <strong>{{ channelData.display_name }}</strong></li>
                <li>Description: <strong>{{ channelData.description }}</strong></li>
                <li>
                    Avatar: <img
                        :src="channelData.profile_image_url"
                        rel="nofollow"
                        width="64"
                        height="64"
                    >
                </li>
            </ul>
        </div>

        <div
            v-if="userExists === false"
            class="field"
        >
            <div class="text-is-error">
                {{ t('forms.channel.login-does-not-exist', [formData.login]) }}
            </div>
        </div>

        <div class="field">
            <label class="label">{{ t('forms.channel.quality') }} <span class="required">*</span></label>
            <div class="control">
                <input
                    ref="quality"
                    v-model="formData.quality"
                    class="input"
                    type="text"
                    name="quality"
                    required
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
            <label class="label">{{ t('forms.channel.match-keywords') }}</label>
            <div class="control">
                <input
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
                {{ t('forms.channel.uses-default-settings-defined-in-the-settings') }}
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

        <p><em>{{ t('forms.channel.live-channels-warning') }}</em></p>

        <div class="notice is-warning">
            <p>{{ t('forms.channel.subscriptions-warning') }}</p>
        </div>

        <FormSubmit
            :form-status="formStatus"
            :form-status-text="formStatusText"
        >
            <div class="control">
                <d-button
                    type="submit"
                    color="success"
                    icon="user-plus"
                >
                    {{ t('forms.channel.add-channel') }}
                </d-button>
            </div>
        </FormSubmit>
    </form>
</template>

<script lang="ts" setup>
import FormSubmit from "@/components/reusables/FormSubmit.vue";
import { computed, ref } from "vue";
import { VideoQualityArray } from "../../../../common/Defs";
import { library } from "@fortawesome/fontawesome-svg-core";
import { faUserPlus } from "@fortawesome/free-solid-svg-icons";
import axios, { AxiosError } from "axios";
import type { UserData } from "@common/User";
import type { ApiResponse, ApiErrorResponse, IApiResponse } from "@common/Api/Api";
import { useI18n } from "vue-i18n";
import type { FormStatus } from "@/twitchautomator";
library.add(faUserPlus);

// emit
const emit = defineEmits(["formSuccess"]);

// setup
const { t } = useI18n();
        
// data
const formStatusText = ref<string>("Ready");
const formStatus = ref<FormStatus>("IDLE");
const formData = ref({
    provider: "twitch",
    login: "",
    channel_id: "",
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
const channelData = ref<UserData>();
const userExists = ref<boolean>();
const channelUrl = ref<string>("");
const fetchingUrl = ref<boolean>(false);
const login = ref<HTMLInputElement | null>();

// computed
const qualityWarning = computed((): boolean => {
    return formData.value.quality.includes("best") || formData.value.quality.includes("worst");
});

// methods
function submitForm(event: Event) {

    console.log("submitForm", formData.value);

    formStatusText.value = t("messages.loading");
    formStatus.value = "LOADING";

    axios
        .post<ApiResponse>(`/api/v0/channels`, formData.value)
        .then((response) => {
            const json = response.data;
            formStatusText.value = json.message || "No message";
            formStatus.value = json.status;
            if (json.status == "OK") {
                emit("formSuccess", json);
                resetForm();
            }
        })
        .catch((err: Error | AxiosError) => {
            console.error("form error", err);
            if (axios.isAxiosError<ApiErrorResponse>(err) && err.response) {
                formStatusText.value = err.response.data.message;
                formStatus.value = err.response.data.status;
            }
        });

    event.preventDefault();
    return false;
}

function resetForm() {
    formData.value = {
        provider: "twitch",
        login: "",
        channel_id: "",
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
    };
}

function checkLogin() {
    const match = formData.value.login.match(/^https?:\/\/www.twitch.tv\/(\w+)/);
    if (match) {
        formData.value.login = match[1];
    }
    userExists.value = undefined;
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
function fetchLogin() {
    axios.get<IApiResponse<UserData>>(`/api/v0/twitchapi/user/${formData.value.login}`).then((response) => {
        const json = response.data;
        const field = login.value;
        if (!field) {
            return;
        }
        if (json.status == "OK") {
            channelData.value = json.data;
            if (channelData.value && channelData.value.login !== formData.value.login) {
                alert(t('messages.login-mismatch-fixing'));
                formData.value.login = channelData.value.login;
            }
            field.setCustomValidity("");
            field.reportValidity();
            userExists.value = true;
        } else {
            channelData.value = undefined;
            field.setCustomValidity(json.message || "");
            field.reportValidity();
            userExists.value = false;
        }
    }).catch((err: Error | AxiosError) => {
        console.error("form error", err);
        const field = login.value;
        if (field && axios.isAxiosError<ApiErrorResponse>(err) && err.response && err.response.data && err.response.data.message) {
            field.setCustomValidity(err.response.data.message);
            field.reportValidity();
            userExists.value = false;
        } else {
            console.error("no field or no response", field, err);
        }
    });
}

function getChannelId() {
    fetchingUrl.value = true;
    axios.post<ApiResponse>(`/api/v0/youtubeapi/channelid`, { url: channelUrl.value } ).then((response) => {
        const json = response.data;
        if (json.status == "OK") {
            formData.value.channel_id = json.data;
        }
        console.log("channel id", json);
    }).catch((err: AxiosError) => {
        console.error("channel id error", err.response);
    }).finally(() => {
        fetchingUrl.value = false;
    });
}


</script>
