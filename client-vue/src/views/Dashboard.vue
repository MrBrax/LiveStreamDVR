<template>
    <div class="container vertical">
        <section class="section" data-section="vods">
            <div class="section-title"><h1>Recorded VODs</h1></div>
            <div class="section-content" v-if="$store.state.streamerList && $store.state.streamerList.length > 0">
                <streamer v-for="streamer in $store.state.streamerList" v-bind:key="streamer.id" v-bind:streamer="streamer" />
            </div>
        </section>
    </div>
    <div id="js-status" ref="js-status">
        {{ loading ? 'Loading...' : 'Refreshing in ' + timer + ' seconds.' }}
    </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
// import HelloWorld from "@/components/HelloWorld.vue"; // @ is an alias to /src
import Streamer from "@/components/Streamer.vue";

import type { ApiStreamer } from "@/twitchautomator.d";

export default defineComponent({
    name: "Dashboard",
    data() {
        return {
            loading: false,
            streamerList: Array as () => ApiStreamer[],
            timer: 120,
            timerMax: 120,
            interval: 0
        };
    },
    created() {
        this.loading = true;
        this.fetchData().then( (sl) => {
            this.$store.commit('updateStreamerList', sl);
            this.loading = false;
        });
    },
    mounted(){
        this.interval = setInterval(() => {
            this.fetchTicker();
        }, 1000);
    },
    unmounted(){
        if(this.interval){
            clearTimeout(this.interval);
        }
    },
    methods: {
        async fetchData() {
            /*
            return fetch(`api/v0/channels/list`)
            .then((response) => response.json())
            .then((json) => {
                if(!json.data || !json.data.streamer_list){
                    console.error("invalid data", json);
                    return;
                }
                return json.data.streamer_list;
            });*/
            /*
            return this.$http.get(`/api/v0/channels/list`)
                    .then((json) => {
                        if(!json.data || !json.data.streamer_list){
                            console.error("invalid data", json);
                            return;
                        }
                        return json.data.streamer_list;
                    }).catch((err) => {
                        console.error("axios error", err);
                    });*/
            let response;
            try {
                response = await this.$http.get(`/api/v0/channels/list`);
            } catch (error) {
                console.error(error);
                return;
            }
            
            return response.data.data.streamer_list;

        },
        async fetchTicker(){
            if( this.timer <= 0 && !this.loading ){

                this.loading = true;
                const result : ApiStreamer[] = await this.fetchData();
                this.loading = false;

                const isAnyoneLive = result.find( el => el.is_live == true ) !== undefined;

                if(!isAnyoneLive){
                    if(this.timerMax < 1800){ // 30 minutes
                        this.timerMax += 10;
                    }
                }else{
                    this.timerMax = 15;
                }

                this.$store.commit('updateStreamerList', result);

                this.timer = this.timerMax;

            }else{
                this.timer -= 1;
            }
        }
    },
    components: {
        Streamer
        // HelloWorld
    },
});
</script>
