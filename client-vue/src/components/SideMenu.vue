<template>
    <div class="side-menu">

        <div class="menu-top">
            <div class="top-menu-item title">
                <router-link to="/dashboard">
                    <img src="../assets/logo.png" class="favicon" width="24" height="24" :alt="$store.state.config.app_name">
                    <span class="title">
                        {{ $store.state.config.app_name }} {{ $store.state.version }}
                        <span v-if="$store.state.config.debug">(debug)</span>
                    </span>
                </router-link>
            </div>
        </div>

        
        <div class="menu-middle" v-if="$route.name == 'Dashboard' && $store.state.streamerList && $store.state.streamerList.length > 0">
            
            <!--{% for streamer in streamerList|sort((a, b) => a.display_name > b.display_name) %}-->
            <template v-for="streamer in $store.state.streamerList" :key="streamer.username">

                <div :class="{
                    'top-menu-item': true,
                    'is-live': streamer.is_live,
                    'is-animated': $store.state.clientConfig.animationsEnabled,
                    'streamer': true
                }" :data-streamer="streamer.display_name">
                    
                    <a :href="'#streamer_' + streamer.display_name">
                        
                        <span class="avatar"><img :src="streamer.profile_image_url" :alt="streamer.display_name"></span>
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

                                for {{ vodTimes[streamer.current_vod.basename] }}

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
                                    'is-favourite': vod.api_hasFavouriteGame,
                                    'is-live': vod.is_capturing,
                                    'is-animated': $store.state.clientConfig.animationsEnabled,
                                    'is-converting': vod.is_converting,
                                    'is-waiting': !vod.is_capturing && !vod.is_converting && !vod.is_finalized
                                }" :title="formatDate(vod.dt_started_at.date)">
                                
                                <!-- main icon -->                            
                                <span class="icon" v-if="vod.is_capturing"><fa icon="sync" spin></fa></span> <!-- capturing -->
                                <span class="icon" v-else-if="vod.is_converting"><fa icon="cog" spin></fa></span> <!-- converting -->
                                <span class="icon" v-else-if="vod.api_hasFavouriteGame"><fa icon="star"></fa></span> <!-- favourite -->
                                <span class="icon" v-else-if="!vod.is_capturing && !vod.is_converting && !vod.is_finalized"><fa :icon="['far', 'hourglass']"></fa></span> <!-- waiting after capture -->
                                <span class="icon" v-else-if="vod.is_finalized"><fa icon="film"></fa></span> <!-- video -->

                                <!-- started at -->
                                <span v-if="!$store.state.config.relative_time && vod.dt_started_at">{{ formatDate(vod.dt_started_at.date) }}</span><!-- absolute time -->
                                <span v-if="$store.state.config.relative_time && vod.dt_started_at">{{ humanDate(vod.dt_started_at.date) }}</span><!-- relative time -->

                                <!-- when capturing -->
                                <template v-if="vod.is_capturing">
                                    <!--<span v-if="vod.duration_live">&middot; ({{ $store.state.config.relative_time ? niceDuration(vod.duration_live) : humanDuration(vod.duration_live) }}+)</span>-->
                                    <span>&middot; ({{ vodTimes[vod.basename] }})</span><!-- duration -->
                                    <span v-if="vod.api_getRecordingSize">&middot; {{ formatBytes(vod.api_getRecordingSize, 2) }}+</span><!-- filesize -->
                                </template>

                                <!-- when not capturing -->
                                <template v-else>
                                    <span v-if="vod.duration_seconds">&middot; ({{ $store.state.config.relative_time ? niceDuration(vod.duration_seconds) : humanDuration(vod.duration_seconds) }})</span><!-- duration -->
                                    <span v-if="vod.total_size">&middot; {{ formatBytes(vod.total_size, 2) }}</span><!-- filesize -->
                                </template>

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
                                        <div v-for="game in vod.api_getUniqueGames" :key="game.name" :class="{ 'boxart-item': true, 'is-favourite': $store.state.config.favourites[game.id] }">
                                            <img v-if="game.image_url" :title="game.name" :alt="game.name" :src="game.image_url" loading="lazy" />
                                            <span class="boxart-name">{{ game.name }}</span>
                                        </div>
                                    </div>
                                    <div class="stream-title">{{ vod.stream_title }}</div>
                                </div>
                            </a>
                        </li>
                    </ul>
                </div>
                

            </template>
            
        </div>

        <div class="top-menu-item divider"></div>

        <div class="menu-bottom">
            <div :class="{ 'top-menu-item': true, 'icon': true, 'right': true, 'active': $route.name == 'Dashboard' }" data-menuitem="dashboard">
                <router-link to="/dashboard" title="Dashboard"><fa icon="tachometer-alt"></fa></router-link>
            </div>
            <!--
            <div class="top-menu-item icon right">
                <a href="javascript:window.forceRefresh();" title="Refresh"><fa icon="sync"></fa></a>
            </div>
            <div class="top-menu-item icon right">
                <a href="javascript:notifyMe();" title="Notify"><fa icon="bell"></fa></a>
            </div>
            -->
            <div :class="{ 'top-menu-item': true, 'icon': true, 'right': true, 'active': $route.name == 'Tools' }" data-menuitem="tools">
                <router-link to="/tools" title="Tools"><fa icon="wrench"></fa></router-link>
            </div>
            <div :class="{ 'top-menu-item': true, 'icon': true, 'right': true, 'active': $route.name == 'Settings' }" data-menuitem="settings">
                <router-link to="/settings" title="Settings"><fa icon="cog"></fa></router-link>
            </div>
            <div :class="{ 'top-menu-item': true, 'icon': true, 'right': true, 'active': $route.name == 'ClientSettings' }" data-menuitem="clientsettings">
                <router-link to="/clientsettings" title="Client Settings"><fa icon="user-cog"></fa></router-link>
            </div>
            <div :class="{ 'top-menu-item': true, 'icon': true, 'right': true, 'active': $route.name == 'About' }" data-menuitem="github">
                <router-link to="/about" title="About"><fa icon="info-circle"></fa></router-link>
            </div>
            <div class="top-menu-item icon right" data-menuitem="github">
                <a class="linkback" href="https://github.com/MrBrax/TwitchAutomator" target="_blank" rel="noreferrer" title="GitHub"><fa :icon="['fab', 'github']"></fa></a>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import type { ApiStreamer } from "@/twitchautomator.d";
