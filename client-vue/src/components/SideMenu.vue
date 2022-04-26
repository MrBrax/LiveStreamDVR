<template>
    <div class="side-menu">
        <div class="menu-top">
            <div class="top-menu-item title" v-if="store.config">
                <router-link to="/dashboard">
                    <img src="../assets/logo.png" class="favicon" width="24" height="24" :alt="store.cfg('app_name', 'TA') ?? 'TA'" />
                    <span class="title" :title="verboseClientVersion">
                        {{ store.app_name }} {{ store.version }}/{{ clientVersion }}
                        <span class="debug-mode" v-if="store.cfg('debug')" title="Debug">👽</span>
                    </span>
                </router-link>
            </div>
        </div>

        <div class="menu-middle" v-if="$route.name == 'Dashboard' && store.streamerList && store.streamerList.length > 0">
            <side-menu-streamer v-for="streamer in sortedStreamers" :key="streamer.login" v-bind:streamer="streamer"></side-menu-streamer>
        </div>

        <div class="top-menu-item divider"></div>

        <div class="menu-bottom">
            <div :class="{ 'top-menu-item': true, icon: true, right: true, 'is-active': $route.name == 'Dashboard' }" data-menuitem="dashboard">
                <router-link to="/dashboard" title="Dashboard">
                    <span class="icon"><fa icon="tachometer-alt"></fa></span>
                </router-link>
            </div>
            <div :class="{ 'top-menu-item': true, icon: true, right: true, 'is-active': $route.name == 'Tools' }" data-menuitem="tools">
                <router-link to="/tools" title="Tools">
                    <span class="icon"><fa icon="wrench"></fa></span>
                </router-link>
            </div>
            <div :class="{ 'top-menu-item': true, icon: true, right: true, 'is-active': $route.name == 'Settings' }" data-menuitem="settings">
                <router-link to="/settings" title="Settings">
                    <span class="icon"><fa icon="cog"></fa></span>
                </router-link>
            </div>
            <div :class="{ 'top-menu-item': true, icon: true, right: true, 'is-active': $route.name == 'ClientSettings' }" data-menuitem="clientsettings">
                <router-link to="/clientsettings" title="Client Settings">
                    <span class="icon"><fa icon="user-cog"></fa></span>
                </router-link>
            </div>
            <div :class="{ 'top-menu-item': true, icon: true, right: true, 'is-active': $route.name == 'About' }" data-menuitem="github">
                <router-link to="/about" title="About">
                    <span class="icon"><fa icon="info-circle"></fa></span>
                </router-link>
            </div>
            <div class="top-menu-item icon right" data-menuitem="github">
                <a class="linkback" :href="homepageLink" target="_blank" rel="noreferrer" title="GitHub">
                    <span class="icon"><fa :icon="['fab', 'github']"></fa></span>
                </a>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import pack from "../../package.json";

import { library } from "@fortawesome/fontawesome-svg-core";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { faFilm, faTachometerAlt, faWrench, faCog, faUserCog, faInfoCircle, faStar, faSync } from "@fortawesome/free-solid-svg-icons";
import { faHourglass } from "@fortawesome/free-regular-svg-icons";
import SideMenuStreamer from "./SideMenuStreamer.vue";

import { useStore } from "@/store";
import TwitchChannel from "@/core/channel";

library.add(faGithub, faFilm, faTachometerAlt, faWrench, faCog, faUserCog, faInfoCircle, faStar, faSync, faHourglass);

export default defineComponent({
    components: { SideMenuStreamer },
    name: "SideMenu",
    setup() {
        const store = useStore();
        return { store };
    },
    computed: {
        sortedStreamers(): TwitchChannel[] {
            const streamers = [...this.store.streamerList];
            return streamers.sort((a, b) => a.display_name.localeCompare(b.display_name));
        },
        clientVersion() {
            return import.meta.env.VITE_APP_VERSION; // injected
        },
        verboseClientVersion() {
            return `${import.meta.env.VITE_APP_VERSION} (${import.meta.env.VITE_APP_BUILDDATE} / ${import.meta.env.VITE_APP_GIT_HASH})`; // injected
        },
        homepageLink() {
            return pack.homepage;
        },
    },
});
</script>
