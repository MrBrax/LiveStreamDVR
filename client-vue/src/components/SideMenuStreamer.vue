<template>
    <div
        :class="{
            'top-menu-item': true,
            'is-live': streamer.is_live,
            'is-animated': store.clientCfg('animationsEnabled'),
            'is-active': $route.query.channel == streamer.login,
            'is-converting': streamer.is_converting,
            'no-capture': streamer.no_capture,
            streamer: true,
        }"
        :data-streamer="streamer.login"
        v-if="streamer"
    >
        <router-link
            :to="store.clientCfg('singlePage') ? { name: 'Dashboard', query: { channel: streamer.login } } : { name: 'Dashboard', hash: '#streamer_' + streamer.login }"
            class="streamer-link"
        >
            <span class="avatar" @click.prevent="streamer && store.fetchAndUpdateStreamer(streamer.login)" aria-label="Streamer Avatar">
                <img :src="avatarUrl" :alt="streamer.login" />
            </span>
            <span class="username">
                {{ streamer.display_name }}
                <template v-if="streamer.login.toLowerCase() != streamer.display_name.toLowerCase()"> ({{ streamer.login }})</template>
            </span>
            <span
                class="vodcount"
                :data-count="streamer.vods_list.length"
                title="VOD count"
                :aria-valuenow="streamer.vods_list.length"
            >{{ streamer.vods_list.length }}</span>
            <span class="subtitle">
                <template v-if="streamer.is_live">
                    <template v-if="streamer.current_game && streamer.current_game.name != ''">
                        {{ gameVerb }}
                        <strong>{{ streamer.current_game.name }}</strong>
                    </template>
                    <template v-else>Streaming</template>
                    for
                    <duration-display
                        :startDate="streamer.current_vod?.current_chapter?.started_at"
                        :outputStyle="store.clientCfg('useRelativeTime') ? 'human' : 'numbers'"
                    ></duration-display>
                    (<duration-display
                        :startDate="streamer.current_vod?.started_at"
                        :outputStyle="store.clientCfg('useRelativeTime') ? 'human' : 'numbers'"
                    ></duration-display
                    >)
                </template>
                <template v-else-if="streamer.is_converting"> Converting... </template>
                <template v-else>
                    <!-- Offline -->
                </template>
            </span>
        </router-link>
        <div class="streamer-expand-container">
            <button
                class="streamer-expand-main"
                v-if="!store.clientCfg('expandVodList') && streamer.vods_list.length > store.clientCfg('vodsToShowInMenu', 4)"
                @click="toggleExpand"
                title="Click to toggle VOD list"
            >
                <transition><span class="amount" v-if="!expanded">{{ streamer.vods_list.length - store.clientCfg('vodsToShowInMenu', 4) }}</span></transition>
                <fa :icon="expanded ? 'chevron-up' : 'chevron-down'" />
            </button>
        </div>
    </div>

    <div class="top-menu-item streamer-jumpto" v-if="streamer">
        <transition-group name="list" tag="ul" v-if="streamer.vods_list.length > 0">
            <!--<li v-if="!expanded && !store.clientCfg('expandVodList') && streamer.vods_list.length > store.clientCfg('vodsToShowInMenu', 4)" class="streamer-expand-hide"></li>-->
            <li v-for="vod in filteredVodsList" :key="vod.basename">
                <router-link
                    :to="
                        store.clientCfg('singlePage')
                            ? { name: 'Dashboard', query: { channel: streamer.login }, hash: '#vod_' + vod.basename }
                            : { name: 'Dashboard', hash: '#vod_' + vod.basename }
                    "
                    :class="{
                        'is-favourite': vod.hasFavouriteGame(),
                        'is-live': vod.is_capturing,
                        'is-animated': store.clientCfg('animationsEnabled'),
                        'is-converting': vod.is_converting,
                        'is-waiting': !vod.is_capturing && !vod.is_converting && !vod.is_finalized,
                        'streamer-jumpto-vod': true,
                    }"
                    :title="vod.started_at ? formatDate(vod.started_at) : 'Unknown'"
                    v-if="streamer"
                >
                    <!-- capturing -->
                    <span class="icon" v-if="vod.is_capturing"><fa icon="sync" spin></fa></span>

                    <!-- converting -->
                    <span class="icon" v-else-if="vod.is_converting"><fa icon="cog" spin></fa></span>

                    <!-- favourite -->
                    <span class="icon" v-else-if="vod.hasFavouriteGame()"><fa icon="star"></fa></span>

                    <span class="icon is-error" v-else-if="vod.failed"><fa icon="exclamation-triangle" /></span>

                    <!-- waiting after capture -->
                    <span class="icon" v-else-if="!vod.is_capturing && !vod.is_converting && !vod.is_finalized"><fa :icon="['far', 'hourglass']"></fa></span>

                    <!-- video -->
                    <span class="icon" v-else-if="vod.is_finalized"><fa :icon="fileIcon(vod)"></fa></span>

                    <!-- started at -->

                    <!-- absolute time -->
                    <span v-if="!store.clientCfg('useRelativeTime') && vod.started_at">{{ formatDate(vod.started_at) }}</span>

                    <!-- relative time -->
                    <span v-if="store.clientCfg('useRelativeTime') && vod.started_at">{{ humanDate(vod.started_at, true) }}</span>

                    <!-- when capturing -->
                    <template v-if="vod.is_capturing">
                        <span>
                            &middot; (<duration-display
                                :startDate="streamer.current_vod?.started_at"
                                :outputStyle="store.clientCfg('useRelativeTime') ? 'human' : 'numbers'"
                            ></duration-display
                            >)</span
                        ><!-- duration -->
                        <span v-if="vod.getRecordingSize()"> &middot; {{ formatBytes(vod.getRecordingSize() || 0, 2) }}+</span
                        ><!-- filesize -->
                    </template>

                    <!-- when not capturing -->
                    <template v-else>
                        <!-- duration -->
                        <span v-if="vod.duration">
                            &middot; ({{ store.clientCfg('useRelativeTime') ? niceDuration(vod.duration) : humanDuration(vod.duration) }})
                        </span>

                        <!-- filesize -->
                        <span v-if="vod.total_size"> &middot; {{ formatBytes(vod.total_size, 2) }}</span>
                    </template>

                    <!-- flags -->
                    <template v-if="vod.is_finalized">
                        <span class="flags">
                            <span v-if="vod.twitch_vod_exists === false" class="icon is-error" title="Deleted"><fa icon="trash"></fa></span
                            ><!-- vod deleted -->
                            <span v-if="vod.twitch_vod_exists === true && isRiskOfBeingDeleted(vod)" class="icon is-warning" title="Is risking deletion">
                                <fa icon="trash-arrow-up"></fa></span
                            ><!-- vod deleted -->
                            <span v-if="vod.twitch_vod_exists === null" class="icon is-error" title="Not checked"><fa icon="question"></fa></span
                            ><!-- vod not checked -->
                            <span v-if="vod.twitch_vod_muted === MuteStatus.MUTED" class="icon is-error" title="Muted"><fa icon="volume-mute"></fa></span
                            ><!-- vod muted -->
                            <span v-if="vod.is_capture_paused" class="icon is-error" title="Paused"><fa icon="pause"></fa></span
                            ><!-- capturing paused -->
                            <span v-if="vod.prevent_deletion" class="icon is-success" title="Preventing deletion"><fa icon="lock"></fa></span>
                            <!-- prevent deletion -->
                        </span>
                    </template>

                    <!-- tooltip -->
                    <div :class="{ tooltip: true, 'is-static': store.clientCfg('tooltipStatic') }">
                        <div class="stream-channel">
                            {{ streamer.display_name }}
                            <template v-if="streamer.login.toLowerCase() != streamer.display_name.toLowerCase()"> ({{ streamer.login }})</template>
                        </div>
                        <div class="stream-name">{{ vod.basename }}</div>
                        <div class="boxart-carousel is-small">
                            <div
                                v-for="game in vod.getUniqueGames()"
                                :key="game.name"
                                :class="{ 'boxart-item': true, 'is-favourite': store.config && store.favourite_games.includes(game.id) }"
                            >
                                <img v-if="game.box_art_url" :title="game.name" :alt="game.name" :src="game.getBoxArtUrl(140, 190)" loading="lazy" />
                                <span class="boxart-name">{{ game.name }}</span>
                            </div>
                        </div>
                        <div class="stream-title">{{ vod.stream_title }}</div>
                    </div>
                </router-link>
            </li>
        </transition-group>
    </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";

