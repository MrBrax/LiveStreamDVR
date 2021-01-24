<template>
    <form method="POST" @submit="submitForm">
        <div class="field">
            <label class="label">VOD URL</label>
            <div class="control">
                <input class="input input-required" type="text" name="url" value="" required />
            </div>
        </div>

        <div class="field">
            <label class="label">Quality</label>
            <div class="control">
                <select class="input input-required" name="quality">
                    <option v-for="quality in twitchQuality" :key="quality">{{ quality }}</option>
                </select>
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

import { library } from "@fortawesome/fontawesome-svg-core";
import { faDownload } from "@fortawesome/free-solid-svg-icons";
library.add(faDownload);

export default defineComponent({
    name: "ToolsVodDownloadForm",
    emits: ["formSuccess"],
    data() {
        return {
            formStatusText: "Ready",
            formStatus: "",
            fileLink: "",
        };
    },
    methods: {
        submitForm(event: Event) {
            const form = event.target as HTMLFormElement;
            const inputs = new FormData(form);

            this.formStatusText = "Loading...";
            this.formStatus = "";

            console.log("form", form);
            console.log("entries", inputs, inputs.entries(), inputs.values());

            this.$http
                .post(`/api/v0/tools/voddownload`, inputs)
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
