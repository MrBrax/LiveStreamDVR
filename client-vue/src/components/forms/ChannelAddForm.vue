<template>
    <form method="POST" enctype="multipart/form-data" action="#" ref="form" @submit="submitForm">
        <div class="field">
            <label class="label">Login <span class="required">*</span></label>
            <div class="control">
                <input
                    class="input input-required"
                    type="text"
                    name="login"
                    v-model="formData.login"
                    @keyup="checkLogin"
                    required
                    pattern="^[a-z0-9_]{4,25}$"
                />
                <p class="input-help">
                    Channel login, lowercase. This is the part that comes after the domain name, not the display name.<br />
                    You can paste a link to a channel page here to get the login.
                </p>
            </div>
        </div>
        <div class="field">
            <label class="label">Quality <span class="required">*</span></label>
            <div class="control">
                <input
                    class="input input-required"
                    type="text"
                    name="quality"
                    v-model="formData.quality"
                    required
                    ref="quality"
                    @blur="validateQuality"
                />
                <p class="input-help">Separate by spaces, e.g. best 1080p 720p audio_only.</p>
                <p class="input-help"><strong>If the stream does not use any of these, it will not be recorded.</strong></p>
                <p class="input-help">Valid choices: {{ VideoQualityArray.join(", ") }}</p>
            </div>
        </div>
        <div class="field">
            <label class="label">Match keywords</label>
            <div class="control">
                <input class="input" type="text" name="match" v-model="formData.match" />
                <p class="input-help">Separate by commas, e.g. christmas,media share,opening,po box</p>
            </div>
        </div>
        <div class="field">
            <label class="checkbox">
                <input type="checkbox" name="download_chat" v-model="formData.download_chat" />
                Download chat after video capture is complete
            </label>
        </div>
        <div class="field">
            <label class="checkbox">
                <input type="checkbox" name="live_chat" v-model="formData.live_chat" />
                Live chat download
            </label>
        </div>
        <div class="field">
            <label class="checkbox">
                <input type="checkbox" name="burn_chat" v-model="formData.burn_chat" />
                Burn chat after downloading
            </label>
        </div>
        <div class="field">
            <label class="checkbox">
                <input type="checkbox" name="no_capture" v-model="formData.no_capture" />
                Don't record streams (disable capture completely)
            </label>
        </div>
        <p><em>Live channels will not be recorded until they are live the next time.</em></p>
        <div class="field">
            <div class="control">
                <button class="button is-confirm" type="submit">
                    <span class="icon"><fa icon="user-plus"></fa></span> Add
                </button>
                <span :class="formStatusClass">{{ formStatusText }}</span>
            </div>
        </div>
    </form>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { VideoQualityArray } from "../../../../common/Defs";

import { library } from "@fortawesome/fontawesome-svg-core";
import { faUserPlus } from "@fortawesome/free-solid-svg-icons";
import axios from "axios";
library.add(faUserPlus);

export default defineComponent({
    name: "ChannelAddForm",
    emits: ["formSuccess"],
    setup() {
        return { VideoQualityArray };
    },
    data() {
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
            },
        };
    },
    methods: {
        submitForm(event: Event) {

            console.log("submitForm", this.formData);

            this.formStatusText = "Loading...";
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
            };
        },
        checkLogin() {
            const match = this.formData.login.match(/^https?:\/\/www.twitch.tv\/(\w+)/);
            if (match) {
                this.formData.login = match[1];
            }
        },
        validateQuality() {
            const input = this.formData.quality.split(" ");
            const valid = input.every((quality) => VideoQualityArray.includes(quality));
            const field = this.$refs.quality as HTMLInputElement;
            if (!valid) {
                field.setCustomValidity("Invalid quality");
                field.reportValidity();
            } else {
                field.setCustomValidity("");
            }
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
    },
});
</script>
