<template>
    <div class="top-tabs">
        <router-link
            v-if="store.authElement"
            :to="{ name: 'SettingsChannels' }"
        >
            <span class="icon"><font-awesome-icon icon="user" /></span> {{ t('pages.channels') }}
        </router-link>
        <router-link
            v-if="store.authElement"
            :to="{ name: 'SettingsAddChannel' }"
        >
            <span class="icon"><font-awesome-icon icon="user-plus" /></span> {{ t('pages.new-channel') }}
        </router-link>
        <router-link
            v-if="store.authElement"
            :to="{ name: 'SettingsConfig' }"
        >
            <span class="icon"><font-awesome-icon icon="cog" /></span> {{ t('pages.config') }}
        </router-link>
        <router-link
            v-if="store.authElement"
            :to="{ name: 'SettingsKeyvalue' }"
        >
            <span class="icon"><font-awesome-icon icon="database" /></span> {{ t('pages.keyvalue') }}
        </router-link>
        <router-link
            v-if="store.authElement"
            :to="{ name: 'SettingsNotifications' }"
        >
            <span class="icon"><font-awesome-icon icon="bell" /></span> {{ t('pages.notifications') }}
        </router-link>
        <router-link
            v-if="store.authElement"
            :to="{ name: 'SettingsFavourites' }"
        >
            <span class="icon"><font-awesome-icon icon="star" /></span> {{ t('pages.favourite-games') }}
        </router-link>
        <router-link :to="{ name: 'SettingsClientSettings' }">
            <span class="icon"><font-awesome-icon icon="user-cog" /></span> {{ t('pages.client-settings') }}
        </router-link>
    </div>

    <div class="container">
        <router-view />
    </div>
</template>

<script lang="ts" setup>
import { library } from "@fortawesome/fontawesome-svg-core";
import { faUser, faUserPlus, faCalendarCheck, faStar, faBell, faUserCog, faDatabase } from "@fortawesome/free-solid-svg-icons";
import { useStore } from "@/store";
import { useI18n } from "vue-i18n";
library.add(faUser, faUserPlus, faCalendarCheck, faStar, faBell, faUserCog, faDatabase);

const store = useStore();
const { t } = useI18n();

// title() {
//     if (this.$route.params.tab) {
//         return `Settings (${this.$route.params.tab})`;
//     }
//     return `Settings`;
// },

// const loading = ref(false);

</script>