import DurationDisplay from "@/components/DurationDisplay.vue";

import { library } from "@fortawesome/fontawesome-svg-core";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { faFilm, faHeadphones, faTachometerAlt, faWrench, faCog, faUserCog, faInfoCircle, faStar, faSync, faTrashArrowUp, faChevronDown, faChevronUp, faLock } from "@fortawesome/free-solid-svg-icons";
import { faHourglass } from "@fortawesome/free-regular-svg-icons";
import { useStore } from "@/store";
library.add(faGithub, faFilm, faHeadphones, faTachometerAlt, faWrench, faCog, faUserCog, faInfoCircle, faStar, faSync, faHourglass, faTrashArrowUp, faChevronDown, faChevronUp, faLock);

import { MuteStatus, nonGameCategories, TwitchVodAge } from "../../../common/Defs";
import TwitchChannel from "@/core/channel";
import TwitchVOD from "@/core/vod";

export default defineComponent({
    name: "SideMenuStreamer",
    props: {
        streamer: {
            type: Object as () => TwitchChannel,
        },
    },
    data() {
        return {
            expanded: false,
        };
    },
    setup() {
        const store = useStore();
        return { store, nonGameCategories, MuteStatus };
    },
    components: {
        DurationDisplay,
    },
    methods: {
        isRiskOfBeingDeleted(vod: TwitchVOD) {
            if (!vod.started_at) return false;

            const channel = vod.getChannel();
            if (channel) {
                if (channel.broadcaster_type === "partner") return false; // partner vods are never deleted, i think?
            }

            // 14 days minus 2 days for some slack
            const maxVodAge = TwitchVodAge - 2 * 24 * 60 * 60 * 1000;

            // if the vod is older than 12 days, it is considered risky
            return Date.now() - vod.started_at.getTime() >= maxVodAge;
        },
        toggleExpand() {
            this.expanded = !this.expanded;
        },
        fileIcon(vod: TwitchVOD): string {
            if (!this.streamer) return "";
            if (vod.video_metadata?.type === "audio") return "headphones";
            return "film";
        }
    },
    computed: {
        filteredVodsList(): TwitchVOD[] {
            if (!this.streamer) return [];
            if (this.expanded || this.store.clientCfg('expandVodList')) return this.streamer.vods_list;
            const vodsToShow = this.store.clientCfg('vodsToShowInMenu', 4);
            if (vodsToShow === 0) return [];
            // return last 4 vods
            return this.streamer.vods_list.slice(-vodsToShow);
        },
        avatarUrl() {
            if (!this.streamer) return;
            if (this.streamer.channel_data?.cache_avatar) return `${this.store.cfg<string>("basepath", "")}/cache/avatars/${this.streamer.channel_data.cache_avatar}`;
            return this.streamer.profile_image_url;
        },
        gameVerb(): string {
            if (!this.streamer) return "";
            if (!this.streamer.current_game) return "";
            if (nonGameCategories.includes(this.streamer.current_game.name)) return "Streaming";
            if (this.streamer.current_game.name === "Among Us") return "Sussing"; // lol
            return "Playing";
        }
    }
});
</script>
