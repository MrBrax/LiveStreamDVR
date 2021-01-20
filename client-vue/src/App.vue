<template>
    <!--
    <div id="nav">
        <router-link to="/dashboard">Dashboard</router-link>
        <router-link to="/settings">Settings</router-link>
        <router-link to="/info">Info</router-link>
    </div>
    <router-view />
    -->

    <div class="splitter">
        <side-menu />
        <div class="content">
            <div v-if="errors" class="big-error">
                <div v-for="error in errors" :key="error" class="big-error-item">Error</div>
            </div>
            <router-view v-if="$store.state.config !== undefined && $store.state.config.favourites !== undefined" />
            <div v-else>
                Loading config...
            </div>
        </div>
    </div>

</template>

<style lang="scss"></style>

<script lang="ts">
import { defineComponent } from "vue";

import SideMenu from "@/components/SideMenu.vue";

import type { ApiConfig } from "@/twitchautomator.d";

export default defineComponent({
    name: "App",
    data() {
        return {
            // config: Array as () => ApiConfig[],
            // version: null,
            errors: []
        };
    },
    created() {
        this.fetchData();
    },
    methods: {
        fetchData() {

            // client config
            const currentClientConfig = localStorage.getItem("twitchautomator_config") ? JSON.parse(localStorage.getItem("twitchautomator_config") as string) : {};
            this.$store.commit('updateClientConfig', currentClientConfig);
            
            // clear config
            this.$store.commit('updateConfig', []);

            return this.$http.get(`/api/v0/settings/list`)
            .then((response) => {
                this.$store.commit('updateConfig', response.data.data.config);
                this.$store.commit('updateVersion', response.data.data.version);
            });

        }
    },
    components: {
        SideMenu
    },
});
</script>
