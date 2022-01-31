<template>
    <div class="splitter">
        <side-menu />
        <div class="content">
            <div v-if="errors" class="big-error">
                <div v-for="error in errors" :key="error" class="big-error-item">Error</div>
            </div>
            <router-view v-if="store.config !== null && store.config.favourites !== null" />
            <div v-else>
                <div class="container">
                    <section class="section">
                        <div class="section-content">
                            <span class="icon"><fa icon="sync" spin></fa></span> Loading...
                        </div>
                    </section>
                </div>
            </div>
        </div>
    </div>
</template>

<style lang="scss"></style>

<script lang="ts">
import { defineComponent } from "vue";

import SideMenu from "@/components/SideMenu.vue";
import { useStore } from "./store";

export default defineComponent({
    name: "App",
    setup() {
        const store = useStore();
        return { store };
    },
    data() {
        return {
            errors: [],
        };
    },
    created() {
        this.fetchData();
    },
    methods: {
        async fetchData() {
            // client config
            const currentClientConfig = localStorage.getItem("twitchautomator_config")
                ? JSON.parse(localStorage.getItem("twitchautomator_config") as string)
                : {};
            this.store.updateClientConfig(currentClientConfig);

            // clear config
            this.store.updateConfig(null);

            let response;

            try {
                response = await this.$http.get(`/api/v0/settings`);
            } catch (error) {
                alert(error);
                return;
            }

            if (response.status !== 200) {
                alert("Non-200 response from server");
                return;
            }

            if (!response.data || !response.data.data) {
                alert("No data received");
                return;
            }

            this.store.updateConfig(response.data.data.config);
            this.store.updateVersion(response.data.data.version);
        },
    },
    components: {
        SideMenu,
    },
});
</script>
