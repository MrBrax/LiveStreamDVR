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
                <router-link
                    v-if="streamer"
                    :to="
                        store.clientCfg('singlePage')
                            ? { name: 'Dashboard', query: { channel: streamer.uuid }, hash: '#vod_' + vod.uuid }
                            : { name: 'Dashboard', hash: '#vod_' + vod.uuid }
                    "
                    :class="{
                        'is-active': store.visibleVod == vod.basename,
                        'is-favourite': isTwitchVOD(vod) ? vod.hasFavouriteGame() : false,
                        'is-live': vod.is_capturing,
                        'is-animated': store.clientCfg('animationsEnabled'),
                        'is-converting': vod.is_converting,
                        'is-waiting': !vod.is_capturing && !vod.is_converting && !vod.is_finalized,
                        'streamer-jumpto-vod': true,
                    }"
                    :title="vod.started_at ? formatDate(vod.started_at) : 'Unknown'"
                >
                    <!-- capturing -->
                    <span
                        v-if="vod.is_capturing"
                        class="icon"
                    ><fa
                        icon="sync"
                        spin
                    /></span>

                    <!-- converting -->
                    <span
                        v-else-if="vod.is_converting"
                        class="icon"
                    ><fa
                        icon="cog"
                        spin
                    /></span>

                    <!-- favourite -->
                    <span
                        v-else-if="isTwitchVOD(vod) && vod.hasFavouriteGame()"
                        class="icon"
                    ><fa icon="star" /></span>

                    <span
                        v-else-if="vod.failed"
                        class="icon is-error"
                    ><fa icon="exclamation-triangle" /></span>

                    <!-- waiting after capture -->
                    <span
                        v-else-if="!vod.is_capturing && !vod.is_converting && !vod.is_finalized"
                        class="icon"
                    ><fa :icon="['far', 'hourglass']" /></span>

                    <!-- video -->
                    <span
                        v-else-if="vod.is_finalized"
                        class="icon"
                    ><fa :icon="fileIcon(vod)" /></span>

                    <!-- basename -->
                    <span v-if="store.sidemenuShow.vod_basename">{{ vod.basename }}</span>

                    <!-- SxE -->
                    <span
                        v-if="store.sidemenuShow.vod_sxe"
                        class="sxe"
                    >
                        S{{ vod.stream_season }}E{{ vod.stream_number }}
                    </span>

                    <!-- SxE absolute -->
                    <span
                        v-if="store.sidemenuShow.vod_sxe_absolute"
                        class="sxe"
                    >
                        S{{ vod.stream_absolute_season }}E{{ vod.stream_number }}
                    </span>

                    <!-- started at -->
                    <!-- absolute time -->
                    <span v-if="!store.clientCfg('useRelativeTime') && vod.started_at && store.sidemenuShow.vod_date">{{ formatDate(vod.started_at) }}</span>

                    <!-- relative time -->
                    <span v-if="store.clientCfg('useRelativeTime') && vod.started_at && store.sidemenuShow.vod_date">{{ humanDate(vod.started_at, true) }}</span>

                    <!-- when capturing -->
                    <template v-if="vod.is_capturing">
                        <span
                            v-if="store.sidemenuShow.vod_duration"
                            class="duration"
                        >
                            (<duration-display
                                :start-date="streamer.current_vod?.started_at"
                                :output-style="store.clientCfg('useRelativeTime') ? 'human' : 'numbers'"
                            />)
                        </span><!-- duration -->
                        <span
                            v-if="vod.getRecordingSize() && store.sidemenuShow.vod_size"
                            class="size"
                        > {{ formatBytes(vod.getRecordingSize() || 0, 2) }}+</span><!-- filesize -->
                    </template>

                    <!-- when not capturing -->
                    <template v-else>
                        <!-- duration -->
                        <span
                            v-if="vod.duration && store.sidemenuShow.vod_duration"
                            class="duration"
                        >
                            ({{ store.clientCfg('useRelativeTime') ? niceDuration(vod.duration) : humanDuration(vod.duration) }})
                        </span>

                        <!-- filesize -->
                        <span
                            v-if="vod.total_size && store.sidemenuShow.vod_size"
                            class="size"
                        >{{ formatBytes(vod.total_size, 2) }}</span>
                    </template>

                    <!-- flags -->
                    <template v-if="vod.is_finalized">
                        <span class="flags">
                            <span
                                v-if="isTwitchVOD(vod) && vod.twitch_vod_exists === false"
                                class="icon is-error"
                                title="Deleted from provider"
                            ><fa icon="trash" /></span><!-- vod deleted -->
                            <span
                                v-if="isTwitchVOD(vod) && vod.twitch_vod_exists === true && isRiskOfBeingDeleted(vod)"
                                class="icon is-warning"
                                title="Is risking deletion from provider"
                            >
                                <fa icon="trash-arrow-up" />
                            </span><!-- vod deleted -->
                            <span
                                v-if="isTwitchVOD(vod) && vod.twitch_vod_exists === null"
                                class="icon is-error"
                                title="Not checked"
                            ><fa icon="question" /></span><!-- vod not checked -->
                            <span
                                v-if="isTwitchVOD(vod) && vod.twitch_vod_muted === MuteStatus.MUTED"
                                class="icon is-error"
                                title="Muted"
                            ><fa icon="volume-mute" /></span><!-- vod muted -->
                            <span
                                v-if="vod.is_capture_paused"
                                class="icon is-error"
                                title="Paused"
                            ><fa icon="pause" /></span><!-- capturing paused -->
                            <span
                                v-if="vod.prevent_deletion"
                                class="icon is-success"
                                title="Preventing deletion"
                            ><fa icon="lock" /></span><!-- prevent deletion -->
                            <span
                                v-if="vod.hasDeletedSegment"
                                class="icon is-error"
                                title="Deleted segment"
                            ><fa icon="film" /></span><!-- deleted segment -->
                            <span
                                v-if="vod.comment"
                                class="icon is-success"
                                title="Has comment"
                            ><fa icon="comment" /></span><!-- has comment -->
                        </span>
                    </template>

                    <!-- tooltip -->
                    <div :class="{ tooltip: true, 'is-static': store.clientCfg('tooltipStatic') }">
                        <div class="stream-channel">
                            {{ streamer.display_name }}
                            <template v-if="streamer.login.toLowerCase() != streamer.display_name.toLowerCase()">
                                ({{ streamer.login }})
                            </template>
                        </div>
                        <div class="stream-name">
                            {{ vod.basename }}
                        </div>
                        <div
                            v-if="isTwitchVOD(vod)"
                            class="boxart-carousel is-small"
                        >
                            <div
                                v-for="game in vod.getUniqueGames()"
                                :key="game.name"
                                :class="{ 'boxart-item': true, 'is-favourite': store.config && store.favourite_games.includes(game.id) }"
                            >
                                <img
                                    v-if="game.box_art_url"
                                    :title="game.name"
                                    :alt="game.name"
                                    :src="game.getBoxArtUrl(140, 190)"
                                    loading="lazy"
                                >
                                <span class="boxart-name">{{ game.name }}</span>
                            </div>
                        </div>
                        <div class="stream-title">
                            {{ isTwitchVOD(vod) ? vod.stream_title : "" }}
                        </div>
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
        fileIcon(vod: VODTypes): string {
            if (!this.streamer) return "";
            if (vod.video_metadata?.type === "audio") return "headphones";
            return "film";
        }
    }
});
</script>

<style lang="scss" scoped>
.streamer-jumpto-vod {
    .size {
        &::before {
            // &middot;
            content: " • ";
            font-size: 0.7em;
        }
    }
    .duration {
        &::before {
            // &middot;
            content: " • ";
            font-size: 0.7em;
        }
    }
}
</style>