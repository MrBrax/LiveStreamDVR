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

        <FormSubmit
            :form-status="formStatus"
            :form-status-text="formStatusText"
        >
            <div class="control">
                <button
                    class="button is-confirm"
                    type="submit"
                >
                    <span class="icon"><font-awesome-icon icon="download" /></span>
                    <span>{{ t('buttons.execute') }}</span>
                </button>
            </div>
        </FormSubmit>

        <div
            v-if="fileLink"
            class="field"
        >
            <a :href="fileLink">{{ fileLink }}</a>
        </div>
    </form>
</template>

<script lang="ts" setup>
import FormSubmit from "@/components/reusables/FormSubmit.vue";
import axios from "axios";
import { ApiResponse } from "@common/Api/Api";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useStore } from "@/store";
import { FormStatus } from "@/twitchautomator";

// emit
const emit = defineEmits(["formSuccess"]);

// setup
const store = useStore();
const { t, te } = useI18n();

// data
const formStatusText = ref<string>("Ready");
const formStatus = ref<FormStatus>("IDLE");
const formData = ref<{ url: string, method: string }>({ url: "", method: "td" });
const fileLink = ref<string>("");

function submitForm(event: Event) {
    formStatusText.value = t("messages.loading");
    formStatus.value = "LOADING";

    axios
        .post<ApiResponse>(`/api/v0/tools/chat_download`, formData.value)
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
    fetch(`api/v0/tools/chatdownload`, {
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
            fileLink.value = json.data.web_path;
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
