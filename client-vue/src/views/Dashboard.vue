<template>
    <div class="container vertical">
        <section class="section" data-section="vods">
            <div class="section-title"><h1>Recorded VODs</h1></div>
            <div class="section-content">
                <streamer v-for="streamer in streamerList" v-bind:key="streamer.id" v-bind:streamer="streamer" />
            </div>
        </section>
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
        };
    },
    created() {
        this.fetchData();
    },
    methods: {
        fetchData() {
            this.streamerList = [] as any;
            fetch("/api/v0/channels/list")
            .then((response) => response.json())
            .then((json) => {
                
                this.streamerList = json.data.streamer_list;

                // this.$emit('streamer-list', json.data.streamer_list);
                
                console.log("do commit", json.data.streamer_list);
                this.$store.commit('updateStreamerList', json.data.streamer_list);
                
                // this.$store.streamerList = json.data.streamer_list;
                    // console.log("root", this.$root.streamerList);
                    // if( this.$root && this.$root.$data.streamerList ){
                    //     this.$root.$data.streamerList = json.data.streamer_list;
                    // }
                
                console.log("streamerList Dashboard", json);
            });
        },
    },
    components: {
        Streamer
        // HelloWorld
    },
});
</script>
