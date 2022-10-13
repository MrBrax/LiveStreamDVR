<template>
    <div class="side-menu">
        <div class="menu-top">
            <div
                v-if="store.config"
                class="top-menu-item title"
            >
                <router-link
                    to="/dashboard"
                    class="link"
                >
                    <img
                        src="../assets/logo.png"
                        class="favicon"
                        width="24"
                        height="24"
                        :alt="store.cfg('app_name', 'TA') ?? 'TA'"
                        aria-hidden="true"
                    >
                    <span
                        class="title"
                        :title="verboseVersion"
                    >
                        <span>{{ store.app_name }}</span> <span>S{{ store.version }}</span>/<span :class="{ dev: isDev }">C{{ clientVersion }}</span>
                        <span
                            v-if="store.cfg('debug')"
                            class="debug-mode"
                            title="Debug"
                        >👽</span>
                    </span>
                </router-link>
            </div>
        </div>

        <div
            v-if="store.streamerList && store.streamerList.length > 0"
            class="menu-middle"
        >
            <side-menu-streamer
                v-for="streamer in sortedStreamers"
                :key="streamer.login"
                ref="streamer"
                :streamer="streamer"
            />
        </div>

        <!-- what was the point of this divider? -->
        <!--<div class="top-menu-item divider"></div>-->

        <div
            v-if="store.authentication && !store.authenticated"
            class="menu-auth"
        >
            <form @submit.prevent="login">
                <div class="field">
                    <div class="control">
                        <input
                            v-model="password"
                            type="password"
                            class="input is-small"
                            placeholder="Password"
                        >
                    </div>
                </div>
                <div class="field">
                    <div class="control">
                        <button
                            class="button is-small is-confirm"
                            type="submit"
                            :disabled="!password"
                        >
                            <span class="icon"><fa icon="sign-in-alt" /></span>
                            <span>Login</span>
                        </button>
                    </div>
                </div>
            </form>
        </div>

        <div class="menu-bottom">
            <div
                :class="{ 'top-menu-item': true, icon: true, right: true, 'is-active': $route.name == 'Dashboard' }"
                data-menuitem="dashboard"
            >
                <router-link
                    to="/dashboard"
                    :title="$t('pages.dashboard')"
                    class="link"
                >
                    <span class="icon"><fa icon="tachometer-alt" /></span>
                </router-link>
            </div>
            <div
                v-if="store.authElement"
                :class="{ 'top-menu-item': true, icon: true, right: true, 'is-active': $route.name == 'Files' }"
                data-menuitem="files"
            >
                <router-link
                    to="/files"
                    :title="$t('pages.files')"
                    class="link"
                >
                    <span class="icon"><fa icon="archive" /></span>
                </router-link>
            </div>
            <div
                v-if="store.authElement"
                :class="{ 'top-menu-item': true, icon: true, right: true, 'is-active': $route.name == 'Tools' }"
                data-menuitem="tools"
            >
                <router-link
                    to="/tools"
                    :title="$t('pages.tools')"
                    class="link"
                >
                    <span class="icon"><fa icon="wrench" /></span>
                </router-link>
            </div>
            <div
                :class="{ 'top-menu-item': true, icon: true, right: true, 'is-active': $route.name == 'Settings' }"
                data-menuitem="settings"
            >
                <router-link
                    to="/settings"
                    :title="$t('pages.settings')"
                    class="link"
                >
                    <span class="icon"><fa icon="cog" /></span>
                </router-link>
            </div>
            <div
                v-if="store.authElement"
                :class="{ 'top-menu-item': true, icon: true, right: true, 'is-active': $route.name == 'About' }"
                data-menuitem="github"
            >
                <router-link
                    to="/about"
                    :title="$t('pages.about')"
                    class="link"
                >
                    <span class="icon"><fa icon="info-circle" /></span>
                </router-link>
            </div>
            <div
                class="top-menu-item icon right"
                data-menuitem="github"
            >
                <a
                    class="linkback link"
                    :href="homepageLink"
                    target="_blank"
                    rel="noreferrer"
                    title="GitHub"
                >
                    <span class="icon"><fa :icon="['fab', 'github']" /></span>
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

import { ChannelTypes, useStore } from "@/store";

library.add(faGithub, faFilm, faTachometerAlt, faWrench, faCog, faUserCog, faInfoCircle, faStar, faSync, faHourglass, faArchive, faSignInAlt);

