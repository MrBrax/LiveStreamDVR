<template>
    <form
        method="POST"
        @submit.prevent="submitForm"
    >
        <div class="field">
            <label class="label">Login</label>
            <div class="control">
                <input
                    v-model="formData.login"
                    class="input"
                    type="text"
                    required
                >
                <p class="input-help">
                    Does not need to exist in your channels list.
                </p>
            </div>
        </div>

        <p>
            The chat dumper will continue to run in the background until you manually stop it.<br>
            Keeping it running for a very long time can use up a large amount of disk space.
        </p>

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
    </form>
</template>

<script lang="ts" setup>
import FormSubmit from "@/components/reusables/FormSubmit.vue";
import axios from "axios";
import type { ApiResponse } from "@common/Api/Api";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useStore } from "@/store";
import type { FormStatus } from "@/twitchautomator";

// emit
const emit = defineEmits(["formSuccess"]);

// setup
const store = useStore();
const { t, te } = useI18n();

// data
const formStatusText = ref<string>("Ready");
const formStatus = ref<FormStatus>("IDLE");
const formData = ref<{ login: string }>({
    login: "",
});


function submitForm(event: Event) {
    formStatusText.value = t("messages.loading");
    formStatus.value = "LOADING";

    axios
        .post<ApiResponse>(`/api/v0/tools/chat_dump`, formData.value)
        .then((response) => {
            const json = response.data;
            formStatusText.value = json.message || "No message";
            formStatus.value = json.status;
            if (json.status == "OK") {
                emit("formSuccess", json);
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

    event.preventDefault();
    return false;
}

</script>
