<template>
    <div
        v-if="streamer"
        :class="{
            'top-menu-item': true,
            'is-live': streamer.is_live,
            'is-capturing': streamer.is_capturing,
            'is-animated': store.clientCfg('animationsEnabled'),
            'is-active': $route.query.channel == streamer.login,
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
                class="avatar"
                aria-label="Streamer Avatar"
                @click.prevent="streamer && store.fetchAndUpdateStreamer(streamer.uuid)"
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
                        <strong>{{ streamer.current_game.name }}</strong>
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
                    <span :title="streamer.chapter_data.title">
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
                <fa :icon="expanded ? 'chevron-up' : 'chevron-down'" />
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

<script lang="ts">
import { defineComponent } from "vue";

import DurationDisplay from "@/components/DurationDisplay.vue";
import SideMenuStreamerVod from "./SideMenuStreamerVod.vue";

import { library } from "@fortawesome/fontawesome-svg-core";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { faFilm, faHeadphones, faTachometerAlt, faWrench, faCog, faUserCog, faInfoCircle, faStar, faSync, faTrashArrowUp, faChevronDown, faChevronUp, faLock, faGamepad, faBed, faComment } from "@fortawesome/free-solid-svg-icons";
import { faHourglass } from "@fortawesome/free-regular-svg-icons";
import { ChannelTypes, useStore, VODTypes } from "@/store";
library.add(faGithub, faFilm, faHeadphones, faTachometerAlt, faWrench, faCog, faUserCog, faInfoCircle, faStar, faSync, faHourglass, faTrashArrowUp, faChevronDown, faChevronUp, faLock, faGamepad, faBed, faComment);

import { MuteStatus, nonGameCategories, TwitchVodAge } from "../../../common/Defs";
import TwitchVOD from "@/core/Providers/Twitch/TwitchVOD";

export default defineComponent({
    name: "SideMenuStreamer",
    components: {
        DurationDisplay,
        SideMenuStreamerVod,
    },
    props: {
        streamer: {
            type: Object as () => ChannelTypes,
            required: true,
        },
    },
    setup() {
        const store = useStore();
        return { store, nonGameCategories, MuteStatus };
    },
    data() {
        return {
            expanded: false,
            // show: {
            //     vod_date: true,
            //     vod_sxe: false,
            //     vod_sxe_absolute: false,
            //     vod_size: true,
            //     vod_duration: true,
            //     vod_basename: false,
            // }
        };
    },
    computed: {
        filteredVodsList(): VODTypes[] {
            if (!this.streamer) return [];
            if (this.expanded || this.store.clientCfg('expandVodList')) return this.streamer.vods_list;
            const vodsToShow = this.store.clientCfg('vodsToShowInMenu', 4);
            if (vodsToShow === 0) return [];
            // return last 4 vods
            return this.streamer.vods_list.slice(-vodsToShow);
        },
        avatarUrl(): string {
            if (!this.streamer) return "";
            // if (this.streamer.channel_data?.cache_avatar) return `${this.store.cfg<string>("basepath", "")}/cache/avatars/${this.streamer.channel_data.cache_avatar}`;
            // return this.streamer.profile_image_url;
            return this.streamer.profilePictureUrl;
        },
        bannerUrl(): string {
            if (!this.streamer || !this.isTwitch(this.streamer)) return "";
            if (this.streamer.channel_data?.cache_offline_image) return `${this.store.cfg<string>("basepath", "")}/cache/banners/${this.streamer.channel_data.cache_offline_image}`;
            return this.streamer.offline_image_url;
        },
        gameVerb(): string {
            if (!this.streamer || !this.isTwitch(this.streamer)) return "";
            if (!this.streamer.current_game) return "";
            if (nonGameCategories.includes(this.streamer.current_game.name)) return "Streaming";
            if (this.streamer.current_game.name === "Among Us") return "Sussing"; // lol
            return "Playing";
        }
    },
    methods: {
        toggleExpand() {
            this.expanded = !this.expanded;
        },
    }
});
</script>
