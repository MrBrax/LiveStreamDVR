<template>
    <div class="top-tabs">
        <router-link :to="{ name: 'Settings', params: { tab: 'channels' } }">
            <span class="icon"><fa icon="user"></fa></span> {{ $t('pages.channels') }}
        </router-link>
        <router-link :to="{ name: 'Settings', params: { tab: 'newchannel' } }">
            <span class="icon"><fa icon="user-plus"></fa></span> {{ $t('pages.new-channel') }}
        </router-link>
        <router-link :to="{ name: 'Settings', params: { tab: 'config' } }">
            <span class="icon"><fa icon="cog"></fa></span> {{ $t('pages.config') }}
        </router-link>
        <router-link :to="{ name: 'Settings', params: { tab: 'keyvalue' } }">
            <span class="icon"><fa icon="database"></fa></span> {{ $t('pages.keyvalue') }}
        </router-link>
        <router-link :to="{ name: 'Settings', params: { tab: 'notifications' } }">
            <span class="icon"><fa icon="bell"></fa></span> {{ $t('pages.notifications') }}
        </router-link>
        <router-link :to="{ name: 'Settings', params: { tab: 'favourites' } }">
            <span class="icon"><fa icon="star"></fa></span> {{ $t('pages.favourite-games') }}
        </router-link>
        <router-link :to="{ name: 'Settings', params: { tab: 'clientsettings' } }">
            <span class="icon"><fa icon="user-cog"></fa></span> {{ $t('pages.client-settings') }}
        </router-link>
    </div>

    <div class="container">
        <!-- channels -->
        <section class="section" v-if="!$route.params.tab || $route.params.tab == 'channels'">
            <div class="section-title"><h1>{{ $t('pages.channels') }}</h1></div>
            <div class="section-content">
                <div class="card" v-for="channel in formChannels" :key="channel.login" :id="'channel_' + channel.login">
                    <div class="card-title">
                        <h2>{{ channel.login }}</h2>
                    </div>
                    <div class="card-content">
                        <channel-update-form :channel="channel" @formSuccess="updateAll" />
                    </div>
                </div>
                <span v-if="!formChannels || formChannels.length == 0">No channels added. Use the tab "New channel" above.</span>
            </div>
        </section>

        <!-- new channel -->
        <section class="section" v-if="$route.params.tab == 'newchannel'">
            <div class="section-title"><h1>{{ $t('pages.new-channel') }}</h1></div>
            <div class="section-content">
                <channel-add-form @formSuccess="updateUsers" />
            </div>
        </section>

        <!-- settings -->
        <section class="section" v-if="$route.params.tab == 'config'">
            <div class="section-title"><h1>{{ $t('pages.config') }}</h1></div>
            <div class="section-content" v-if="!loading">
                <settings-form />
            </div>
            <div class="section-content" v-else>
                <span class="icon"><fa icon="sync" spin></fa></span> Loading...
            </div>
        </section>

        <!-- notifications -->
        <section class="section" v-if="$route.params.tab == 'notifications'">
            <div class="section-title"><h1>{{ $t('pages.notifications') }}</h1></div>
            <div class="section-content">
                <notifications-form @formSuccess="fetchData" />
            </div>
        </section>

        <!-- favourites -->
        <section class="section" v-if="$route.params.tab == 'favourites'">
            <div class="section-title"><h1>{{ $t('pages.favourite-games') }}</h1></div>
            <div class="section-content" v-if="!loading">
                <favourites-form />
            </div>
            <div class="section-content" v-else>
                <span class="icon"><fa icon="sync" spin></fa></span> Loading...
            </div>
        </section>

        <!-- client settings -->
        <section class="section" v-if="$route.params.tab == 'clientsettings'">
            <div class="section-title"><h1>{{ $t('pages.client-settings') }}</h1></div>
            <client-settings-form />
        </section>

        <!-- keyvalue -->
        <section class="section" v-if="$route.params.tab == 'keyvalue'">
            <div class="section-title"><h1>{{ $t('pages.keyvalue') }}</h1></div>
            <div class="section-content">
                <key-value-form />
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
import ClientSettingsForm from "@/components/forms/ClientSettingsForm.vue";
import KeyValueForm from "@/components/forms/KeyValueForm.vue";

import type { ApiGame, ApiChannelConfig } from "@common/Api/Client";
import type { ApiSettingsResponse, ApiGamesResponse } from "@common/Api/Api";

import { library } from "@fortawesome/fontawesome-svg-core";
import { faUser, faCalendarCheck, faStar, faBell, faUserCog, faDatabase } from "@fortawesome/free-solid-svg-icons";
import { useStore } from "@/store";

library.add(faUser, faCalendarCheck, faStar, faBell, faUserCog, faDatabase);

export default defineComponent({
    name: "SettingsView",
    setup() {
        const store = useStore();
        return { store };
    },
    title() {
        if (this.$route.params.tab) {
            return `Settings (${this.$route.params.tab})`;
        }
        return `Settings`;
    },
    data(): {
        loading: boolean;
        formChannels: ApiChannelConfig[];
    } {
        return {
            loading: false,
            formChannels: [],
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
                .get(`api/v0/settings`)
                .then((response) => {
                    const json: ApiSettingsResponse = response.data;
                    if (json.message) alert(json.message);
                    const channels: ApiChannelConfig[] = json.data.channels;
                    this.formChannels = channels.sort((a, b) => a.login.localeCompare(b.login));
                })
                .catch((err) => {
                    console.error("settings fetch error", err.response);
                }).finally(() => {
                    this.loading = false;
                });

        },
        updateUsers() {
            this.store.fetchAndUpdateStreamerList();
        },
        updateAll() {
            this.fetchData();
            this.updateUsers();
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
        ClientSettingsForm,
        KeyValueForm,
    },
});
</script>
