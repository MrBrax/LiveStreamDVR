<template>
    <div
        v-if="streamer"
        :class="{
            'top-menu-item': true,
            'is-live': streamer.is_live,
            'is-capturing': streamer.is_capturing,
            'is-animated': store.clientCfg('animationsEnabled'),
            'is-active': route.query.channel == streamer.login,
            'is-converting': streamer.is_converting,
            'no-capture': streamer.no_capture,
            streamer: true,
        }"
        :data-streamer="streamer.login"
    >
        <!-- :style="{
            'background-image': 'url(' + bannerUrl + ')',
        }"
    -->
        <router-link
            :to="store.clientCfg('singlePage') ? { name: 'Dashboard', query: { channel: streamer.uuid } } : { name: 'Dashboard', hash: '#streamer_' + streamer.uuid }"
            class="streamer-link"
        >
            <span
                class="avatar is-desktop"
                aria-label="Streamer Avatar"
                @click.prevent="streamer && store.fetchAndUpdateStreamer(streamer.uuid)"
            >
                <img
                    :src="avatarUrl"
                    :alt="streamer.internalName"
                >
            </span>
            <!-- TODO: find another way to disable click on mobile -->
            <span
                class="avatar is-mobile"
                aria-label="Streamer Avatar"
            >
                <img
                    :src="avatarUrl"
                    :alt="streamer.internalName"
                >
            </span>
            <span class="username">
                {{ streamer.displayName }}
                <template v-if="streamer.internalName.toLowerCase() != streamer.displayName.toLowerCase()"> ({{ streamer.internalName }})</template>
            </span>
            <span
                class="vodcount"
                :data-count="streamer.vods_list.length"
                title="VOD count"
            >{{ streamer.vods_list.length }}</span>
            <span class="subtitle">
                <template v-if="streamer.is_live && streamer.is_capturing">
                    <template v-if="isTwitch(streamer) && streamer.current_game && streamer.current_game.name != ''">
                        {{ gameVerb }}
                        <strong :class="{ 'is-spoiler': store.clientCfg('hideChapterTitlesAndGames') }">{{ streamer.current_game.name }}</strong>
                    </template>
                    <template v-else>Streaming</template>
                    for
                    <duration-display
                        v-if="streamer"
                        :start-date="streamer.current_vod?.current_chapter?.started_at"
                        :output-style="store.clientCfg('useRelativeTime') ? 'human' : 'numbers'"
                    />
                    (<duration-display
                        v-if="streamer"
                        :start-date="streamer.current_vod?.started_at"
                        :output-style="store.clientCfg('useRelativeTime') ? 'human' : 'numbers'"
                    />)
                </template>
                <template v-else-if="streamer.is_converting"> Converting... </template>
                <template v-else-if="streamer.chapter_data && store.clientCfg('showOfflineCategoryInSidebar')">
                    <span
                        :title="streamer.chapter_data.title"
                        :class="{ 'is-spoiler': store.clientCfg('hideChapterTitlesAndGames') }"
                    >
                        <span class="icon is-small"><fa
                            icon="bed"
                            title="Offline category"
                        /></span> {{ isTwitch(streamer) ? streamer.chapter_data.game_name : "" }} @ {{ formatLogicalDate(streamer.chapter_data.started_at) }}
                    </span>
                </template>
                <template v-else>
                    <!-- Offline -->
                </template>
            </span>
        </router-link>
        <div class="streamer-expand-container">
            <button
                v-if="!store.clientCfg('expandVodList') && streamer.vods_list.length > store.clientCfg('vodsToShowInMenu', 4)"
                class="streamer-expand-main"
                title="Click to toggle VOD list"
                @click="toggleExpand"
            >
                <transition>
                    <span
                        v-if="!expanded"
                        class="amount"
                    >{{ streamer.vods_list.length - store.clientCfg('vodsToShowInMenu', 4) }}</span>
                </transition>
                <font-awesome-icon :icon="expanded ? 'chevron-up' : 'chevron-down'" />
            </button>
        </div>
    </div>

    <div
        v-if="streamer"
        class="top-menu-item streamer-jumpto"
    >
        <transition-group
            v-if="streamer.vods_list.length > 0"
            name="list"
            tag="ul"
        >
            <!--<li v-if="!expanded && !store.clientCfg('expandVodList') && streamer.vods_list.length > store.clientCfg('vodsToShowInMenu', 4)" class="streamer-expand-hide"></li>-->
            <li
                v-for="vod in filteredVodsList"
                :key="vod.basename"
            >
                <side-menu-streamer-vod
                    :streamer="streamer"
                    :vod="vod"
                />
            </li>
        </transition-group>
    </div>
</template>

<script lang="ts" setup>
import { computed, ref } from "vue";

