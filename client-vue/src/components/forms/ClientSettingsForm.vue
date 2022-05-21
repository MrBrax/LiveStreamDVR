<template>
    <div class="section-content">
        <!--
        <div class="field">
            <label class="checkbox"><input type="checkbox" v-model="updateConfig.enableNotifications" /> Notifications</label>
        </div>
        <div class="field">
            <label class="checkbox"><input type="checkbox" v-model="updateConfig.useSpeech" /> Use speech</label>
        </div>
        <div class="field">
            <label class="checkbox"><input type="checkbox" v-model="updateConfig.singlePage" /> Separate channels to their own page</label>
        </div>
        <div class="field">
            <label class="checkbox"><input type="checkbox" v-model="updateConfig.animationsEnabled" /> Enable animations</label>
        </div>
        <div class="field">
            <label class="checkbox"><input type="checkbox" v-model="updateConfig.tooltipStatic" /> Static side menu tooltip</label>
        </div>
        <div class="field">
            <label class="checkbox"><input type="checkbox" v-model="updateConfig.useRelativeTime" /> Use relative time</label>
        </div>
        <div class="field">
            <label class="checkbox"><input type="checkbox" v-model="updateConfig.useWebsockets" /> Use websockets</label>
        </div>
        <div class="field">
            <label class="checkbox"><input type="checkbox" v-model="updateConfig.useBackgroundRefresh" /> Background capturing vod refresh</label>
        </div>
        <div class="field">
            <label class="checkbox"><input type="checkbox" v-model="updateConfig.useBackgroundTicker" /> Background ticker</label>
        </div>
        <div class="field">
            <label class="checkbox"><input type="checkbox" v-model="updateConfig.expandVodList" /> Always expand VOD list</label>
        </div>
        <div class="field">
            <input type="number" class="input" v-model.number="updateConfig.vodsToShowInMenu" />
            <p class="input-help">Number of VODs to show in menu</p>
        </div>
        !--
        <div class="field">
            <label class="checkbox"><input type="checkbox" v-model="updateConfig.alwaysShowCapturingVodInMenu" /> Always show capturing VOD in menu</label>
        </div>
        --
        <div class="field">
            <input type="text" class="input" v-model="updateConfig.websocketAddressOverride" />
            <p class="input-help">Websocket address override</p>
        </div>-->
        <div class="field" v-for="(value, key) in defaultConfigFields" :key="key" :title="key">
            <label v-if="value.type != 'boolean'" class="label" :for="'input_' + key">
                {{ $te('clientsetting.' + key) ? $te('clientsetting.' + key) : value.name }} <!--<span v-if="value.required" class="required">*</span>-->
            </label>
            <div class="control" v-if="value.type === 'boolean'">
                <label class="checkbox">
                    <input type="checkbox" v-model="(updateConfig[key] as boolean)" /> {{ $te('clientsetting.' + key) ? $t('clientsetting.' + key) : value.name }}
                </label>
                <p class="input-help" v-if="value.help">{{ value.help }}</p>
            </div>
            <div class="control" v-if="value.type === 'number'">
                <input type="number" class="input" v-model.number="(updateConfig[key] as number)" :id="'input_' + key" />
                <p class="input-help" v-if="value.help">{{ value.help }}</p>
            </div>
            <div class="control" v-if="value.type === 'string'">
                <input type="text" class="input" v-model="(updateConfig[key] as string)" :id="'input_' + key" />
                <p class="input-help" v-if="value.help">{{ value.help }}</p>
            </div>
            <div class="control" v-if="value.type === 'choice'">
                <select class="input" v-model="(updateConfig[key] as string)" :id="'input_' + key">
                    <option v-for="(option, optionKey) in value.choices" :value="optionKey">{{ option }}</option>
                </select>
                <p class="input-help" v-if="value.help">{{ value.help }}</p>
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
