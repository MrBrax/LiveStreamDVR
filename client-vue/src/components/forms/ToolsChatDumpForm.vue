<template>
    <form method="POST" @submit.prevent="submitForm">
        <div class="field">
            <label class="label">Login</label>
            <div class="control">
                <input class="input input-required" type="text" v-model="formData.login" required />
            </div>
        </div>

        <div class="field">
            <div class="control">
                <button class="button is-confirm" type="submit">
                    <span class="icon"><fa icon="download"></fa></span> Execute
                </button>
                <span :class="formStatusClass">{{ formStatusText }}</span>
            </div>
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
            this.formStatusText = "Loading...";
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
