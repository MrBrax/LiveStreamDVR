<template>
    <form method="POST" @submit.prevent="submitForm">
        <div class="field">
            <label class="label">Login</label>
            <div class="control">
                <input class="input" type="text" v-model="formData.login" required />
                <p class="input-help">
                    Does not need to exist in your channels list.
                </p>
            </div>
        </div>

        <p>
            The chat dumper will continue to run in the background until you manually stop it.<br />
            Keeping it running for a very long time can use up a large amount of disk space.
        </p>

        <div class="field form-submit">
            <div class="control">
                <button class="button is-confirm" type="submit">
                    <span class="icon"><fa icon="download"></fa></span>
                    <span>{{ $t('buttons.execute') }}</span>
                </button>
            </div>
            <div :class="formStatusClass">{{ formStatusText }}</div>
        </div>
    </form>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
    name: "ToolsChatDumpForm",
    emits: ["formSuccess"],
    data() {
        return {
            formStatusText: "Ready",
            formStatus: "",
            formData: {
                login: "",
            },
        };
    },
    methods: {
        submitForm(event: Event) {
            this.formStatusText = this.$t("messages.loading");
            this.formStatus = "";

            this.$http
                .post(`/api/v0/tools/chat_dump`, this.formData)
                .then((response) => {
                    const json = response.data;
                    this.formStatusText = json.message;
                    this.formStatus = json.status;
                    if (json.status == "OK") {
                        this.$emit("formSuccess", json);
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

            event.preventDefault();
            return false;
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
