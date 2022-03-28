<template v-for="streamer in store.streamerList" :key="streamer.username">
    <div
        :class="{
            'top-menu-item': true,
            'is-live': streamer.is_live,
            'is-animated': store.clientConfig?.animationsEnabled,
            'is-active': $route.query.channel == streamer.login,
            'is-converting': streamer.is_converting,
            streamer: true,
        }"
        :data-streamer="streamer.login"
        v-if="streamer"
    >
        <router-link :to="store.clientConfig?.singlePage ? { path: 'dashboard', query: { channel: streamer.login } } : '#streamer_' + streamer.login">
            <span class="avatar" @click.prevent="streamer && store.updateStreamer(streamer.login)">
                <img :src="streamer.profile_image_url" :alt="streamer.login" />
            </span>
            <span class="username">
                {{ streamer.display_name }}
                <template v-if="streamer.login.toLowerCase() != streamer.display_name.toLowerCase()"> ({{ streamer.login }})</template>
            </span>
            <span class="vodcount">{{ streamer.vods_list.length }}</span>
            <span class="subtitle">
                <template v-if="streamer.is_live">
                    <template v-if="streamer.current_game && nonGameCategories.includes(streamer.current_game.game_name)">
                        Streaming <strong>{{ streamer.current_game.game_name }}</strong>
                    </template>
                    <template v-else-if="streamer.current_game && streamer.current_game.game_name != ''">
                        Playing
                        <strong>{{ streamer.current_game.game_name }}</strong>
                    </template>
                    <template v-else>Streaming</template>
                    for
                    <duration-display
                        :startDate="streamer.current_vod?.started_at"
                        :outputStyle="store.clientConfig?.useRelativeTime ? 'human' : 'numbers'"
                    ></duration-display>
                </template>
                <template v-else-if="streamer.is_converting"> Converting... </template>
                <template v-else>
                    <!-- Offline -->
                </template>
            </span>
        </router-link>
    </div>

    <div class="top-menu-item streamer-jumpto" v-if="streamer">
        <ul>
            <li v-for="vod in streamer.vods_list" :key="vod.basename">
                <router-link
                    :to="
                        store.clientConfig?.singlePage
                            ? { path: 'dashboard', query: { channel: streamer.login }, hash: '#vod_' + vod.basename }
                            : '#vod_' + vod.basename
                    "
                    :class="{
                        'is-favourite': vod.api_hasFavouriteGame,
                        'is-live': vod.is_capturing,
                        'is-animated': store.clientConfig?.animationsEnabled,
                        'is-converting': vod.is_converting,
                        'is-waiting': !vod.is_capturing && !vod.is_converting && !vod.is_finalized,
                    }"
                    :title="formatDate(vod.started_at)"
                    v-if="streamer"
                >
                    <!-- capturing -->
                    <span class="icon" v-if="vod.is_capturing"><fa icon="sync" spin></fa></span>

                    <!-- converting -->
                    <span class="icon" v-else-if="vod.is_converting"><fa icon="cog" spin></fa></span>

                    <!-- favourite -->
                    <span class="icon" v-else-if="vod.api_hasFavouriteGame"><fa icon="star"></fa></span>

                    <!-- waiting after capture -->
                    <span class="icon" v-else-if="!vod.is_capturing && !vod.is_converting && !vod.is_finalized"><fa :icon="['far', 'hourglass']"></fa></span>

                    <!-- video -->
                    <span class="icon" v-else-if="vod.is_finalized"><fa icon="film"></fa></span>

                    <!-- started at -->

                    <!-- absolute time -->
                    <span v-if="!store.clientConfig?.useRelativeTime && vod.started_at">{{ formatDate(vod.started_at) }}</span>

                    <!-- relative time -->
                    <span v-if="store.clientConfig?.useRelativeTime && vod.started_at">{{ humanDate(vod.started_at, true) }}</span>

                    <!-- when capturing -->
                    <template v-if="vod.is_capturing">
                        <span>
                            &middot; (<duration-display
                                :startDate="streamer.current_vod?.started_at"
                                :outputStyle="store.clientConfig?.useRelativeTime ? 'human' : 'numbers'"
                            ></duration-display
                            >)</span
                        ><!-- duration -->
                        <span v-if="vod.api_getRecordingSize"> &middot; {{ formatBytes(vod.api_getRecordingSize, 2) }}+</span
                        ><!-- filesize -->
                    </template>

                    <!-- when not capturing -->
                    <template v-else>
                        <!-- duration -->
                        <span v-if="vod.duration">
                            &middot; ({{ store.clientConfig?.useRelativeTime ? niceDuration(vod.duration) : humanDuration(vod.duration) }})
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
                        </span>
                    </template>

                    <!-- tooltip -->
                    <div :class="{ tooltip: true, 'is-static': store.clientConfig?.tooltipStatic }">
                        <div class="stream-channel">
                            {{ streamer.display_name }}
                            <template v-if="streamer.login.toLowerCase() != streamer.display_name.toLowerCase()"> ({{ streamer.login }})</template>
                        </div>
                        <div class="stream-name">{{ vod.basename }}</div>
                        <div class="boxart-carousel is-small">
                            <div
                                v-for="game in vod.api_getUniqueGames"
                                :key="game.name"
                                :class="{ 'boxart-item': true, 'is-favourite': store.config && store.favourite_games.includes(game.id) }"
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
import { faFilm, faTachometerAlt, faWrench, faCog, faUserCog, faInfoCircle, faStar, faSync, faTrashArrowUp } from "@fortawesome/free-solid-svg-icons";
import { faHourglass } from "@fortawesome/free-regular-svg-icons";
import { useStore } from "@/store";
import { ApiChannel, ApiVod } from "../../../common/Api/Client";
library.add(faGithub, faFilm, faTachometerAlt, faWrench, faCog, faUserCog, faInfoCircle, faStar, faSync, faHourglass, faTrashArrowUp);

import { MuteStatus, nonGameCategories } from "../../../common/Defs";

export default defineComponent({
    name: "SideMenuStreamer",
    props: {
        streamer: {
            type: Object as () => ApiChannel,
        },
    },
    setup() {
        const store = useStore();
        return { store, nonGameCategories, MuteStatus };
    },
    components: {
        DurationDisplay,
    },
    methods: {
        isRiskOfBeingDeleted(vod: ApiVod) {
            // 12 days
            const maxVodAge = 12 * 24 * 60 * 60 * 1000;

            // if the vod is older than 12 days, it is considered risky
            const vod_date = new Date(vod.started_at);
            return Date.now() - vod_date.getTime() >= maxVodAge;
        },
    },
});
</script>
