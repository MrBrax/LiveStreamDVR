<template>
    <div class="side-menu">

        <div class="menu-top">
            <div class="top-menu-item title">
                <a href="#">
                    <img src="../assets/logo.png" class="favicon" width="24" height="24" :alt="$store.state.config.app_name">
                    <span class="title">
                        {{ $store.state.config.app_name }} {{ $store.state.version }}
                        <span v-if="$store.state.config.debug">(debug)</span>
                    </span>
                </a>
            </div>
        </div>

        
        <div class="menu-middle" v-if="$route.name == 'Dashboard'">
            
            <!--{% for streamer in streamerList|sort((a, b) => a.display_name > b.display_name) %}-->
            <template v-for="streamer in $store.state.streamerList" :key="streamer.username">

                <div :class="{ 'top-menu-item': true, 'is-live': streamer.is_live, 'streamer': true }" :data-streamer="streamer.display_name">
                    
                    <a :href="'#streamer_' + streamer.display_name">

                        <span class="username">{{ streamer.display_name }}</span>
                        <span class="vodcount">{{ streamer.vods_list.length }}</span>
                        <span class="subtitle">
                            <template v-if="streamer.is_live">
                                
                                <template v-if="streamer.current_game && ( streamer.current_game.game_name == 'Just Chatting' || streamer.current_game.game_name == 'IRL' || streamer.current_game.game_name == 'Art' )">
                                    <strong>{{ streamer.current_game.game_name }}</strong>
                                </template>
                                <template v-else>
                                    Playing <strong>{{ streamer.current_game.game_name }}</strong>
                                </template>

                                for <span id="duration_{{ streamer.display_name }}">{{ humanDuration(streamer.current_vod.duration_live) }}</span>

                            </template>
                            <template v-else-if="streamer.is_converting">
                                Converting...
                            </template>
                            <template v-else>
                                <!-- Offline -->
                            </template>
                        </span>

                    </a>

                </div>
                
                <div class="top-menu-item streamer-jumpto">
                    <ul>
                        <li v-for="vod in streamer.vods_list" :key="vod.basename">
                            <a :href="'#vod_' + vod.basename" :data-basename="vod.basename" :class="{
                                    'is-favourite': vod.hasFavouriteGame,
                                    'is-live': vod.is_capturing,
                                    'is-converting': vod.is_converting,
                                    'is-waiting': !vod.is_capturing && !vod.is_converting && !vod.is_finalized
                                }" :title="vod.dt_started_at.date">
                                <!-- <span class="icon is-active"><i class="fa fa-arrow-circle-right"></i></span> -->
                            
                                <span v-if="vod.is_capturing" class="icon"><i class="fa fa-sync fa-spin"></i></span> <!-- capturing -->
                                <span v-else-if="vod.is_converting" class="icon"><i class="fa fa-cog fa-spin"></i></span> <!-- converting -->
                                <span v-else-if="vod.hasFavouriteGame" class="icon"><i class="fa fa-star"></i></span> <!-- favourite -->
                                <span v-else-if="!vod.is_capturing && !vod.is_converting && !vod.is_finalized" class="icon"><i class="far fa-hourglass"></i></span> <!-- waiting after capture -->
                                <span v-else-if="vod.is_finalized" class="icon"><i class="fa fa-film"></i></span> <!-- video -->

                                <span v-if="!$store.state.config.relative_time && vod.dt_started_at">{{ formatDate(vod.dt_started_at.date) }}</span><!-- absolute time -->
                                <span v-if="$store.state.config.relative_time && vod.dt_started_at">{{ humanDate(vod.dt_started_at.date) }}</span><!-- relative time -->
                                <template v-if="vod.is_capturing">
                                    <span v-if="vod.duration_live">&middot; ({{ $store.state.config.relative_time ? niceDuration(vod.duration_live) : humanDuration(vod.duration_live) }}+)</span><!-- duration -->
                                    <span v-if="vod.getRecordingSize">&middot; {{ formatBytes(vod.getRecordingSize, 2) }}+</span><!-- filesize -->
                                </template>
                                <template v-else>
                                    <span v-if="vod.duration_seconds">&middot; ({{ $store.state.config.relative_time ? niceDuration(vod.duration_seconds) : humanDuration(vod.duration_seconds) }})</span><!-- duration -->
                                    <span v-if="vod.total_size">&middot; {{ formatBytes(vod.total_size, 2) }}</span><!-- filesize -->
                                </template>
                                <template v-if="vod.is_finalized">
                                    <span class="flags">
                                        <span v-if="vod.twitch_vod_exists === false"><span class="icon is-error" title="Deleted"><i class="fa fa-trash"></i></span></span><!-- vod deleted -->
                                        <span v-if="vod.twitch_vod_exists === null"><span class="icon is-error" title="Not checked"><i class="fa fa-question"></i></span></span><!-- vod not checked -->
                                        <span v-if="vod.twitch_vod_muted === true"><span class="icon is-error" title="Muted"><i class="fa fa-volume-mute"></i></span></span><!-- vod muted -->
                                        <span v-if="vod.is_capture_paused"><span class="icon is-error" title="Paused"><i class="fa fa-pause"></i></span></span><!-- capturing paused -->
                                    </span>
                                </template>
                                <div class="tooltip">
                                    <div class="boxart-carousel is-small">
                                        <div v-for="game in vod.getUniqueGames" :key="game.name" class="boxart-item">
                                            <img v-if="game.image_url" :title="game.name" :alt="game.name" :src="game.image_url" loading="lazy" />
                                            <span v-else>{{ game.name }}</span>
                                        </div>
                                    </div>
                                    <p>{{ vod.stream_title }}</p>
                                </div>
                            </a>
                        </li>
                    </ul>
                </div>
                

            </template>
            
        </div>

        <div class="top-menu-item divider"></div>

        <div class="menu-bottom">
            <div :class="{ 'top-menu-item': true, 'icon': true, 'right': true, 'active': $route.name == 'Dashboard' }">
                <router-link to="/dashboard"><i class="fa fa-tachometer-alt"></i></router-link>
            </div>
            <!--
            <div class="top-menu-item icon right">
                <a href="javascript:window.forceRefresh();" title="Refresh"><i class="fa fa-sync"></i></a>
            </div>
            <div class="top-menu-item icon right">
                <a href="javascript:notifyMe();" title="Notify"><i class="fa fa-bell"></i></a>
            </div>
            -->
            <div class="top-menu-item icon right">
                <router-link to="/tools" title="Tools"><i class="fa fa-wrench"></i></router-link>
            </div>
            <div :class="{ 'top-menu-item': true, 'icon': true, 'right': true, 'active': $route.name == 'Settings' }">
                <router-link to="/settings"><i class="fa fa-cog"></i></router-link>
            </div>
            <div class="top-menu-item icon right">
                <router-link to="/about" title="About"><i class="fa fa-info-circle"></i></router-link>
            </div>
            <div class="top-menu-item icon right">
                <a class="linkback" href="https://github.com/MrBrax/TwitchAutomator" target="_blank" rel="noreferrer" title="GitHub"><i class="fab fa-github"></i></a>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";

// import type { ApiConfig } from "@/twitchautomator.d";

export default defineComponent({
    name: "SideMenu",
    props: [
        
    ],
});

</script>