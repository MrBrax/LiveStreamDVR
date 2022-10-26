<template>
    <form
        v-if="!loading && settingsFields && formData"
        method="POST"
        enctype="multipart/form-data"
        action="#"
        @submit.prevent="submitForm"
    >
        <div class="field">
            <input
                v-model="searchText"
                class="input"
                type="text"
                :placeholder="$t('input.search')"
            >
        </div>
        <details
            v-for="groupData in settingsGroups"
            :key="groupData.name"
            class="settings-details"
            :open="searchText !== ''"
        >
            <summary>{{ te('configgroup.' + groupData.name) ? t('configgroup.' + groupData.name) : groupData.name }}</summary>
            <div
                v-for="(data, index) in groupData.fields"
                :key="index"
                class="field"
            >
                <label
                    v-if="data.type != 'boolean'"
                    class="label"
                    :for="'input_' + data.key"
                >
                    {{ te('config.' + data.key) ? $t('config.' + data.key) : data.text }} <span
                        v-if="data.required"
                        class="required"
                    >*</span>
                    <span
                        v-if="data.deprecated"
                        class="is-small is-error"
                    >Deprecated</span>
                </label>

                <!-- boolean -->
                <div
                    v-if="data.type == 'boolean' && formData"
                    class="control"
                >
                    <label class="checkbox">
                        <input
                            :id="'input_' + data.key"
                            v-model="(formData[data.key] as boolean)"
                            type="checkbox"
                            :name="data.key"
                        >
                        {{ data.text }}
                    </label>
                </div>

                <!-- string -->
                <div
                    v-if="data.type == 'string'"
                    class="control"
                >
                    <input
                        :id="'input_' + data.key"
                        v-model="(formData[data.key] as string)"
                        class="input"
                        type="text"
                        :name="data.key"
                        :title="data.help"
                        :pattern="data.pattern"
                    >
                </div>

                <!-- text -->
                <div
                    v-if="data.type == 'text'"
                    class="control"
                >
                    <textarea
                        :id="'input_' + data.key"
                        v-model="(formData[data.key] as string)"
                        class="input"
                        :name="data.key"
                        :title="data.help"
                    />
                </div>

                <!-- number -->
                <div
                    v-if="data.type == 'number'"
                    class="control"
                >
                    <input
                        :id="'input_' + data.key"
                        v-model.number="(formData[data.key] as number)"
                        class="input"
                        type="number"
                        :name="data.key"
                    >
                </div>

                <!-- array -->
                <div
                    v-if="data.type == 'array'"
                    class="control"
                >
                    <!--<input class="input" :name="key" :id="key" :value="settings[key]" />-->
                    <div class="select">
                        <select
                            v-if="data.choices"
                            :id="'input_' + data.key"
                            v-model="formData[data.key]"
                            class="input"
                            :name="data.key"
                        >
                            <option
                                v-for="(item, ix) in data.choices"
                                :id="data.key"
                                :key="ix"
                                :selected="
                                    (formData[data.key] !== undefined && formData[data.key] === item) ||
                                        (formData[data.key] === undefined && item === data.default)
                                "
                            >
                                {{ item }}
                            </option>
                        </select>
                    </div>
                </div>

                <!-- template -->
                <div
                    v-if="data.type == 'template'"
                    class="control"
                >
                    <input
                        :id="'input_' + data.key"
                        v-model="formData[data.key]"
                        class="input"
                        type="text"
                        :name="data.key"
                    >
                    <ul class="template-replacements">
                        <li
                            v-for="(item, ix) in data.replacements"
                            :key="ix"
                        >
                            <button
                                v-if="item.deprecated"
                                type="button"
                                class="deprecated"
                                title="Deprecated"
                                @click="insertReplacement(data.key, ix)"
                            >
                                <span class="strikethrough">&lbrace;{{ ix }}&rbrace;</span>
                            </button>
                            <button
                                v-else
                                type="button"
                                @click="insertReplacement(data.key, ix)"
                            >
                                &lbrace;{{ ix }}&rbrace;
                            </button>
                        </li>
                    </ul>
                    <p class="template-preview">
                        {{ templatePreview(data, formData[data.key] as string) }}
                    </p>
                </div>

                <p
                    v-if="data.help"
                    class="input-help"
                >
                    {{ data.help }}
                </p>
                <p
                    v-if="data.default !== undefined"
                    class="input-default"
                >
                    Default: {{ data.default }}
                </p>
                <!--<p v-if="data.secret" class="input-secret">This is a secret field, keep blank to keep current value.</p>-->
            </div>
        </details>

        <div class="control">
            <hr>
            <button
                class="button is-confirm"
                type="submit"
            >
                <span class="icon"><fa icon="save" /></span>
                <span>{{ $t('buttons.save') }}</span>
            </button>
            <span :class="formStatusClass">{{ formStatusText }}</span>
        </div>

        <div class="control">
            <hr>
            <button
                class="button is-confirm"
                type="button"
                @click="doValidateExternalURL"
            >
                <span class="icon"><fa icon="globe" /></span>
                <span>{{ $t('forms.config.validate-external-url') }}</span>
            </button>
        </div>
    </form>
    <div v-if="loading">
        <span class="icon"><fa
            icon="sync"
            spin
        /></span> {{ $t("messages.loading") }}
    </div>
    <hr>
    <youtube-auth />
</template>

<script lang="ts">
import { useStore } from "@/store";
import { ApiResponse, ApiSettingsResponse } from "@common/Api/Api";
import { SettingField } from "@common/Config";
import { AxiosError } from "axios";
import { defineComponent } from "vue";
import { formatString } from "@common/Format";
import YoutubeAuth from "@/components/YoutubeAuth.vue";