import { defineComponent } from "vue";
import { parse, intervalToDuration, parseJSON } from 'date-fns';

import { library } from '@fortawesome/fontawesome-svg-core';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { faFilm, faTachometerAlt, faWrench, faCog, faUserCog, faInfoCircle, faStar, faSync } from '@fortawesome/free-solid-svg-icons';
import { faHourglass } from '@fortawesome/free-regular-svg-icons';
library.add(faGithub, faFilm, faTachometerAlt, faWrench, faCog, faUserCog, faInfoCircle, faStar, faSync, faHourglass);

export default defineComponent({
    name: "SideMenu",
    data() {
        return {
            vodTimes: {} as Record<string, string>,
            interval: 0
        };
    },
    mounted(){
        this.interval = setInterval(() => {
            if(!this.$store.state.streamerList) return;

            for(const streamer of this.$store.state.streamerList){
                for(const vod of (streamer as ApiStreamer).vods_list){
                    if( vod.dt_started_at ){
                        
                        const dt = vod.dt_started_at.date;
                        const o = parseJSON(dt);
                        const dur = intervalToDuration({ start: o, end: new Date()});
                        
                        this.vodTimes[vod.basename] = dur.hours?.toString().padStart(2, "0") + ":" + dur.minutes?.toString().padStart(2, "0") + ":" + dur.seconds?.toString().padStart(2, "0");

                    }
                }
            }
            
        }, 1000);
    },
    unmounted(){
        if(this.interval){
            clearTimeout(this.interval);
        }
    },
    computed: {
        
    }
});

</script>