export default defineComponent({
    name: "SideMenu",
    components: { SideMenuStreamer },
    setup() {
        const store = useStore();
        return { store };
    },
    data() {
        return {
            password: "",
            expandAll: false,
            keySub: () => { console.log("key"); },
            keyMeme: [] as string[],
        };
    },
    computed: {
        sortedStreamers(): ChannelTypes[] {
            const streamers = [...this.store.streamerList];
            return streamers.sort((a, b) => a.displayName.localeCompare(b.displayName));
        },
        clientVersion() {
            return import.meta.env.VITE_APP_VERSION; // injected
        },
        verboseVersion() {
            return `Server ${this.store.version} (${this.store.serverGitHash})\n` +
            `Client ${import.meta.env.VITE_APP_VERSION} (${import.meta.env.VITE_APP_BUILDDATE} / ${import.meta.env.VITE_APP_GIT_HASH})`; // injected
        },
        homepageLink() {
            return pack.homepage;
        },
        isDev() {
            return import.meta.env.DEV; // injected
        }
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
            /*
            switch (key) {
                case "q":
                    this.$router.push({ name: "Dashboard" });
                    break;
                case "w":
                    this.$router.push({ name: "Files" });
                    break;
                case "e":
                    this.$router.push({ name: "Tools" });
                    break;
                case "r":
                    this.$router.push({ name: "Settings" });
                    break;
                case "t":
                    this.$router.push({ name: "About" });
                    break;
            
                default:
                    break;
                
            }
            */
            this.keyMeme.push(key); if (this.keyMeme.length > 10) this.keyMeme.splice(0, 1);
            if (this.keyMeme.join(" ") == "ArrowUp ArrowUp ArrowDown ArrowDown ArrowLeft ArrowRight ArrowLeft ArrowRight b a") document.location = 'https://youtu.be/dQw4w9WgXcQ';
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
});
</script>

<style lang="scss" scoped>
@import "../assets/_variables";

.side-menu {
    position: fixed;
    z-index: 999;
    top: 0;
    left: 0;
    bottom: 0;
    width: var(--sidemenu-width);

    background-color: #000;
    color: #fff;
    display: flex;
    flex-direction: column;
    // flex-wrap: wrap;
    // overflow-y: auto;

    &.collapsed {
        width: 150px;

        .streamer-jumpto {
            display: none;
        }

        .top-menu-item.title span.title {
            display: none;
        }

        .menu-bottom {
            flex-wrap: wrap;
        }
    }

    &.side {
        // position: static;
        left: 0;
        top: 0;
        bottom: 0;
        right: auto;
        height: 100vh;
        width: 300px;
        display: block;
    }

    .menu-middle {
        overflow-y: scroll;
        flex-grow: 1;
        scrollbar-color: #4a4a4a #222;

        &::-webkit-scrollbar {
            height: 12px;
            width: 12px;
            background: #222;
        }

        &::-webkit-scrollbar-thumb {
            background: #4a4a4a;
            -webkit-border-radius: 1ex;
            -webkit-box-shadow: 0px 1px 2px rgba(0, 0, 0, 0.75);
        }

        &::-webkit-scrollbar-corner {
            background: #4a4a4a;
        }
    }

    .menu-bottom {
        display: flex;
        text-align: center;
        height: 50px;

        .top-menu-item {
            height: 50px;
            flex-grow: 1;

            a {
                width: 100%;
            }
        }

        .router-link-active {
            color: #fff;
        }
    }
}

// TODO: make this more dynamic
.top-menu-item {
    font-size: 1.05rem;

    // padding: 5px 8px;

    display: flex;
    flex-direction: column;
    // justify-content: center;
    // align-items: center;

    &.title {
        font-weight: 700;

        .link {
            color: #fff;
            padding: 13px 8px;
        }

        .favicon {
            transition: ease-in-out 0.5s transform;
        }

        // .favicon { animation: 1s speeen linear; }
        &:hover .favicon {
            animation: 1s speen linear infinite;
        }

        span.dev {
            color: #ff0;
        }
    }

    a.link {
        color: #777;
        text-decoration: none;
        display: inline-block;
        padding: 5px 8px;

        &:hover {
            color: #fff;
            background-color: #111;
        }
    }

    &.divider {
        flex-grow: 1;
    }

    &.right {

        // flex-grow: 1;
        // text-align: right;
        a {
            padding: 14px 8px;
        }
    }

    .small {
        color: #555;
        font-size: 80%;
    }

    &.icon {
        &.is-live:not(.is-active) a {
            color: #ec2f2f;
            // animation: 0.5s vibrate linear infinite;
        }

        a {
            padding-left: 16px;
            padding-right: 16px;
        }
    }

    .favicon {
        width: 24px;
        height: 24px;
        vertical-align: -5px;
        margin: 0 8px 0 3px;
    }

    a.linkback {
        font-weight: 700;
        color: #e0e00d;

        /* forgive me padre for i have sinned */
        &:hover {
            color: #fff;
        }
    }
}

.menu-auth {
    form {
        display: flex;
        padding: 0.2em 1em;
        gap: 0.5em;

        .field:not(:last-child) {
            margin: 0;
        }
    }
}

@media screen and (orientation: portrait) {
    .side-menu {
        width: auto;
        height: auto;
        position: static;
        display: block;

        .menu-middle {
            /*
            position: sticky;
            top: 0px;
            left: 0px;
            right: 0px;
            */
            display: flex;
            flex-wrap: wrap;
            padding: 0 5px 5px 5px;
            overflow: unset;
        }

        .menu-bottom {
            background-color: #000;
            min-height: 50px;
            position: fixed;
            bottom: 0px;
            left: 0px;
            right: 0px;

            .top-menu-item[data-menuitem="github"] {
                display: none;
            }

            .top-menu-item {

                .icon {
                    transition: all 0.1s ease-in-out;
                }

                &.active {
                    a {
                        .icon {
                            transform: scale(120%);
                        }
                    }
                }

            }

        }

    }
}

</style>
