<template>
    <div class="top-tabs">
        <router-link
            v-if="store.authElement"
            :to="{ name: 'SettingsChannels' }"
        >
            <span class="icon"><fa icon="user" /></span> {{ t('pages.channels') }}
        </router-link>
        <router-link
            v-if="store.authElement"
            :to="{ name: 'SettingsAddChannel' }"
        >
            <span class="icon"><fa icon="user-plus" /></span> {{ t('pages.new-channel') }}
        </router-link>
        <router-link
            v-if="store.authElement"
            :to="{ name: 'SettingsConfig' }"
        >
            <span class="icon"><fa icon="cog" /></span> {{ t('pages.config') }}
        </router-link>
        <router-link
            v-if="store.authElement"
            :to="{ name: 'SettingsKeyvalue' }"
        >
            <span class="icon"><fa icon="database" /></span> {{ t('pages.keyvalue') }}
        </router-link>
        <router-link
            v-if="store.authElement"
            :to="{ name: 'SettingsNotifications' }"
        >
            <span class="icon"><fa icon="bell" /></span> {{ t('pages.notifications') }}
        </router-link>
        <router-link
            v-if="store.authElement"
            :to="{ name: 'SettingsFavourites' }"
        >
            <span class="icon"><fa icon="star" /></span> {{ t('pages.favourite-games') }}
        </router-link>
        <router-link :to="{ name: 'SettingsClientSettings' }">
            <span class="icon"><fa icon="user-cog" /></span> {{ t('pages.client-settings') }}
        </router-link>
    </div>

    <div class="container">
        <router-view />
    </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";

import { library } from "@fortawesome/fontawesome-svg-core";
import { faUser, faUserPlus, faCalendarCheck, faStar, faBell, faUserCog, faDatabase } from "@fortawesome/free-solid-svg-icons";
import { useStore } from "@/store";
import { useI18n } from "vue-i18n";

library.add(faUser, faUserPlus, faCalendarCheck, faStar, faBell, faUserCog, faDatabase);

export default defineComponent({
    name: "SettingsView",
    setup() {
        const store = useStore();
        const { t } = useI18n();
        return { store, t };
    },
    title() {
        if (this.$route.params.tab) {
            return `Settings (${this.$route.params.tab})`;
        }
        return `Settings`;
    },
    data(): {
        loading: boolean;
    } {
        return {
            loading: false,
        };
    },
    computed: {
        /*
        sortedGames() {
            return Object.entries((this as any).games).sort(([, a], [, b]) => (a as any).name.localeCompare((b as any).name));
        },
        */
    },
});
</script>
