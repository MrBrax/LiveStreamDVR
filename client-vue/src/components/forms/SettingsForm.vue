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
                :placeholder="t('input.search')"
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
                    {{ te('config.' + data.key) ? t('config.' + data.key) : data.text }} <span
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
                            v-model="(formData.config[data.key] as boolean)"
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
                        v-if="!data.multiline"
                        :id="'input_' + data.key"
                        v-model="formData.config[data.key]"
                        class="input"
                        type="text"
                        :name="data.key"
                        :title="data.help"
                        :pattern="data.pattern"
                    >
                    <textarea
                        v-if="data.multiline"
                        :id="'input_' + data.key"
                        v-model="(formData.config[data.key] as string)"
                        class="input textarea"
                        :name="data.key"
                        :title="data.help"
                        :pattern="data.pattern"
                    />
                </div>

                <!-- number -->
                <div
                    v-if="data.type == 'number'"
                    class="control"
                >
                    <input
                        :id="'input_' + data.key"
                        v-model.number="formData.config[data.key]"
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
                            v-model="formData.config[data.key]"
                            class="input"
                            :name="data.key"
                            :data-is-array="data.choices && Array.isArray(data.choices)"
                        >
                            <template v-if="data.choices && Array.isArray(data.choices)">
                                <option
                                    v-for="(item, ix) in data.choices"
                                    :key="ix"
                                    :selected="
                                        (formData.config[data.key] !== undefined && formData.config[data.key] === item) ||
                                            (formData.config[data.key] === undefined && item === data.default)
                                    "
                                >
                                    {{ item }}
                                </option>
                            </template>
                            <template v-else>
                                <option
                                    v-for="(item, ix) in data.choices"
                                    :key="ix"
                                    :value="ix"
                                    :selected="
                                        (formData.config[data.key] !== undefined && formData.config[data.key] === item) ||
                                            (formData.config[data.key] === undefined && ix === data.default)
                                    "
                                >
                                    {{ item }}
                                </option>
                            </template>
                        </select>
                        <span v-else class="is-error">No choices defined</span>
                    </div>
                </div>

                <!-- template -->
                <div
                    v-if="data.type == 'template'"
                    class="control"
                >
                    <textarea
                        v-if="data.multiline"
                        :id="'input_' + data.key"
                        v-model="(formData.config[data.key] as string)"
                        class="input"
                        type="text"
                        :name="data.key"
                    />
                    <input
                        v-else
                        :id="'input_' + data.key"
                        v-model="formData.config[data.key]"
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
                        {{ templatePreview(data, formData.config[data.key] as string) }}
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

        <br>

        <FormSubmit
            :form-status="formStatus"
            :form-status-text="formStatusText"
        >
            <div class="control">
                <button
                    class="button is-confirm"
                    type="submit"
                >
                    <span class="icon"><font-awesome-icon icon="save" /></span>
                    <span>{{ t('buttons.save') }}</span>
                </button>
            </div>
        </FormSubmit>

        <div class="control">
            <hr>
            <button
                class="button is-confirm"
                type="button"
                @click="doValidateExternalURL"
            >
                <span class="icon"><font-awesome-icon icon="globe" /></span>
                <span>{{ t('forms.config.validate-external-url') }}</span>
            </button>
        </div>
    </form>
    <div
        v-if="loading"
        class="loading"
    >
        <span class="icon"><fa
            icon="sync"
            spin
        /></span> {{ t("messages.loading") }}
    </div>
    <hr>
    <div class="auths">
        <youtube-auth />
        <twitch-auth />
    </div>
</template>

<script lang="ts" setup>
import { useStore } from "@/store";
import { ApiResponse, ApiSettingsResponse } from "@common/Api/Api";
import { SettingField } from "@common/Config";
import axios, { AxiosError } from "axios";
import { computed, onMounted, ref } from "vue";
import { formatString } from "@common/Format";
import YoutubeAuth from "@/components/YoutubeAuth.vue";
import TwitchAuth from "@/components/TwitchAuth.vue";
import FormSubmit from "@/components/reusables/FormSubmit.vue";

import { library } from "@fortawesome/fontawesome-svg-core";
import { faGlobe, faSave } from "@fortawesome/free-solid-svg-icons";
import { useI18n } from "vue-i18n";
import { FormStatus } from "@/twitchautomator";
library.add(faGlobe, faSave);

interface SettingsGroup {
    name: string;
    fields: SettingField<string | number | boolean>[];
}

// emit
const emit = defineEmits(["formSuccess"]);

// setup
const store = useStore();
const { t, te } = useI18n();

// data
const formStatusText = ref<string>("Ready");
const formStatus = ref<FormStatus>("IDLE");
const formData = ref<{ config: Record<string, string | number | boolean> }>({ config: {} });
const settingsFields = ref<SettingField<string | number | boolean>[]>([]);
const loading = ref<boolean>(false);
const searchText = ref<string>("");

