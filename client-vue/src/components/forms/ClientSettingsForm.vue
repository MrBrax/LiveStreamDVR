<template>
    <div class="section-content">
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
        <!--
        <div class="field">
            <label class="checkbox"><input type="checkbox" v-model="updateConfig.alwaysShowCapturingVodInMenu" /> Always show capturing VOD in menu</label>
        </div>
        -->
        <div class="field">
            <input type="text" class="input" v-model="updateConfig.websocketAddressOverride" />
            <p class="input-help">Websocket address override</p>
        </div>
        <div class="field">
            <button class="button is-primary" @click="saveClientConfig">Save</button>
        </div>
        <br />
        <div class="field">
            <button class="button is-small" @click="requestNotifications">Request notification permissions</button>
        </div>
    </div>
</template>

<script lang="ts">
import { useStore } from "@/store";
import { defineComponent } from "vue";
import { defaultConfig } from "@/defs";

export default defineComponent({
    name: "ClientSettingsForm",
    title: "Client settings",
    setup() {
        const store = useStore();
        return { store };
    },
    data() {
        return {
            currentConfig: Object.assign({}, defaultConfig),
            updateConfig: Object.assign({}, defaultConfig),
        };
    },
    created() {
        const crConf = Object.assign({}, defaultConfig);

        const currentConfig = localStorage.getItem("twitchautomator_config") ? JSON.parse(localStorage.getItem("twitchautomator_config") as string) : crConf;

        this.updateConfig = currentConfig;
        this.currentConfig = currentConfig;
    },
    methods: {
        saveClientConfig() {
            localStorage.setItem("twitchautomator_config", JSON.stringify(this.updateConfig));
            if (this.currentConfig.enableNotifications !== this.updateConfig.enableNotifications && this.updateConfig.enableNotifications) {
                this.requestNotifications();
            }
            this.store.updateClientConfig(this.updateConfig);
            alert("Settings saved, reloading...");
            window.location.reload();
        },
        requestNotifications() {
            if (!("Notification" in window)) {
                alert("This browser does not support desktop notification");
            } else if (Notification.permission === "granted") {
                // const notification = new Notification("Notifications already granted.");
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
