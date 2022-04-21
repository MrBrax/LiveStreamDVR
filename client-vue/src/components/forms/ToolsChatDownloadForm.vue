<template>
    <form method="POST" @submit="submitForm">
        <div class="field">
            <label class="label">VOD URL</label>
            <div class="control">
                <input class="input input-required" type="text" v-model="formData.url" required />
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

        <div class="field" v-if="fileLink">
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
            },
            fileLink: "",
        };
    },
    methods: {
        submitForm(event: Event) {
            this.formStatusText = "Loading...";
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
                    this.formStatusText = err;
                    this.formStatus = "ERROR";
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
