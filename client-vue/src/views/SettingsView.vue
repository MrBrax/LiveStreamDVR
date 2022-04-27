<template>
    <div class="top-tabs">
        <router-link :to="{ name: 'Settings', params: { tab: 'channels' } }">
            <span class="icon"><fa icon="user"></fa></span> Channels
        </router-link>
        <router-link :to="{ name: 'Settings', params: { tab: 'newchannel' } }">
            <span class="icon"><fa icon="user-plus"></fa></span> New channel
        </router-link>
        <router-link :to="{ name: 'Settings', params: { tab: 'config' } }">
            <span class="icon"><fa icon="cog"></fa></span> Config
        </router-link>
        <router-link :to="{ name: 'Settings', params: { tab: 'notifications' } }">
            <span class="icon"><fa icon="bell"></fa></span> Notifications
        </router-link>
        <router-link :to="{ name: 'Settings', params: { tab: 'favourites' } }">
            <span class="icon"><fa icon="star"></fa></span> Favourites
        </router-link>
    </div>

    <div class="container">
        <!-- channels -->
        <section class="section" v-if="!$route.params.tab || $route.params.tab == 'channels'">
            <div class="section-title"><h1>Channels</h1></div>
            <div class="section-content">
                <div class="card" v-for="channel in formChannels" :key="channel.login">
                    <div class="card-title">
                        <h2>{{ channel.login }}</h2>
                    </div>
                    <div class="card-content">
                        <channel-update-form :channel="channel" @formSuccess="fetchData" />
                    </div>
                </div>
                <span v-if="!formChannels || formChannels.length == 0">No channels added. Use the tab "New channel" above.</span>
            </div>
        </section>

        <!-- new channel -->
        <section class="section" v-if="$route.params.tab == 'newchannel'">
            <div class="section-title"><h1>New channel</h1></div>
            <div class="section-content">
                <channel-add-form @formSuccess="fetchData" />
            </div>
        </section>

        <!-- settings -->
        <section class="section" v-if="$route.params.tab == 'config'">
            <div class="section-title"><h1>Config</h1></div>
            <div class="section-content" v-if="!loading">
                <settings-form />
            </div>
            <div class="section-content" v-else>
                <span class="icon"><fa icon="sync" spin></fa></span> Loading...
            </div>
        </section>

        <!-- notifications -->
        <section class="section" v-if="$route.params.tab == 'notifications'">
            <div class="section-title"><h1>Notifications</h1></div>
            <div class="section-content">
                <notifications-form @formSuccess="fetchData" />
            </div>
        </section>

        <!-- favourites -->
        <section class="section" v-if="$route.params.tab == 'favourites'">
            <div class="section-title"><h1>Favourite games</h1></div>
            <div class="section-content" v-if="!loading">
                <favourites-form :favouritesData="favouritesData" :gamesData="gamesData" @formSuccess="fetchData" />
            </div>
            <div class="section-content" v-else>
                <span class="icon"><fa icon="sync" spin></fa></span> Loading...
            </div>
        </section>
    </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";

import ChannelAddForm from "@/components/forms/ChannelAddForm.vue";
import ChannelUpdateForm from "@/components/forms/ChannelUpdateForm.vue";
import SettingsForm from "@/components/forms/SettingsForm.vue";
import FavouritesForm from "@/components/forms/FavouritesForm.vue";
import NotificationsForm from "@/components/forms/NotificationsForm.vue";

import type { ApiGame, ApiChannelConfig } from "@common/Api/Client";
import type { ApiSettingsResponse, ApiGamesResponse } from "@common/Api/Api";

import { library } from "@fortawesome/fontawesome-svg-core";
import { faUser, faCalendarCheck, faStar, faBell } from "@fortawesome/free-solid-svg-icons";
import { useStore } from "@/store";
import { SettingField } from "@common/Config";
library.add(faUser, faCalendarCheck, faStar, faBell);

export default defineComponent({
    name: "SettingsView",
    setup() {
        const store = useStore();
        return { store };
    },
    title() {
        return `Settings`;
    },
    data(): {
        loading: boolean;
        formChannels: ApiChannelConfig[];
        settingsData: Record<string, string | number | boolean>;
        settingsFields: SettingField<string | number | boolean>[];
        favouritesData: string[];
        gamesData: Record<string, ApiGame>;
    } {
        return {
            loading: false,
            settingsData: {},
            settingsFields: [],
            gamesData: {},
            favouritesData: [],
            formChannels: [],
            // games: Object as () => [key: string]: ApiGame
        };
    },
    created() {
        this.fetchData();
    },
    methods: {
        fetchData() {
            console.debug("Fetching settings and games data");
            this.loading = true;
            this.$http
                .all([
                    this.$http
                        .get(`api/v0/settings`)
                        .then((response) => {
                            const json: ApiSettingsResponse = response.data;
                            if (json.message) alert(json.message);
                            console.log("settings list", json);

                            const config = json.data.config;
                            const channels: ApiChannelConfig[] = json.data.channels;
                            const favourites = json.data.favourite_games;

                            this.favouritesData = favourites;
                            // this.gamesData = games;

                            this.formChannels = channels.sort((a, b) => a.login.localeCompare(b.login));
                            console.log("formChannels", this.formChannels);

                            this.settingsData = config;
                            this.settingsFields = json.data.fields;
                        })
                        .catch((err) => {
                            console.error("settings fetch error", err.response);
                        }),

                    this.$http
                        .get(`api/v0/games`)
                        .then((response) => {
                            const json: ApiGamesResponse = response.data;
                            if (json.message) alert(json.message);
                            console.log("games list", json);
                            const games = json.data;
                            this.gamesData = games;
                        })
                        .catch((err) => {
                            console.error("settings fetch error", err.response);
                        }),
                ])
                .then(() => {
                    this.loading = false;
                });
        },
    },
    computed: {
        /*
        sortedGames() {
            return Object.entries((this as any).games).sort(([, a], [, b]) => (a as any).name.localeCompare((b as any).name));
        },
        */
    },
    components: {
        ChannelAddForm,
        ChannelUpdateForm,
        SettingsForm,
        FavouritesForm,
        NotificationsForm,
    },
});
</script>
