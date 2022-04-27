<template>
    <div>
        <form method="POST" enctype="multipart/form-data" action="#" @submit.prevent="submitForm">
            <div class="field">
                <label class="label" for="input_quality">Quality</label>
                <div class="control">
                    <input
                        class="input input-required"
                        type="text"
                        id="input_quality"
                        v-model="formData.quality"
                        required
                    />
                    <p class="input-help">Separate by spaces, e.g. best 1080p 720p audio_only</p>
                    <p class="input-help">Valid choices: {{ VideoQualityArray.join(", ") }}</p>
                </div>
            </div>

            <div class="field">
                <label class="label" for="input_match">Match keywords</label>
                <div class="control">
                    <input class="input" type="text" id="input_match" v-model="formData.match" />
                    <p class="input-help">Separate by commas, e.g. christmas,media share,opening,po box</p>
                </div>
            </div>

            <div class="field">
                <label class="checkbox">
                    <input class="input" type="checkbox" v-model="formData.download_chat" />
                    Download chat after video capture is complete
                </label>
            </div>

            <div class="field">
                <label class="checkbox">
                    <input class="input" type="checkbox" v-model="formData.live_chat" />
                    Live chat download
                </label>
            </div>

            <div class="field">
                <label class="checkbox">
                    <input class="input" type="checkbox" v-model="formData.burn_chat" />
                    Burn chat after downloading
                </label>
            </div>

            <div class="field">
                <label class="checkbox">
                    <input class="input" type="checkbox" v-model="formData.no_capture" />
                    No capture
                </label>
            </div>

            <div class="field">
                <div class="control">
                    <button class="button is-confirm" type="submit">
                        <span class="icon"><fa icon="save"></fa></span> Save
                    </button>
                    <span :class="formStatusClass">{{ formStatusText }}</span>
                </div>
            </div>
        </form>
        <hr />
        <span>
            <button class="button is-small is-danger" type="submit" @click="deleteChannel">
                <span class="icon"><fa icon="trash"></fa></span> Delete
            </button>
            (no undo)
        </span>
        <span>
            <button class="button is-small is-confirm" type="submit" @click="subscribeChannel">Subscribe</button>
        </span>
    </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { VideoQualityArray } from "../../../../common/Defs";

import { library } from "@fortawesome/fontawesome-svg-core";
import { faSave } from "@fortawesome/free-solid-svg-icons";
import { ApiChannelConfig } from "@common/Api/Client";
import { AxiosError } from "axios";
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
        return { VideoQualityArray };
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
            },
        };
    },
    methods: {
        submitForm(event: Event) {

            this.formStatusText = "Loading...";
            this.formStatus = "";

            this.$http
                .put(`/api/v0/channels/${this.channel.login}`, this.formData)
                .then((response) => {
                    const json = response.data;
                    this.formStatusText = json.message;
                    this.formStatus = json.status;
                    if (json.status == "OK") {
                        this.$emit("formSuccess", json);
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
            if (!confirm(`Do you want to delete "${this.channel.login}"?`)) return;
            this.$http
                .delete(`/api/v0/channels/${this.channel.login}`)
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
        subscribeChannel() {
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
