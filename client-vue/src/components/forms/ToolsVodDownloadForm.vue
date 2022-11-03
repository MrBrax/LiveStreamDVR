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
                    <span class="icon"><font-awesome-icon icon="download" /></span>
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

<script lang="ts" setup>
import { computed, reactive, ref } from "vue";
import { VideoQualityArray } from "../../../../common/Defs";
import { library } from "@fortawesome/fontawesome-svg-core";
import { faDownload } from "@fortawesome/free-solid-svg-icons";
import { useI18n } from "vue-i18n";
import axios from "axios";
import { ApiResponse } from "@common/Api/Api";
library.add(faDownload);

const emit = defineEmits(["formSuccess"]);
const { t } = useI18n();

const formStatusText = ref("Ready");
const formStatus = ref("");
const formData = reactive({
    url: "",
    quality: "best",
});
const fileLink = ref("");

const formStatusClass = computed((): Record<string, boolean> => {
    return {
        "form-status": true,
        "is-error": formStatus.value == "ERROR",
        "is-success": formStatus.value == "OK",
    };
});


function submitForm(event: Event) {
    formStatusText.value = t("messages.loading");
    formStatus.value = "";

    axios
        .post<ApiResponse>(`/api/v0/tools/vod_download`, formData)
        .then((response) => {
            const json = response.data;
            formStatusText.value = json.message || "No message";
            formStatus.value = json.status;
            if (json.status == "OK") {
                emit("formSuccess", json);
            }
            if (json.data && json.data.web_path) {
                fileLink.value = json.data.web_path;
            }
        })
        .catch((err) => {
            console.error("form error", err.response);
            if (axios.isAxiosError(err) && err.response) {
                if (err.response.data.status == "ERROR") {
                    formStatusText.value = err.response.data.message;
                    formStatus.value = err.response.data.status;
                } else {
                    formStatusText.value = err.response.data;
                    formStatus.value = "ERROR";
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
        formStatusText.value = json.message;
        formStatus.value = json.status;
        if(json.status == 'OK'){
            this.$emit('formSuccess', json);
        }
        if(json.data && json.data.web_path){
            this.fileLink = json.data.web_path;
        }
    }).catch((err) => {
        console.error("Error burn form", err);
        formStatusText.value = err;
        formStatus.value = 'ERROR';
    });
    */

    event.preventDefault();
    return false;
    
}
</script>
