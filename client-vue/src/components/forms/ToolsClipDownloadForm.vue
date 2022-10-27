<template>
    <form
        method="POST"
        @submit.prevent="submitForm"
    >
        <div class="field">
            <label class="label">Clip URL</label>
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
            <label class="label">Quality</label>
            <div class="control">
                <div class="select">
                    <select
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
import axios from "axios";
library.add(faDownload);

export default defineComponent({
    name: "ToolsClipDownloadForm",
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

            axios
                .post(`/api/v0/tools/clip_download`, this.formData)
                .then((response) => {
                    const json = response.data;
                    console.log("form success", json);
                    this.formStatusText = json.message;
                    this.formStatus = json.status;
                    if (json.data && json.data.web_path) {
                        this.fileLink = json.data.web_path;
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
    },
});
</script>
