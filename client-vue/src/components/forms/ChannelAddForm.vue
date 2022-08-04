<template>
    <form method="POST" enctype="multipart/form-data" action="#" ref="form" @submit="submitForm">
        <div class="field">
            <label class="label">{{ $t('forms.channel.login') }} <span class="required">*</span></label>
            <div class="control has-addon">
                <input
                    class="input"
                    type="text"
                    name="login"
                    v-model="formData.login"
                    @keyup="checkLogin"
                    required
                    pattern="^[a-z0-9_]{3,25}$"
                    ref="login"
                />
                <button class="button is-confirm" type="button" @click="fetchLogin" :disabled="!formData.login">
                    <span class="icon"><fa icon="sync" /></span>
                    <span>{{ $t('forms.channel.check') }}</span>
                </button>
            </div>
            <p class="input-help">
                {{ $t('forms.channel.login_help') }}
            </p>
        </div>
        <div class="field" v-if="channelData && channelData.login">
            <ul>
                <li>Login: <strong>{{ channelData.login }}</strong></li>
                <li>Display name: <strong>{{ channelData.display_name }}</strong></li>
                <li>Description: <strong>{{ channelData.description }}</strong></li>
                <li>Avatar: <img :src="channelData.profile_image_url" rel="nofollow" width="64" height="64" /></li>
            </ul>
        </div>
        <div class="field" v-if="userExists === false">
            <div class="is-error">
                {{ $t('forms.channel.login-does-not-exist', [formData.login]) }}
            </div>
        </div>
        <div class="field">
            <label class="label">{{ $t('forms.channel.quality') }} <span class="required">*</span></label>
            <div class="control">
                <input
                    class="input"
                    type="text"
                    name="quality"
                    v-model="formData.quality"
                    required
                    ref="quality"
                />
                <p class="input-help">{{ $t('forms.channel.quality-help-example') }}</p>
                <p class="input-help"><strong>{{ $t('forms.channel.quality-help-warning') }}</strong></p>
                <!--<p class="input-help">{{ $t('forms.channel.quality-help-choices', [VideoQualityArray.join(", ")]) }}</p>-->
            </div>
        </div>
        <div class="field">
            <label class="label">{{ $t('forms.channel.match-keywords') }}</label>
            <div class="control">
                <input class="input" type="text" name="match" v-model="formData.match" />
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
                <input type="checkbox" name="download_chat" v-model="formData.download_chat" />
                {{ $t('forms.channel.download-chat') }}
            </label>
        </div>
        <div class="field">
            <label class="checkbox">
                <input type="checkbox" name="live_chat" v-model="formData.live_chat" />
                {{ $t('forms.channel.live-chat-download') }}
            </label>
            <p class="input-help">Requires Node binary path to be set in the settings</p>
        </div>
        <div class="field">
            <label class="checkbox">
                <input type="checkbox" name="burn_chat" v-model="formData.burn_chat" />
                {{ $t('forms.channel.burn-chat') }}
            </label>
            <p class="input-help">Currently disabled</p>
        </div>
        <div class="field">
            <label class="checkbox">
                <input type="checkbox" name="no_capture" v-model="formData.no_capture" />
                {{ $t('forms.channel.no-capture') }}
            </label>
        </div>
        <div class="field">
            <label class="checkbox">
                <input type="checkbox" name="no_cleanup" v-model="formData.no_cleanup" />
                {{ $t('forms.channel.no-cleanup') }}
            </label>
        </div>
        <p><em>{{ $t('forms.channel.live-channels-warning') }}</em></p>
        <div class="field form-submit">
            <div class="control">
                <button class="button is-confirm" type="submit">
                    <span class="icon"><fa icon="user-plus"></fa></span>
                    <span>{{ $t('forms.channel.add-channel') }}</span>
                </button>
            </div>
            <div :class="formStatusClass">{{ formStatusText }}</div>
        </div>
    </form>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { VideoQualityArray } from "../../../../common/Defs";

