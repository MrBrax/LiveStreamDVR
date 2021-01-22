<template>
    <div class="container">
        <!-- streamers -->
        <section class="section">
            <div class="section-title"><h1>Streamers</h1></div>
            <div class="section-content">
                <div class="card" v-for="streamer in formStreamers" :key="streamer.username">
                    <div class="card-title">
                        <h2>{{ streamer.username }}</h2>
                    </div>
                    <div class="card-content">
                        <streamer-update-form :streamer="streamer" @formSuccess="fetchData" />
                    </div>
                </div>
            </div>
        </section>

        <!-- new streamer -->
        <section class="section">
            <div class="section-title"><h1>New streamer</h1></div>
            <div class="section-content">
                <streamer-add-form @formSuccess="fetchData" />
            </div>
        </section>

        <!-- settings -->
        <section class="section">
            <div class="section-title"><h1>Settings</h1></div>
            <div class="section-content">
                <settings-form :settingsData="settingsData" :settingsFields="settingsFields" @formSuccess="fetchData" />
            </div>
        </section>

        <!-- favourites -->
        <section class="section">
            <div class="section-title"><h1>Favourite games</h1></div>
            <div class="section-content">
                <favourites-form :favouritesData="favouritesData" :gamesData="gamesData" @formSuccess="fetchData" />
            </div>
        </section>
    </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
// import HelloWorld from "@/components/HelloWorld.vue"; // @ is an alias to /src

import StreamerAddForm from "@/components/forms/StreamerAddForm.vue";
import StreamerUpdateForm from "@/components/forms/StreamerUpdateForm.vue";
import SettingsForm from "@/components/forms/SettingsForm.vue";
import FavouritesForm from "@/components/forms/FavouritesForm.vue";

import type { ApiSettingsField, ApiGame } from "@/twitchautomator.d";

export default defineComponent({
    name: "Settings",
    title: "Settings",
    data() {
        return {
            settingsData: [],
            settingsFields: Array as () => ApiSettingsField[],
            gamesData: Array as () => ApiGame[],
            favouritesData: {},
            formStreamers: {},
            // games: Object as () => [key: string]: ApiGame
        };
    },
    created() {
        this.fetchData();
    },
    methods: {
        fetchData() {
            // this.settingsData = [];
            // this.settingsFields = [] as any;

            this.$http
                .get(`api/v0/settings/list`)
                .then((response) => {
                    const json = response.data;
                    if (json.message) alert(json.message);
                    console.log(json);

                    const config = json.data.config;
                    const favourites = config.favourites;
                    const streamers = config.streamers;

                    this.favouritesData = favourites;
                    // this.gamesData = games;

                    this.formStreamers = streamers;

                    this.settingsData = config;
                    this.settingsFields = json.data.fields;
                })
                .catch((err) => {
                    console.error("settings fetch error", err.response);
                });
            /*
            fetch(`api/v0/settings/list`)
            .then((response) => response.json())
            .then((json) => {

                const config = json.data.config;
                const favourites = config.favourites;
                const streamers = config.streamers;

                this.favouritesData = favourites;
                // this.gamesData = games;

                this.formStreamers = streamers;

                this.settingsData = config;
                this.settingsFields = json.data.fields;

            });
            */

            this.$http
                .get(`api/v0/games/list`)
                .then((response) => {
                    const json = response.data;
                    if (json.message) alert(json.message);
                    console.log(json);
                    const games = json.data;
                    this.gamesData = games;
                })
                .catch((err) => {
                    console.error("settings fetch error", err.response);
                });

            /*
            fetch(`api/v0/games/list`)
            .then((response) => response.json())
            .then((json) => {
                const games = json.data;
                this.gamesData = games;
            });
            */
        },
    },
    computed: {
        sortedGames() {
            return Object.entries((this as any).games).sort(([, a], [, b]) => (a as any).name.localeCompare((b as any).name));
        },
    },
    components: {
        StreamerAddForm,
        StreamerUpdateForm,
        SettingsForm,
        FavouritesForm,
    },
});
</script>
