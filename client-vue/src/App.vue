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
        <side-menu :streamerList="streamerList" />
        <div class="content">
            <div v-if="errors" class="big-error">
                <div v-for="error in errors" :key="error" class="big-error-item">Error</div>
            </div>
            <router-view />
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
            streamerList: [],
            config: Array as () => ApiConfig[],
            version: null,
            errors: []
        };
    },
    created() {
        this.fetchData();
    },
    methods: {
        fetchData() {
            this.config = [] as any;
            fetch("/api/v0/settings/list")
            .then((response) => response.json())
            .then((json) => {
                this.config = json.data.config;
                this.version = json.data.version;
                console.log("config", this.config);
            });
        },
        onUpdateStreamerList(){
            console.log("UPDATE ME");
        },
        updateStreamerList(){
            console.log("UPDATE ME");
        }
    },
    components: {
        SideMenu
    },
});
</script>
