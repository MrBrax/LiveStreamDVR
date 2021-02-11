<template v-for="streamer in $store.state.streamerList" :key="streamer.username">
    <div
        :class="{
            'top-menu-item': true,
            'is-live': streamer.is_live,
            'is-animated': $store.state.clientConfig.animationsEnabled,
            'is-active': $route.query.channel == streamer.display_name,
            streamer: true,
        }"
        :data-streamer="streamer.display_name"
    >
        <router-link
            :to="$store.state.clientConfig.singlePage ? { path: 'dashboard', query: { channel: streamer.display_name } } : '#streamer_' + streamer.display_name"
        >
            <span class="avatar"><img :src="streamer.profile_image_url" :alt="streamer.display_name" /></span>
            <span class="username">{{ streamer.display_name }}</span>
            <span class="vodcount">{{ streamer.vods_list.length }}</span>
            <span class="subtitle">
                <template v-if="streamer.is_live">
                    <template
                        v-if="
                            streamer.current_game &&
                            (streamer.current_game.game_name == 'Just Chatting' ||
                                streamer.current_game.game_name == 'IRL' ||
                                streamer.current_game.game_name == 'Art')
                        "
                    >
                        <strong>{{ streamer.current_game.game_name }}</strong>
                    </template>
                    <template v-else>
                        Playing <strong>{{ streamer.current_game ? streamer.current_game.game_name : "(none)" }}</strong>
                    </template>
                    for
                    <duration-display
                        :startDate="streamer.current_vod.dt_started_at.date"
                        :outputStyle="$store.state.clientConfig.useRelativeTime ? 'human' : 'numbers'"
                    ></duration-display>
                </template>
                <template v-else-if="streamer.is_converting"> Converting... </template>
                <template v-else>
                    <!-- Offline -->
                </template>
            </span>
        </router-link>
    </div>

    <div class="top-menu-item streamer-jumpto">
        <ul>
            <li v-for="vod in streamer.vods_list" :key="vod.basename">
                <router-link
                    :to="
                        $store.state.clientConfig.singlePage
                            ? { path: 'dashboard', query: { channel: streamer.display_name }, hash: '#vod_' + vod.basename }
                            : '#vod_' + vod.basename
                    "
                    :class="{
                        'is-favourite': vod.api_hasFavouriteGame,
                        'is-live': vod.is_capturing,
                        'is-animated': $store.state.clientConfig.animationsEnabled,
                        'is-converting': vod.is_converting,
                        'is-waiting': !vod.is_capturing && !vod.is_converting && !vod.is_finalized,
                    }"
                    :title="formatDate(vod.dt_started_at.date)"
                >
                    <!-- main icon -->
                    <span class="icon" v-if="vod.is_capturing"><fa icon="sync" spin></fa></span><!-- capturing -->
                    <span class="icon" v-else-if="vod.is_converting"><fa icon="cog" spin></fa></span><!-- converting -->
                    <span class="icon" v-else-if="vod.api_hasFavouriteGame"><fa icon="star"></fa></span><!-- favourite -->
                    <span class="icon" v-else-if="!vod.is_capturing && !vod.is_converting && !vod.is_finalized"><fa :icon="['far', 'hourglass']"></fa></span> <!-- waiting after capture -->
                    <span class="icon" v-else-if="vod.is_finalized"><fa icon="film"></fa></span><!-- video -->

                    <!-- started at -->
                    <span v-if="!$store.state.clientConfig.useRelativeTime && vod.dt_started_at">{{ formatDate(vod.dt_started_at.date) }}</span><!-- absolute time -->
                    <span v-if="$store.state.clientConfig.useRelativeTime && vod.dt_started_at">{{ humanDate(vod.dt_started_at.date, true) }}</span><!-- relative time -->

                    <!-- when capturing -->
                    <template v-if="vod.is_capturing">
                        <span> &middot; (<duration-display :startDate="streamer.current_vod.dt_started_at.date" :outputStyle="$store.state.clientConfig.useRelativeTime ? 'human' : 'numbers'"></duration-display>)</span><!-- duration -->
                        <span v-if="vod.api_getRecordingSize"> &middot; {{ formatBytes(vod.api_getRecordingSize, 2) }}+</span><!-- filesize -->
                    </template>

                    <!-- when not capturing -->
                    <template v-else>
                        <span v-if="vod.duration_seconds"> &middot; ({{ $store.state.clientConfig.useRelativeTime ? niceDuration(vod.duration_seconds) : humanDuration(vod.duration_seconds) }})</span><!-- duration -->
                        <span v-if="vod.total_size"> &middot; {{ formatBytes(vod.total_size, 2) }}</span><!-- filesize -->
                    </template>

                    <!-- flags -->
                    <template v-if="vod.is_finalized">
                        <span class="flags">
                            <span v-if="vod.twitch_vod_exists === false" class="icon is-error" title="Deleted"><fa icon="trash"></fa></span><!-- vod deleted -->
                            <span v-if="vod.twitch_vod_exists === null" class="icon is-error" title="Not checked"><fa icon="question"></fa></span><!-- vod not checked -->
                            <span v-if="vod.twitch_vod_muted === true" class="icon is-error" title="Muted"><fa icon="volume-mute"></fa></span><!-- vod muted -->
                            <span v-if="vod.is_capture_paused" class="icon is-error" title="Paused"><fa icon="pause"></fa></span><!-- capturing paused -->
                        </span>
                    </template>

                    <!-- tooltip -->
                    <div :class="{ tooltip: true, 'is-static': $store.state.clientConfig.tooltipStatic }">
                        <div class="stream-channel">{{ streamer.display_name }}</div>
                        <div class="stream-name">{{ vod.basename }}</div>
                        <div class="boxart-carousel is-small">
                            <div
                                v-for="game in vod.api_getUniqueGames"
                                :key="game.name"
                                :class="{ 'boxart-item': true, 'is-favourite': $store.state.config.favourites[game.id] }"
                            >
                                <img v-if="game.image_url" :title="game.name" :alt="game.name" :src="game.image_url" loading="lazy" />
                                <span class="boxart-name">{{ game.name }}</span>
                            </div>
                        </div>
                        <div class="stream-title">{{ vod.stream_title }}</div>
                    </div>
                </router-link>
            </li>
        </ul>
    </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";

import DurationDisplay from "@/components/DurationDisplay.vue";

import { library } from "@fortawesome/fontawesome-svg-core";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { faFilm, faTachometerAlt, faWrench, faCog, faUserCog, faInfoCircle, faStar, faSync } from "@fortawesome/free-solid-svg-icons";
import { faHourglass } from "@fortawesome/free-regular-svg-icons";
library.add(faGithub, faFilm, faTachometerAlt, faWrench, faCog, faUserCog, faInfoCircle, faStar, faSync, faHourglass);

export default defineComponent({
    name: "SideMenuStreamer",
    props: ["streamer"],
    components: {
        DurationDisplay,
    },
});
</script>
