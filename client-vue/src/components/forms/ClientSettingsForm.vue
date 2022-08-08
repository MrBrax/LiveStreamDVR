<template>
    <div class="section-content">
        <div class="field" v-for="(value, key) in defaultConfigFields" :key="key" :title="key" v-show="!value.hidden">
            <label v-if="value.type != 'boolean'" class="label" :for="'input_' + key">
                {{ $te('clientsetting.' + key) ? $te('clientsetting.' + key) : value.name }} <!--<span v-if="value.required" class="required">*</span>-->
            </label>
            <div class="control" v-if="value.type === 'boolean'">
                <label class="checkbox">
                    <input type="checkbox" v-model="(updateConfig[key] as boolean)" /> {{ $te('clientsetting.' + key) ? $t('clientsetting.' + key) : value.name }}
                </label>
            </div>
            <div class="control" v-if="value.type === 'number'">
                <input type="number" class="input" v-model.number="(updateConfig[key] as number)" :id="'input_' + key" />
            </div>
            <div class="control" v-if="value.type === 'string'">
                <input type="text" class="input" v-model="(updateConfig[key] as string)" :id="'input_' + key" />
            </div>
            <div class="control" v-if="value.type === 'choice'">
                <div class="select">
                    <select v-model="(updateConfig[key] as string)" :id="'input_' + key">
                        <option v-for="(option, optionKey) in value.choices" :value="optionKey">{{ option }}</option>
                    </select>
                </div>
            </div>
            <p class="input-help" v-if="value.help">{{ value.help }}</p>
            <p class="input-default" v-if="value.default !== undefined">Default: {{ value.default }}</p>
        </div>
        <div class="field">
            <label class="label">Language</label>
            <div class="control">
                <div class="select">
                    <select v-model="updateConfig.language">
                        <option v-for="(language, code) in locales" :value="code">{{ language }} ({{ code }})</option>
                    </select>
                </div>
            </div>
        </div>
        <div class="field">
            <label class="label">Password (sent unencrypted and stored in plain text)</label>
            <div class="control">
                <input type="password" class="input" v-model="updateConfig.password" />
            </div>
        </div>
        <div class="field">
            <button class="button is-confirm" @click="saveClientConfig">
                <span class="icon"><fa icon="save" /></span>
                <span>{{ $t('buttons.save') }}</span>
            </button>
        </div>
        <br />
        <div class="field">
            <button class="button is-small" @click="requestNotifications">
                <span class="icon"><fa icon="bell" /></span>
                <span>Request notification permissions</span>
            </button>
        </div>
    </div>
</template>

<script lang="ts">
import { useStore } from "@/store";
import { defineComponent } from "vue";
import { defaultConfig, defaultConfigFields } from "@/defs";
import { ClientSettings } from "@/twitchautomator";

import { library } from "@fortawesome/fontawesome-svg-core";
import { faBell } from "@fortawesome/free-solid-svg-icons";
library.add(faBell);

export default defineComponent({
    name: "ClientSettingsForm",
    title: "Client settings",
    setup() {
        const store = useStore();
        return { store, defaultConfigFields };
    },
    data(): {
        currentConfig: ClientSettings;
        updateConfig: ClientSettings;
    } {
        return {
            currentConfig: {...defaultConfig},
            updateConfig: {...defaultConfig},
        };
    },
    created() {
        if (!this.store.clientConfig) return;
        const crConf = {...defaultConfig};
        const currentConfig: ClientSettings = {...this.store.clientConfig};
        this.updateConfig = currentConfig;
        this.currentConfig = currentConfig;
    },
    methods: {
        saveClientConfig() {
            this.store.updateClientConfig(this.updateConfig);
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
    },
    computed: {
        locales(): Record<string, string> {
            const provided = this.$i18n.availableLocales;
            const names = new Intl.DisplayNames(["en"], { type: "language" });
            let all: Record<string, string> = {};
            for (const code of provided) {
                all[code] = names.of(code) || code;
            }
            return all;
        },
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
