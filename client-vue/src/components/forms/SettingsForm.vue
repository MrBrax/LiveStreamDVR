<template>
    <form method="POST" enctype="multipart/form-data" action="#" @submit="submitForm" v-if="settingsFields && settingsData">
        <details class="settings-details" v-for="(groupData, groupName) in settingsGroups" v-bind:key="groupName">
            <summary>{{ groupName }}</summary>
            <div class="field" v-for="(data, index) in groupData" v-bind:key="index">
                <label v-if="data.type != 'boolean'" class="label" :for="'input_' + data.key">
                    {{ data.text }}
                    <span v-if="data.deprecated" class="is-small is-error">Deprecated</span>
                </label>

                <!-- boolean -->
                <div v-if="data.type == 'boolean'" class="control">
                    <label class="checkbox">
                        <input
                            type="checkbox"
                            :name="data.key"
                            :id="'input_' + data.key"
                            :checked="settingsData[data.key] !== undefined ? settingsData[data.key] : data.default"
                        />
                        {{ data.text }}
                    </label>
                </div>

                <!-- string -->
                <div v-if="data.type == 'string'" class="control">
                    <input
                        class="input"
                        type="text"
                        :name="data.key"
                        :id="'input_' + data.key"
                        :value="settingsData[data.key] !== undefined ? settingsData[data.key] : data.default"
                        :title="data.help"
                        :pattern="data.pattern"
                    />
                </div>

                <!-- number -->
                <div v-if="data.type == 'number'" class="control">
                    <input
                        class="input"
                        type="number"
                        :name="data.key"
                        :id="'input_' + data.key"
                        :value="settingsData[data.key] !== undefined ? settingsData[data.key] : data.default"
                    />
                </div>

                <!-- array -->
                <div v-if="data.type == 'array'" class="control">
                    <!--<input class="input" :name="key" :id="key" :value="settings[key]" />-->
                    <select class="input" :name="data.key" :id="'input_' + data.key" v-if="data.choices">
                        <option
                            v-for="item in data.choices"
                            :key="item"
                            :selected="
                                (settingsData[data.key] !== undefined && settingsData[data.key] === item) ||
                                (settingsData[data.key] === undefined && item === data.default)
                            "
                        >
                            {{ item }}
                        </option>
                    </select>
                </div>
                <p v-if="data.help" class="input-help">{{ data.help }}</p>
                <p v-if="data.default" class="input-help">Default: {{ data.default }}</p>
            </div>
        </details>

        <div class="control">
            <hr />
            <button class="button is-confirm" type="submit">
                <span class="icon"><fa icon="save"></fa></span> Save
            </button>
            <span :class="formStatusClass">{{ formStatusText }}</span>
        </div>
    </form>
</template>

<script lang="ts">
import { ApiConfig, ApiSettingsField } from "@/twitchautomator";
import { AxiosError } from "axios";
import { defineComponent } from "vue";

export default defineComponent({
    name: "SettingsForm",
    props: {
        settingsData: Object as () => ApiConfig[],
        settingsFields: Object as () => ApiSettingsField[],
    },
    emits: ["formSuccess"],
    data() {
        return {
            formStatusText: "Ready",
            formStatus: "",
            formData: {},
        };
    },
    /*
    created: {
        this.formData = this.settingsData;
    },
    */
    methods: {
        submitForm(event: Event) {
            const form = event.target as HTMLFormElement;
            const inputs = new FormData(form);

            this.formStatusText = "Loading...";
            this.formStatus = "";

            console.log("form", form);
            console.log("entries", inputs, inputs.entries(), inputs.values());

            this.$http
                .put(`/api/v0/settings`, inputs)
                .then((response) => {
                    const json = response.data;
                    this.formStatusText = json.message;
                    this.formStatus = json.status;
                    if (json.status == "OK") {
                        this.$emit("formSuccess", json);
                    }
                    console.debug("settings save response", response);
                })
                .catch((err: AxiosError) => {
                    console.error("form error", err.response);
                    this.formStatusText = err.response?.data ? err.response.data.message : "Fatal error";
                    // this.formStatusText = err.response.message ? err.response.message : "Fatal error";
                    this.formStatus = "ERROR";
                });

            event.preventDefault();
            return false;
        },
    },
    computed: {
        settingsGroups(): Record<string, ApiSettingsField[]> {
            if (!this.settingsFields) return {};
            let data: Record<string, ApiSettingsField[]> = {};

            for (const key in this.settingsFields) {
                const field = this.settingsFields[key];
                if (!data[field.group]) data[field.group] = [];
                data[field.group].push(field);
            }
            console.log("settingsGroups", data);

            data = Object.keys(data)
                .sort()
                .reduce((obj: any, key) => {
                    obj[key] = data[key];
                    return obj;
                }, {});

            console.log("settingsGroups sort", data);
            return data;
        },
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
