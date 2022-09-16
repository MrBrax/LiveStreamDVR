<template>
    <form
        method="POST"
        @submit="submitForm"
    >
        <div class="field">
            <label class="label">VOD URL</label>
            <div class="control">
                <input
                    v-model="formData.url"
                    class="input"
                    type="text"
                    required
                >
            </div>
        </div>

        <div class="field">
            <label class="label">Method</label>
            <div class="control">
                <div class="select">
                    <select v-model="formData.method">
                        <option value="td">
                            TwitchDownloaderCLI
                        </option>
                        <option value="tcd">
                            Twitch Chat Downloader
                        </option>
                    </select>
                </div>
            </div>
        </div>

        <div class="field form-submit">
            <div class="control">
                <button
                    class="button is-confirm"
                    type="submit"
                >
                    <span class="icon"><fa icon="download" /></span>
                    <span>{{ $t('buttons.execute') }}</span>
                </button>
            </div>
            <div :class="formStatusClass">
                {{ formStatusText }}
            </div>
        </div>

        <div
            v-if="fileLink"
            class="field"
        >
            <a :href="fileLink">{{ fileLink }}</a>
        </div>
    </form>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
    name: "ToolsVodDownloadForm",
    emits: ["formSuccess"],
    data() {
        return {
            formStatusText: "Ready",
            formStatus: "",
            formData: {
                url: "",
                method: "td",
            },
            fileLink: "",
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
    },
    methods: {
        submitForm(event: Event) {
            this.formStatusText = this.$t("messages.loading");
            this.formStatus = "";

            this.$http
                .post(`/api/v0/tools/chat_download`, this.formData)
                .then((response) => {
                    const json = response.data;
                    this.formStatusText = json.message;
                    this.formStatus = json.status;
                    if (json.status == "OK") {
                        this.$emit("formSuccess", json);
                    }
                    if (json.data && json.data.web_path) {
                        this.fileLink = json.data.web_path;
                    }
                })
                .catch((err) => {
                    console.error("form error", err.response);
                    if (this.axios.isAxiosError(err) && err.response) {
                        if (err.response.data.status == "ERROR") {
                            this.formStatusText = err.response.data.message;
                            this.formStatus = err.response.data.status;
                        } else {
                            this.formStatusText = err.response.data;
                            this.formStatus = "ERROR";
                        }
                    }
                });

            /*
            fetch(`api/v0/tools/chatdownload`, {
                method: 'POST',
                body: inputs
            })
            .then((response) => response.json())
            .then((json) => {
                this.formStatusText = json.message;
                this.formStatus = json.status;
                if(json.status == 'OK'){
                    this.$emit('formSuccess', json);
                }
                if(json.data && json.data.web_path){
                    this.fileLink = json.data.web_path;
                }
            }).catch((err) => {
                console.error("Error burn form", err);
                this.formStatusText = err;
                this.formStatus = 'ERROR';
            });
            */

            event.preventDefault();
            return false;
        },
    },
});
</script>
