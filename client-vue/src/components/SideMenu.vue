<template>
    <div class="side-menu">
        <div class="menu-top">
            <div class="top-menu-item title" v-if="store.config">
                <router-link to="/dashboard" class="link">
                    <img src="../assets/logo.png" class="favicon" width="24" height="24" :alt="store.cfg('app_name', 'TA') ?? 'TA'" aria-hidden="true">
                    <span class="title" :title="verboseClientVersion">
                        <span>{{ store.app_name }}</span> <span>{{ store.version }}</span>/<span :class="{ dev: isDev }">{{ clientVersion }}</span>
                        <span class="debug-mode" v-if="store.cfg('debug')" title="Debug">👽</span>
                    </span>
                </router-link>
            </div>
        </div>

        <div class="menu-middle" v-if="store.streamerList && store.streamerList.length > 0">
            <side-menu-streamer v-for="streamer in sortedStreamers" :key="streamer.login" v-bind:streamer="streamer" ref="streamer"></side-menu-streamer>
        </div>

        <!-- what was the point of this divider? -->
        <!--<div class="top-menu-item divider"></div>-->

        <div class="menu-auth" v-if="store.authentication && !store.authenticated">
            <form @submit.prevent="login">
                <div class="field">
                    <div class="control">
                        <input type="password" class="input is-small" v-model="password" placeholder="Password">
                    </div>
                </div>
                <div class="field">
                    <div class="control">
                        <button class="button is-small is-confirm" type="submit" :disabled="!password">
                            <span class="icon"><fa icon="sign-in-alt"></fa></span>
                            <span>Login</span>
                        </button>
                    </div>
                </div>
            </form>
        </div>

        <div class="menu-bottom">
            <div :class="{ 'top-menu-item': true, icon: true, right: true, 'is-active': $route.name == 'Dashboard' }" data-menuitem="dashboard">
                <router-link to="/dashboard" :title="$t('pages.dashboard')" class="link">
                    <span class="icon"><fa icon="tachometer-alt"></fa></span>
                </router-link>
            </div>
            <div :class="{ 'top-menu-item': true, icon: true, right: true, 'is-active': $route.name == 'Files' }" data-menuitem="files" v-if="store.authElement">
                <router-link to="/files" :title="$t('pages.files')" class="link">
                    <span class="icon"><fa icon="archive"></fa></span>
                </router-link>
            </div>
            <div :class="{ 'top-menu-item': true, icon: true, right: true, 'is-active': $route.name == 'Tools' }" data-menuitem="tools" v-if="store.authElement">
                <router-link to="/tools" :title="$t('pages.tools')" class="link">
                    <span class="icon"><fa icon="wrench"></fa></span>
                </router-link>
            </div>
            <div :class="{ 'top-menu-item': true, icon: true, right: true, 'is-active': $route.name == 'Settings' }" data-menuitem="settings">
                <router-link to="/settings" :title="$t('pages.settings')" class="link">
                    <span class="icon"><fa icon="cog"></fa></span>
                </router-link>
            </div>
            <div :class="{ 'top-menu-item': true, icon: true, right: true, 'is-active': $route.name == 'About' }" data-menuitem="github" v-if="store.authElement">
                <router-link to="/about" :title="$t('pages.about')" class="link">
                    <span class="icon"><fa icon="info-circle"></fa></span>
                </router-link>
            </div>
            <div class="top-menu-item icon right" data-menuitem="github">
                <a class="linkback link" :href="homepageLink" target="_blank" rel="noreferrer" title="GitHub">
                    <span class="icon"><fa :icon="['fab', 'github']"></fa></span>
                </a>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { DefineComponent, defineComponent } from "vue";
import pack from "../../package.json";

import { library } from "@fortawesome/fontawesome-svg-core";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { faFilm, faTachometerAlt, faWrench, faCog, faUserCog, faInfoCircle, faStar, faSync, faArchive, faSignInAlt } from "@fortawesome/free-solid-svg-icons";
import { faHourglass } from "@fortawesome/free-regular-svg-icons";
import SideMenuStreamer from "./SideMenuStreamer.vue";

import { useStore } from "@/store";
import TwitchChannel from "@/core/channel";

library.add(faGithub, faFilm, faTachometerAlt, faWrench, faCog, faUserCog, faInfoCircle, faStar, faSync, faHourglass, faArchive, faSignInAlt);

export default defineComponent({
    components: { SideMenuStreamer },
    name: "SideMenu",
    setup() {
        const store = useStore();
        return { store };
    },
    data() {
        return {
            password: "",
            expandAll: false,
            keySub: () => {},
        };
    },
    mounted() {
        this.keySub = this.store.$onAction(({ name, args }) => {
            if (name !== "keyEvent") return;
            const key = args[0];
            if (key == "m") {
                // i don't like this solution, not sure if i'm just having a brain fart
                if (this.$refs.streamer) {
                    this.expandAll = !this.expandAll;
                    (this.$refs.streamer as any).forEach((element: DefineComponent) => {
                        element.expanded = this.expandAll;
                    });
                }
            }
        });
    },
    unmounted() {
        this.keySub();
    },
    methods: {
        login() {
            this.store.login(this.password).then((status) => {
                if (status) location.reload();
            });
            this.password = "";
        },
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
        isDev() {
            return import.meta.env.DEV; // injected
        }
    },
});
</script>