import DurationDisplay from "@/components/DurationDisplay.vue";
import SideMenuStreamerVod from "./SideMenuStreamerVod.vue";

import { library } from "@fortawesome/fontawesome-svg-core";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { faFilm, faHeadphones, faTachometerAlt, faWrench, faCog, faUserCog, faInfoCircle, faStar, faSync, faTrashArrowUp, faChevronDown, faChevronUp, faLock, faGamepad, faBed, faComment } from "@fortawesome/free-solid-svg-icons";
import { faHourglass } from "@fortawesome/free-regular-svg-icons";
import { useStore } from "@/store";
import { nonGameCategories } from "../../../common/Defs";
import { isTwitch } from "@/mixins/newhelpers";
import { useRoute } from "vue-router";
import { formatLogicalDate } from "@/mixins/newhelpers";
import type { ChannelTypes, VODTypes } from "@/twitchautomator";
library.add(faGithub, faFilm, faHeadphones, faTachometerAlt, faWrench, faCog, faUserCog, faInfoCircle, faStar, faSync, faHourglass, faTrashArrowUp, faChevronDown, faChevronUp, faLock, faGamepad, faBed, faComment);


const store = useStore();
const route = useRoute();
const props = defineProps<{
    streamer: ChannelTypes;
}>();

const expanded = ref(false);
    
const filteredVodsList = computed((): VODTypes[] => {
    if (!props.streamer) return [];
    if (expanded.value || store.clientCfg('expandVodList')) return props.streamer.vods_list;
    const vodsToShow = store.clientCfg('vodsToShowInMenu', 4);
    if (vodsToShow === 0) return [];
    // return last 4 vods
    return props.streamer.vods_list.slice(-vodsToShow);
});

const avatarUrl = computed((): string => {
    if (!props.streamer) return "";
    // if (props.streamer.channel_data?.cache_avatar) return `${store.cfg<string>("basepath", "")}/cache/avatars/${props.streamer.channel_data.cache_avatar}`;
    // return props.streamer.profile_image_url;
    return props.streamer.profilePictureUrl;
});

const bannerUrl = computed((): string => {
    if (!props.streamer || !isTwitch(props.streamer)) return "";
    if (props.streamer.channel_data?.cache_offline_image) return `${store.cfg<string>("basepath", "")}/cache/banners/${props.streamer.channel_data.cache_offline_image}`;
    return props.streamer.offline_image_url;
});

const gameVerb = computed((): string => {
    if (!props.streamer || !isTwitch(props.streamer)) return "";
    if (!props.streamer.current_game) return "";
    if (nonGameCategories.includes(props.streamer.current_game.name)) return "Streaming";
    if (props.streamer.current_game.name === "Among Us") return "Sussing"; // lol
    return "Playing";
});
    
function toggleExpand() {
    expanded.value = !expanded.value;
}

</script>

<style lang="scss" scoped>
@import "../assets/_variables";

