<template>
    <form
        method="POST"
        @submit.prevent="submitForm"
    >
        <div class="field">
            <label
                class="label"
                for="voddownload_url"
            >VOD URL</label>
            <div class="control">
                <input
                    id="voddownload_url"
                    v-model="formData.url"
                    class="input"
                    type="text"
                    required
                >
            </div>
        </div>

        <div class="field">
            <label
                class="label"
                for="voddownload_quality"
            >Quality</label>
            <div class="control">
                <div class="select">
                    <select
                        id="voddownload_quality"
                        v-model="formData.quality"
                        required
                    >
                        <option
                            v-for="quality of VideoQualityArray"
                            :key="quality"
                        >
                            {{ quality }}
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
                    <span>{{ t('buttons.execute') }}</span>
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
import { VideoQualityArray } from "../../../../common/Defs";

import { library } from "@fortawesome/fontawesome-svg-core";
import { faDownload } from "@fortawesome/free-solid-svg-icons";
import { useI18n } from "vue-i18n";
library.add(faDownload);

export default defineComponent({
    name: "ToolsVodDownloadForm",
    emits: ["formSuccess"],
    setup() {
        const { t } = useI18n();
        return { VideoQualityArray, t };
    },
    data() {
        return {
            formStatusText: "Ready",
            formStatus: "",
            formData: {
                url: "",
                quality: "best",
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
            this.formStatusText = this.t("messages.loading");
            this.formStatus = "";

            this.$http
                .post(`/api/v0/tools/vod_download`, this.formData)
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
            fetch(`api/v0/tools/voddownload`, {
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
