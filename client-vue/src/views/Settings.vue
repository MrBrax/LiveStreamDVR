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
        <router-link :to="{ name: 'Settings', params: { tab: 'cron' } }">
            <span class="icon"><fa icon="calendar-check"></fa></span> Cron
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
                <div class="card" v-if="!formChannels">No channels added. Use the tab above.</div>
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
                <settings-form :settingsData="settingsData" :settingsFields="settingsFields" @formSuccess="fetchData" />
            </div>
            <div class="section-content" v-else>
                <span class="icon"><fa icon="sync" spin></fa></span> Loading...
            </div>
        </section>

        <!-- cron -->
        <section class="section" v-if="$route.params.tab == 'cron'">
            <div class="section-title"><h1>Cron</h1></div>
            <div class="section-content">
                <span class="input-help"
                    >The Slim framework doesn't have a good way to execute code from the command line, so you'll have to set up cron manually.
                </span>
                <template v-if="$store.state.config.app_url">
                    <code>
                        0 5 * * 1 curl {{ $store.state.config.app_url }}/api/v0/cron/sub<br />
                        0 */12 * * * curl {{ $store.state.config.app_url }}/api/v0/cron/check_muted_vods<br />
                        10 */12 * * * curl {{ $store.state.config.app_url }}/api/v0/cron/check_deleted_vods<br />
                        0 1 * * * curl {{ $store.state.config.app_url }}/api/v0/cron/dump_playlists
                    </code>
                    <span class="input-help">
                        This will subscribe to the webhook every 5 days, check muted &amp; deleted vods every 12 hours, and dump playlists once per day.
                    </span>
                </template>
                <template v-else>
                    <br /><br />
                    <em class="is-error">Can't show example, <strong>app url</strong> has not been set</em>
                </template>
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

import type { ApiSettingsField, ApiGame, ApiChannelConfig } from "@/twitchautomator.d";

import { library } from "@fortawesome/fontawesome-svg-core";
import { faUser, faCalendarCheck } from "@fortawesome/free-solid-svg-icons";
library.add(faUser, faCalendarCheck);

export default defineComponent({
    name: "Settings",
    title() {
        return `Settings`;
    },
    data() {
        return {
            loading: false,
            settingsData: [],
            settingsFields: Array as () => ApiSettingsField[],
            gamesData: Array as () => ApiGame[],
            favouritesData: {},
            formChannels: Array as () => ApiChannelConfig[],
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
            this.loading = true;

            this.$http
                .all([
                    this.$http
                        .get(`api/v0/settings/list`)
                        .then((response) => {
                            const json = response.data;
                            if (json.message) alert(json.message);
                            console.log("settings list", json);

                            const config = json.data.config;
                            const channels = json.data.channels;
                            const favourites = config.favourites;

                            this.favouritesData = favourites;
                            // this.gamesData = games;

                            this.formChannels = channels;
                            console.log("formChannels", this.formChannels);

                            this.settingsData = config;
                            this.settingsFields = json.data.fields;
                        })
                        .catch((err) => {
                            console.error("settings fetch error", err.response);
                        }),

                    this.$http
                        .get(`api/v0/games/list`)
                        .then((response) => {
                            const json = response.data;
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
        sortedGames() {
            return Object.entries((this as any).games).sort(([, a], [, b]) => (a as any).name.localeCompare((b as any).name));
        },
    },
    components: {
        ChannelAddForm,
        ChannelUpdateForm,
        SettingsForm,
        FavouritesForm,
    },
});
</script>
