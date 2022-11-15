<template>
    <div class="section-content">
        <div
            v-for="(value, key) in defaultConfigFields"
            v-show="!value.hidden"
            :key="key"
            class="field"
            :title="key.toString()"
        >
            <label
                v-if="value.type != 'boolean'"
                class="label"
                :for="'input_' + key"
            >
                {{ te('clientsetting.' + key) ? te('clientsetting.' + key) : value.name }} <!--<span v-if="value.required" class="required">*</span>-->
            </label>
            <div
                v-if="value.type === 'boolean'"
                class="control"
            >
                <label class="checkbox">
                    <input
                        v-model="(updateConfig[key] as boolean)"
                        type="checkbox"
                    > {{ te('clientsetting.' + key) ? t('clientsetting.' + key) : value.name }}
                </label>
            </div>
            <div
                v-if="value.type === 'number'"
                class="control"
            >
                <input
                    :id="'input_' + key"
                    v-model.number="(updateConfig[key] as number)"
                    type="number"
                    class="input"
                >
            </div>
            <div
                v-if="value.type === 'string'"
                class="control"
            >
                <input
                    :id="'input_' + key"
                    v-model="(updateConfig[key] as string)"
                    type="text"
                    class="input"
                >
            </div>
            <div
                v-if="value.type === 'choice'"
                class="control"
            >
                <div class="select">
                    <select
                        :id="'input_' + key"
                        v-model="(updateConfig[key] as string)"
                    >
                        <option
                            v-for="(option, optionKey) in value.choices"
                            :key="optionKey"
                            :value="optionKey"
                        >
                            {{ option }}
                        </option>
                    </select>
                </div>
            </div>
            <p
                v-if="value.help"
                class="input-help"
            >
                {{ value.help }}
            </p>
            <p
                v-if="value.default !== undefined"
                class="input-default"
            >
                Default: {{ value.default }}
            </p>
        </div>
        <div class="field">
            <label class="label">Language</label>
            <div class="control">
                <div class="select">
                    <select v-model="updateConfig.language">
                        <option
                            v-for="(language, code) in locales"
                            :key="code"
                            :value="code"
                        >
                            {{ language }} ({{ code }})
                        </option>
                    </select>
                </div>
            </div>
        </div>
        <div class="field">
            <label class="label">Side menu</label>
            <div class="control">
                <label class="checkbox">
                    <input
                        v-model="sideMenuShow.vod_icon"
                        type="checkbox"
                    > Icon
                </label>
            </div>
            <div class="control">
                <label class="checkbox">
                    <input
                        v-model="sideMenuShow.vod_date"
                        type="checkbox"
                    > Date
                </label>
            </div>
            <div class="control">
                <label class="checkbox">
                    <input
                        v-model="sideMenuShow.vod_duration"
                        type="checkbox"
                    > Duration
                </label>
            </div>
            <div class="control">
                <label class="checkbox">
                    <input
                        v-model="sideMenuShow.vod_size"
                        type="checkbox"
                    > Size
                </label>
            </div>
            <div class="control">
                <label class="checkbox">
                    <input
                        v-model="sideMenuShow.vod_basename"
                        type="checkbox"
                    > Basename
                </label>
            </div>
            <div class="control">
                <label class="checkbox">
                    <input
                        v-model="sideMenuShow.vod_sxe"
                        type="checkbox"
                    > Season / Episode (Year+Month)
                </label>
            </div>
            <div class="control">
                <label class="checkbox">
                    <input
                        v-model="sideMenuShow.vod_sxe_absolute"
                        type="checkbox"
                    > Season / Episode (Absolute)
                </label>
            </div>
            <div class="control">
                <label class="checkbox">
                    <input
                        v-model="sideMenuShow.vod_title"
                        type="checkbox"
                    > Title
                </label>
            </div>
        </div>
        <div class="field">
            <label class="label">Video blocks collapse</label>
            <div class="control">
                <label class="checkbox">
                    <input
                        v-model="videoBlockShow.general"
                        type="checkbox"
                    > General
                </label>
            </div>
            <div class="control">
                <label class="checkbox">
                    <input
                        v-model="videoBlockShow.segments"
                        type="checkbox"
                    > Segments
                </label>
            </div>
            <div class="control">
                <label class="checkbox">
                    <input
                        v-model="videoBlockShow.bookmarks"
                        type="checkbox"
                    > Bookmarks
                </label>
            </div>
            <div class="control">
                <label class="checkbox">
                    <input
                        v-model="videoBlockShow.chapters"
                        type="checkbox"
                    > Chapters
                </label>
            </div>
            <div class="control">
                <label class="checkbox">
                    <input
                        v-model="videoBlockShow.viewers"
                        type="checkbox"
                    > Viewers
                </label>
            </div>
        </div>
        <div class="field buttons">
            <button
                class="button is-confirm"
                @click="saveClientConfig"
            >
                <span class="icon"><font-awesome-icon icon="save" /></span>
                <span>{{ t('buttons.save') }}</span>
            </button>
            <button
                class="button is-confirm"
                @click="downloadClientSettings"
            >
                <span class="icon"><font-awesome-icon icon="download" /></span>
                <span>{{ t('buttons.sync-down') }}</span>
            </button>
            <button
                class="button is-confirm"
                @click="uploadClientConfig"
            >
                <span class="icon"><font-awesome-icon icon="upload" /></span>
                <span>{{ t('buttons.sync-up') }}</span>
            </button>
            <button
                class="button is-danger"
                @click="resetClientConfig"
            >
                <span class="icon"><font-awesome-icon icon="undo" /></span>
                <span>{{ t('buttons.reset') }}</span>
            </button>
        </div>
        <br>
        <div class="field">
            <button
                class="button is-small"
                @click="requestNotifications"
            >
                <span class="icon"><font-awesome-icon icon="bell" /></span>
                <span>Request notification permissions</span>
            </button>
        </div>
        <div class="field">
            <button
                class="button is-danger"
                :disabled="!store.authenticated"
                @click="logout"
            >
                <span class="icon"><font-awesome-icon icon="arrow-right-from-bracket" /></span>
                <span>{{ t('buttons.logout') }}</span>
            </button>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { useStore } from "@/store";
