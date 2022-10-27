<template>
    <div class="section-content">
        <div
            v-for="(value, key) in defaultConfigFields"
            v-show="!value.hidden"
            :key="key"
            class="field"
            :title="key"
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
            <button
                class="button is-confirm"
                @click="saveClientConfig"
            >
                <span class="icon"><fa icon="save" /></span>
                <span>{{ t('buttons.save') }}</span>
            </button>
        </div>
        <br>
        <div class="field">
            <button
                class="button is-small"
                @click="requestNotifications"
            >
                <span class="icon"><fa icon="bell" /></span>
                <span>Request notification permissions</span>
            </button>
        </div>
        <div class="field">
            <button
                class="button is-danger"
                :disabled="!store.authenticated"
                @click="logout"
            >
                <span class="icon"><fa icon="arrow-right-from-bracket" /></span>
                <span>{{ t('buttons.logout') }}</span>
            </button>
        </div>
    </div>
</template>

<script lang="ts">
import { useStore } from "@/store";
import { defineComponent } from "vue";
import { defaultConfig, defaultConfigFields, defaultSidemenuShow } from "@/defs";
import { ClientSettings, SidemenuShow } from "@/twitchautomator";

import { library } from "@fortawesome/fontawesome-svg-core";
import { faBell, faArrowRightFromBracket, faSave } from "@fortawesome/free-solid-svg-icons";
import { useI18n } from "vue-i18n";
library.add(faBell, faArrowRightFromBracket, faSave);

export default defineComponent({
    name: "ClientSettingsForm",
    title: "Client settings",
    setup() {
        const store = useStore();
        const { t, te } = useI18n();
        return { store, defaultConfigFields, t, te };
    },
    data(): {
        currentConfig: ClientSettings;
        updateConfig: ClientSettings;
        sideMenuShow: SidemenuShow;
    } {
        return {
            currentConfig: {...defaultConfig},
            updateConfig: {...defaultConfig},
            sideMenuShow: {...defaultSidemenuShow},
        };
    },
    computed: {
        locales(): Record<string, string> {
            const provided = this.$i18n.availableLocales;
            const names = new Intl.DisplayNames(["en"], { type: "language" });
            const all: Record<string, string> = {};
            for (const code of provided) {
                all[code] = names.of(code) || code;
            }
            return all;
        },
    },
    created() {
        if (!this.store.clientConfig) return;
        // const crConf = {...defaultConfig};
        const currentConfig: ClientSettings = {...this.store.clientConfig};
        this.updateConfig = currentConfig;
        this.currentConfig = currentConfig;

        this.sideMenuShow = {...this.store.sidemenuShow};
    },
    methods: {
        saveClientConfig() {
            this.store.updateClientConfig(this.updateConfig);
            this.store.sidemenuShow = this.sideMenuShow; // TODO: move to store
            this.store.saveClientConfig();
            this.$i18n.locale = this.updateConfig.language;
            if (this.currentConfig.enableNotifications !== this.updateConfig.enableNotifications && this.updateConfig.enableNotifications) {
                this.requestNotifications();
            }
            alert("Settings saved, reloading...");
            window.location.reload();
        },
        requestNotifications() {
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
        },
        logout() {
            this.store.logout().then(() => {
                window.location.reload();
            });
        }
    }
    /*
    watch: {
        updateConfig: {
            handler() {
                this.saveClientConfig();
            },
            deep: true,
        },
    },
    */
});
</script>
