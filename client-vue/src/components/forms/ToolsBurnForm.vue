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
                    <option v-for="quality in VideoQualityArray" :key="quality">{{ quality }}</option>
                </select>
            </div>
        </div>

        <div class="field">
            <div class="control">
                <button class="button is-confirm" type="submit">
                    <span class="icon"><fa icon="burn"></fa></span> Execute
                </button>
                <span :class="formStatusClass">{{ formStatusText }}</span>
            </div>
        </div>
    </form>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { VideoQualityArray } from "@common/Defs";

export default defineComponent({
    name: "ToolsBurnForm",
    emits: ["formSuccess"],
    setup() {
        return { VideoQualityArray };
    },
    data() {
        return {
            formStatusText: "Ready",
            formStatus: "",
            formData: {},
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

            /** @todo: axios */
            fetch(`api/v0/###`, {
                method: "POST",
                body: inputs,
            })
                .then((response) => response.json())
                .then((json) => {
                    this.formStatusText = json.message;
                    this.formStatus = json.status;
                    if (json.status == "OK") {
                        this.$emit("formSuccess", json);
                    }
                })
                .catch((err) => {
                    console.error("Error burn form", err);
                    this.formStatusText = err;
                    this.formStatus = "ERROR";
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