import { computed, onMounted, ref } from "vue";
import { defaultConfig, defaultConfigFields } from "@common/ClientSettings";
import { defaultSidemenuShow, defaultVideoBlockShow } from "@/defs";
import type { SidemenuShow, VideoBlockShow } from "@/twitchautomator";
import type { ClientSettings } from "@common/ClientSettings.d";
import type { ApiResponse} from "@common/Api/Api";

import { library } from "@fortawesome/fontawesome-svg-core";
import { faBell, faArrowRightFromBracket, faSave, faDownload, faUpload, faUndo } from "@fortawesome/free-solid-svg-icons";
import { useI18n } from "vue-i18n";
import axios from "axios";
library.add(faBell, faArrowRightFromBracket, faSave, faDownload, faUpload, faUndo);

const store = useStore();
const { t, te, availableLocales, locale } = useI18n();

const currentConfig = ref<ClientSettings>({...defaultConfig});
const updateConfig = ref<ClientSettings>({...defaultConfig});
const sideMenuShow = ref<SidemenuShow>({...defaultSidemenuShow});
const videoBlockShow = ref<VideoBlockShow>({...defaultVideoBlockShow});

const locales = computed((): Record<string, string> => {
    const names = new Intl.DisplayNames(["en"], { type: "language" });
    const all: Record<string, string> = {};
    for (const code of availableLocales) {
        all[code] = names.of(code) || code;
    }
    return all;
});

onMounted(() => {
    if (!store.clientConfig) return;
    // const crConf = {...defaultConfig};
    const cConfig: ClientSettings = {...store.clientConfig};
    updateConfig.value = cConfig;
    currentConfig.value = cConfig;

    sideMenuShow.value = {...store.sidemenuShow};
    videoBlockShow.value = {...store.videoBlockShow};
});


function saveClientConfig() {
    store.updateClientConfig(updateConfig.value);
    store.sidemenuShow = sideMenuShow.value; // TODO: move to store
    store.videoBlockShow = videoBlockShow.value; // TODO: move to store
    store.saveClientConfig();
    locale.value = updateConfig.value.language;
    if (currentConfig.value.enableNotifications !== updateConfig.value.enableNotifications && updateConfig.value.enableNotifications) {
        requestNotifications();
    }
    alert("Settings saved, reloading...");
    window.location.reload();
}

function requestNotifications() {
    if (!("Notification" in window)) {
        alert("This browser does not support desktop notification");
    } else if (Notification.permission === "granted") {
        new Notification("Notifications already granted.");
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(function (permission) {
            if (permission === "granted") {
                new Notification("Notifications granted.");
            }
        });
    }
}

function downloadClientSettings() {
    axios.get<ApiResponse>("/api/v0/clientsettings").then((response) => {
        const json = response.data;
        if (json.message) alert(json.message);
        console.log(json);
        console.log("data", json.data);
        if (json.data) {
            if (store.validateClientConfig(json.data)){
                store.updateClientConfig(json.data);
                store.saveClientConfig();
                alert("Settings downloaded:\n" + Object.entries(json.data).map(([k, v]) => `${k}: ${v}`).join("\n"));
                window.location.reload();
            } else {
                alert("Invalid config");
            }
        } else {
            alert("Error: no data");
        }
    }).catch((error) => {
        console.error(error);
        alert("Error: " + error);
    });
}

function uploadClientConfig() {
    axios.put<ApiResponse>("/api/v0/clientsettings", store.clientConfig).then((response) => {
        const json = response.data;
        if (json.message) alert(json.message);
        console.log(json);
    }).catch((error) => {
        console.log(error);
        if (axios.isAxiosError(error)) {
            console.error("error", error.response);
            if (error.response && error.response.data && error.response.data.message) {
                alert(error.response.data.message);
            }
        }
    });
}

function resetClientConfig() {
    store.updateClientConfig({...defaultConfig});
    store.saveClientConfig();
    alert("Settings reset, reloading...");
    window.location.reload();
}

function logout() {
    store.logout().then(() => {
        window.location.reload();
    });
}

</script>