.top-menu-item {

    font-size: 1.2em;

    /**
    * Side menu channel with avatar, name, and status
    */
    &.streamer {

        display: flex;

        /*
        a {
            padding: 5px 8px 12px 8px;
        }
        */
        a {
            color: #777;
            text-decoration: none;
            display: inline-block;
            padding: 5px 8px;
        }

        flex-direction: row;

        // background-size: cover;
        // background-position: center;
        // background-repeat: no-repeat;

        .streamer-link {
            flex-grow: 1;
            // backdrop-filter: blur(5px) brightness(0.2);
        }

        &:hover {
            .avatar {
                transform: scale(110%);
            }

            .username {
                color: #fff;
            }

            background-color: #111;

            .subtitle {
                color: #868686;
            }
        }

        &.is-live {
            a {
                background-color: #0e361e;
            }

            .username {
                color: #1dd14a;
                font-weight: 700;
            }

            .subtitle,
            .vodcount {
                color: #0aa44a;
            }

            .streamer-expand-container {
                background-color: #0e361e;

                .streamer-expand-main {
                    color: #23c687;

                    &:hover {
                        background-color: #166c44;
                    }
                }
            }

            // main hover
            .streamer-link:hover {
                background-color: #0e361e;

                .username {
                    color: #fff;
                }

                .subtitle {
                    color: #2c8f64;
                }
            }
        }

        &.is-capturing {
            a {
                background-color: #2b0e0e;
            }

            .username {
                color: #f00;
                font-weight: 700;
            }

            &.is-animated a {
                animation: live ease-in-out 1s infinite;
            }

            .subtitle,
            .vodcount {
                color: #b30000;
            }

            .streamer-expand-container {
                background-color: #2b0e0e;

                .streamer-expand-main {
                    color: #f34d4d;

                    &:hover {
                        background-color: #4d0b0b;
                    }
                }
            }

            // main hover
            .streamer-link:hover {
                background-color: #3b1313;

                .username {
                    color: #ffc555;
                }

                .subtitle {
                    color: #9d8f1a;
                }
            }
        }

        &.is-converting {
            a {
                background-color: darken($converting-base, 30%);
            }

            .username {
                color: lighten($converting-base, 30%);
                font-weight: 700;
            }

            .subtitle,
            .vodcount {
                color: lighten($converting-base, 10%);
            }

            .streamer-expand-container {
                background-color: darken($converting-base, 30%);

                .streamer-expand-main {
                    color: lighten($converting-base, 30%);

                    &:hover {
                        background-color: darken($converting-base, 20%);
                    }
                }
            }

            // main hover
            .streamer-link:hover {
                background-color: darken($converting-base, 25%);

                .username {
                    color: #fff;
                }

                .subtitle {
                    color: lighten($converting-base, 10%);
                }
            }
        }

        &.no-capture {
            .username {
                text-decoration: line-through;
            }

            // &.is-live {
            //     a {
            //         background-color: #0e361e;
            //     }
            // }
        }

        .avatar {
            // height: 100%;
            display: inline-block;
            height: 20px;
            vertical-align: -4px;

            margin-right: 5px;

            overflow: hidden;
            border-radius: 100%;

            transition: ease-in-out 0.2s transform;

            img {
                opacity: 0.7;
                height: 100%;
            }
        }

        .vodcount {
            display: inline-block;
            margin-left: 5px;
            font-size: 90%;
            color: #666;
        }

        .subtitle {
            font-family: "Roboto Condensed", "Roboto", "Arial";
            font-weight: 500;
            display: block;
            font-size: 80%;
            line-height: 1em;
            color: #444;
            padding-bottom: 0.1em;

            &:empty,
            &:-moz-only-whitespace {
                // TODO: multiplatform
                display: none;
            }
        }

        .streamer-expand-container {
            display: flex;
            // center contents
            align-items: center;
            justify-content: center;
            flex-direction: column;
        }

        .streamer-expand-main {
            color: #8096be;
            display: flex;
            flex-grow: 1;

            background-color: transparent;
            border: none;

            // center contents
            align-items: center;
            justify-content: center;
            flex-direction: column;
            padding: 0.2em 0.5em 0em 0.5em;
            line-height: 0.3em;

            cursor: pointer;

            .amount {
                font-size: 80%;
            }

            &:hover {
                background-color: #0c1e35;
                color: #fff;
            }

            transition: 0.1s ease-in-out;

            border-radius: 3px;

            margin: 2px;
        }

        &.no-capture &.is-live {
            .streamer-expand-container {
                background-color: #0e2b14;
            }

            .username {
                color: #15b300;
            }
        }

        .streamer-expand-hide {
            height: 3px;
            // #000 to #09182c
            background-image: linear-gradient(to bottom, darken(#09182c, 5%), #09182c);
            // border-top: 1px dotted #2d5589;
        }

        &.is-active {
            a {
                color: #fff;
            }
        }
    }

    /**
    * Side menu channel vod list
    */
    &.streamer-jumpto {
        .icon {
            margin-right: 0.2em;
        }

        ul {
            list-style: none;
            list-style-type: none;
            margin: 0;
            padding: 0;
        }
    }

}

@media screen and (orientation: portrait) {
    .streamer-jumpto {
        display: none;
    }

    .top-menu-item {
        &.streamer {
            padding: 5px;

            align-content: center;
            justify-content: center;

            &:hover {
                .avatar {
                    border-width: 3px;
                    border-color: #ccc;
                }
            }

            a {
                width: 40px;
                height: 40px;
                padding: 0;
                margin: 0;
                position: relative;
            }

            .avatar {
                height: 40px;
                margin: 0;
                padding: 0;
                border-width: 0px;
                border-style: solid;
                transition: 0.05s all ease-in-out;
            }

            .username {
                display: none;
            }

            .vodcount {
                // transform: translateX(-20px);

                font-size: 0.7em;

                background: #333;
                padding: 1px 3px;
                border-radius: 50%;
                color: #ddd;

                position: relative;
                left: 20px;
                top: -20px;

                /*
				font-size: 85%;
				&:after { content: ' vods'; }
				&:before { content: '· '; }
				*/

                &[data-count="0"] {
                    color: #999;
                }
            }

            .subtitle {
                display: none;
                /*
				display: inline-block;
				font-size: 80%;
				&:before { content: '·'; }
				*/
            }

            &.is-live {
                a {
                    background-color: unset;
                    animation: none;
                }

                .avatar {
                    border-width: 3px;
                    border-color: #f00;
                }

                .vodcount {
                    color: #f00;
                }
            }

            .streamer-expand-container {
                display: none;
            }

        }
    }
}

</style>