import { library } from "@fortawesome/fontawesome-svg-core";
import { faGlobe, faSave } from "@fortawesome/free-solid-svg-icons";
import { useI18n } from "vue-i18n";
library.add(faGlobe, faSave);

interface SettingsGroup {
    name: string;
    fields: SettingField<string | number | boolean>[];
}

export default defineComponent({
    name: "SettingsForm",
    components: {
        YoutubeAuth,
    },
    emits: ["formSuccess"],
    setup() {
        const store = useStore();
        const { t, te } = useI18n();
        return { store, t, te };
    },
    data(): {
        formStatusText: string;
        formStatus: string;
        formData: Record<string, string | number | boolean>;
        settingsFields: SettingField<string | number | boolean>[];
        loading: boolean;
        searchText: string;
    } {
        return {
            formStatusText: "Ready",
            formStatus: "",
            formData: {},
            settingsFields: [],
            loading: false,
            searchText: "",
        };
    },
    computed: {
        settingsGroups(): SettingsGroup[] {
            if (!this.settingsFields) return [];
            const groups: Record<string, SettingsGroup> = {};
            for (const field of this.settingsFields) {
                if (!field.group) continue;
                if (this.searchText) {
                    if (
                        !field.key.toLowerCase().includes(this.searchText.toLowerCase()) &&
                        !field.help?.toLowerCase().includes(this.searchText.toLowerCase()) &&
                        !field.text?.toLowerCase().includes(this.searchText.toLowerCase())
                    ) continue;
                }
                if (!groups[field.group]) groups[field.group] = { name: field.group, fields: [] };
                groups[field.group].fields.push(field);
            }
           return Object.values(groups).filter((group) => group.fields.length > 0);

           /*
           return Object.values(groups).filter((group) => {
                if (!this.searchText) return true;
                return group.fields.some((field) => {
                    return field.key.toLowerCase().includes(this.searchText.toLowerCase());
                });
            });
            */
        },
        /*
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
        */
        formStatusClass(): Record<string, boolean> {
            return {
                "form-status": true,
                "is-error": this.formStatus == "ERROR",
                "is-success": this.formStatus == "OK",
            };
        },
    },
    mounted(): void {
        this.fetchData();
    },
    /*
    created: {
        this.formData = this.settingsData;
    },
    */
    methods: {
        fetchData(): void {
            this.loading = true;
            this.$http.get("/api/v0/settings").then((response) => {
                const data: ApiSettingsResponse = response.data;
                this.formData = data.data.config;
                this.settingsFields = data.data.fields;

                // set defaults
                for (const field of this.settingsFields) {
                    if (field.default !== undefined && this.formData[field.key] === undefined) {
                        this.formData[field.key] = field.default;
                    }
                }

            }).finally(() => {
                this.loading = false;
            });
        },
        submitForm(event: Event) {

            this.formStatusText = this.$t("messages.loading");
            this.formStatus = "";

            this.$http
                .put<ApiResponse>(`/api/v0/settings`, this.formData)
                .then((response) => {
                    const json: ApiResponse = response.data;
                    this.formStatusText = json.message || "No message";
                    this.formStatus = json.status;
                    if (json.message) alert(json.message);
                    if (json.status == "OK") {
                        this.$emit("formSuccess", json);
                        window.location.reload();
                    }
                    console.debug("settings save response", response);
                })
                .catch((err: AxiosError<ApiResponse>) => {
                    console.error("form error", err.response);
                    this.formStatusText = err.response?.data ? ( err.response.data.message || "Unknown error" ) : "Fatal error";
                    // this.formStatusText = err.response.message ? err.response.message : "Fatal error";
                    this.formStatus = "ERROR";
                });

            event.preventDefault();
            return false;
        },
        configValue(key: string): string | number | boolean | undefined {
            if (!this.formData) return undefined;
            // const k: keyof ApiConfig = key as keyof ApiConfig;
            // return this.formData[k] as unknown as T;
            return this.formData[key];
        },
        doValidateExternalURL() {
            this.$http
                .post<ApiResponse>(`/api/v0/settings/validate_url`)
                .then((response) => {
                    const json: ApiResponse = response.data;
                    if (json.message) alert(json.message);
                })
                .catch((err: AxiosError<ApiResponse>) => {
                    console.error("form error", err.response);
                    if (err.response?.data) {
                        alert(err.response.data.message);
                    } else {
                        alert("Fatal error");
                    }
                });
        },
        templatePreview(data: SettingField<any>, template: string): string {
            // console.debug("templatePreview", data, template);
            if (!data.replacements) return "";
            const replaced_string = formatString(template, Object.fromEntries(Object.entries(data.replacements).map(([key, value]) => [key, value.display])));
            if (data.context) {
                // return data.context.replace(/{template}/g, replaced_string);
                return formatString(data.context, Object.fromEntries(Object.entries(data.replacements).map(([key, value]) => [key, value.display]))).replace(/{template}/g, replaced_string);
            } else {
                return replaced_string;
            }
        },
        insertReplacement(key: string, value: string) {
            const input = document.getElementById(`input_${key}`) as HTMLInputElement;
            if (input) {
                const caret = input.selectionStart;
                if (caret !== null) {
                    const rep = `{${value}}`;
                    // input.value = input.value.substring(0, caret) + rep + input.value.substring(caret);
                    this.formData[key] = input.value.substring(0, caret) + rep + input.value.substring(caret);
                    input.selectionStart = caret + rep.length;
                    input.selectionEnd = caret + rep.length;
                    input.focus();
                }
                // const text = input.value;
                // input.value = text.substring(0, caret) + value + text.substring(caret);
            }
        },
    },
});
</script>

<style lang="scss" scoped>
    .deprecated {
        background-color: #c13e3e;
        &:hover {
            background-color: #d44949;
        }
    }
</style>