// computed
const settingsGroups = computed((): SettingsGroup[] => {
    if (!settingsFields.value) return [];
    const groups: Record<string, SettingsGroup> = {};
    for (const field of settingsFields.value) {
        if (!field.group) continue;
        if (searchText.value) {
            if (
                !field.key.toLowerCase().includes(searchText.value.toLowerCase()) &&
                !field.help?.toLowerCase().includes(searchText.value.toLowerCase()) &&
                !field.text?.toLowerCase().includes(searchText.value.toLowerCase())
            ) continue;
        }
        if (!groups[field.group]) groups[field.group] = { name: field.group, fields: [] };
        groups[field.group].fields.push(field);
    }
    return Object.values(groups).filter((group) => group.fields.length > 0);

    /*
    return Object.values(groups).filter((group) => {
        if (!searchText.value) return true;
        return group.fields.some((field) => {
            return field.key.toLowerCase().includes(searchText.value.toLowerCase());
        });
    });
    */
});
  
/*
settingsGroups(): Record<string, ApiSettingsField[]> {
    if (!settingsFields.value) return {};
    let data: Record<string, ApiSettingsField[]> = {};

    for (const key in settingsFields.value) {
        const field = settingsFields.value[key];
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

onMounted(() => {
    fetchData();
});
/*
created: {
    formData.value = this.settingsData;
},
*/
// methods
function fetchData(): void {
    loading.value = true;
    axios.get<ApiSettingsResponse>("/api/v0/settings").then((response) => {
        const data = response.data;
        formData.value.config = data.data.config;
        settingsFields.value = data.data.fields;

        // set defaults
        for (const field of settingsFields.value) {
            if (field.default !== undefined && formData.value.config[field.key] === undefined) {
                formData.value.config[field.key] = field.default;
            }
        }

    }).finally(() => {
        loading.value = false;
    });
}

function submitForm(event: Event) {

    formStatusText.value = t("messages.loading");
    formStatus.value = "LOADING";

    axios
        .put<ApiResponse>(`/api/v0/settings`, formData.value)
        .then((response) => {
            const json: ApiResponse = response.data;
            formStatusText.value = json.message || "No message";
            formStatus.value = json.status;
            if (json.message) alert(json.message);
            if (json.status == "OK") {
                emit("formSuccess", json);
                window.location.reload();
            }
            console.debug("settings save response", response);
        })
        .catch((err: AxiosError<ApiResponse>) => {
            console.error("form error", err.response);
            formStatusText.value = err.response?.data ? ( err.response.data.message || "Unknown error" ) : "Fatal error";
            // formStatusText.value = err.response.message ? err.response.message : "Fatal error";
            formStatus.value = "ERROR";
        });

    event.preventDefault();
    return false;
}

function configValue(key: string): string | number | boolean | undefined {
    if (!formData.value) return undefined;
    // const k: keyof ApiConfig = key as keyof ApiConfig;
    // return formData.value[k] as unknown as T;
    return formData.value.config[key];
}

function doValidateExternalURL() {
    axios
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
}

function templatePreview(data: SettingField<any>, template: string): string {
    // console.debug("templatePreview", data, template);
    if (!data.replacements) return "";
    const replaced_string = formatString(template, Object.fromEntries(Object.entries(data.replacements).map(([key, value]) => [key, value.display])));
    if (data.context) {
        // return data.context.replace(/{template}/g, replaced_string);
        return formatString(data.context, Object.fromEntries(Object.entries(data.replacements).map(([key, value]) => [key, value.display]))).replace(/{template}/g, replaced_string);
    } else {
        return replaced_string;
    }
}

function insertReplacement(key: string, value: string) {
    const input = document.getElementById(`input_${key}`) as HTMLInputElement;
    if (input) {
        const caret = input.selectionStart;
        if (caret !== null) {
            const rep = `{${value}}`;
            // input.value = input.value.substring(0, caret) + rep + input.value.substring(caret);
            const newValue = input.value.substring(0, caret) + rep + input.value.substring(caret);
            formData.value.config[key] = newValue;
            // console.debug("insertReplacement", newValue, formData.value[key]);
            input.selectionStart = caret + rep.length;
            input.selectionEnd = caret + rep.length;
            input.focus();
            // console.debug("insertReplacement", "caret", caret, key, value, input.value);
        } else {
            formData.value.config[key] = formData.value.config[key] + `{${value}}`;
            // console.debug("insertReplacement", "no caret", key, value, input.value);
        }
        // const text = input.value;
        // input.value = text.substring(0, caret) + value + text.substring(caret);
    } else {
        console.error("input not found", key);
    }
}
    

</script>

<style lang="scss" scoped>
.deprecated {
    background-color: #c13e3e;
    &:hover {
        background-color: #d44949;
    }
}

.auths {
    display: flex;
    flex-direction: column;
    gap: 1em;
}
</style>