import { library } from "@fortawesome/fontawesome-svg-core";
import { faUserPlus } from "@fortawesome/free-solid-svg-icons";
import axios, { AxiosError } from "axios";
import { UserData } from "@common/User";
library.add(faUserPlus);

export default defineComponent({
    name: "ChannelAddForm",
    emits: ["formSuccess"],
    setup() {
        return { VideoQualityArray };
    },
    data(): {
        formStatusText: string;
        formStatus: string;
        formData: {
            login: string;
            quality: string;
            match: string;
            download_chat: boolean;
            live_chat: boolean;
            burn_chat: boolean;
            no_capture: boolean;
            no_cleanup: boolean;
            max_storage: number;
            max_vods: number;
        },
        channelData: UserData | undefined;
        userExists: boolean | undefined;
    } {
        return {
            formStatusText: "Ready",
            formStatus: "",
            formData: {
                login: "",
                quality: "",
                match: "",
                download_chat: false,
                live_chat: false,
                burn_chat: false,
                no_capture: false,
                no_cleanup: false,
                max_storage: 0,
                max_vods: 0,
            },
            channelData: undefined,
            userExists: undefined,
        };
    },
    methods: {
        submitForm(event: Event) {

            console.log("submitForm", this.formData);

            this.formStatusText = this.$t("messages.loading");
            this.formStatus = "";

            this.$http
                .post(`/api/v0/channels`, this.formData)
                .then((response) => {
                    const json = response.data;
                    this.formStatusText = json.message;
                    this.formStatus = json.status;
                    if (json.status == "OK") {
                        this.$emit("formSuccess", json);
                        this.resetForm();
                    }
                })
                .catch((err) => {
                    console.error("form error", err.response);
                    if (axios.isAxiosError(err) && err.response) {
                        if (err.response.data.status == "ERROR") {
                            this.formStatusText = err.response.data.message;
                            this.formStatus = err.response.data.status;
                        } else {
                            this.formStatusText = err.response.data;
                            this.formStatus = "ERROR";
                        }
                    }
                });

            event.preventDefault();
            return false;
        },
        resetForm() {
            this.formData = {
                login: "",
                quality: "",
                match: "",
                download_chat: false,
                live_chat: false,
                burn_chat: false,
                no_capture: false,
                no_cleanup: false,
                max_storage: 0,
                max_vods: 0,
            };
        },
        checkLogin() {
            const match = this.formData.login.match(/^https?:\/\/www.twitch.tv\/(\w+)/);
            if (match) {
                this.formData.login = match[1];
            }
            this.userExists = undefined;
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
        fetchLogin() {
            this.$http.get(`/api/v0/twitchapi/user/${this.formData.login}`).then((response) => {
                const json = response.data;
                const field = this.$refs.login as HTMLInputElement;
                if (!field) {
                    return;
                }
                if (json.status == "OK") {
                    this.channelData = json.data;
                    if (this.channelData && this.channelData.login !== this.formData.login) {
                        alert(this.$t('messages.login-mismatch-fixing'));
                        this.formData.login = this.channelData.login;
                    }
                    field.setCustomValidity("");
                    field.reportValidity();
                    this.userExists = true;
                } else {
                    this.channelData = undefined;
                    field.setCustomValidity(json.message);
                    field.reportValidity();
                    this.userExists = false;
                }
            }).catch((err: AxiosError) => {
                console.error("form error", err.response);
                const field = this.$refs.login as HTMLInputElement;
                if (field && err.response && err.response.data && err.response.data.message) {
                    field.setCustomValidity(err.response.data.message);
                    field.reportValidity();
                    this.userExists = false;
                } else {
                    console.error("no field or no response", field, err.response);
                }
            });
        }
    },
    computed: {
        formStatusClass(): Record<string, boolean> {
            return {
                "form-status": true,
                "is-error": this.formStatus == "ERROR",
                "is-success": this.formStatus == "OK",
            };
        },
    },
});
</script>
