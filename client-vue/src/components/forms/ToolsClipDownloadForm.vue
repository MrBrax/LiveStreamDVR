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
        .post(`/api/v0/tools/clip_download`, formData)
        .then((response) => {
            const json = response.data;
            console.log("form success", json);
            formStatusText.value = json.message;
            formStatus.value = json.status;
            if (json.data && json.data.web_path) {
                fileLink.value = json.data.web_path;
            }
            emit("formSuccess");
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

    event.preventDefault();
    return false;
}

</script>
