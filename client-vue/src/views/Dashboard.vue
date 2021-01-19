<template>
    
    <div class="container vertical">
        
        <section class="section" data-section="vods">
            <div class="section-title"><h1>Recorded VODs</h1></div>
            <div class="section-content" v-if="$store.state.streamerList && $store.state.streamerList.length > 0">
                <streamer v-for="streamer in sortedStreamers" v-bind:key="streamer.id" v-bind:streamer="streamer" />
                <hr />
                <div>
                    <strong>Total size: {{ formatBytes(totalSize) }}</strong><br>
                    <strong>Free space: {{ formatBytes(freeSize) }}</strong>
                </div>
            </div>
        </section>

        <section class="section">
            <div class="section-title"><h1>Logs</h1></div>
            <div class="section-content">

                <!--
                <select id="log_select">
                    {% for f in log_files %}
                        <option>{{ f }}</button>
                    {% endfor %}
                </select>
                -->

                <div class="log_viewer">
                    <table>
                        <tr v-for="line in logLines" :key="line" :class="'log-line log-line-'+(line.level.toLowerCase())">
                            <td>{{ line.date_string }}</td>
                            <td><a @click="filterLog(line.module)">{{ line.module }}</a></td>
                            <td>{{ line.level }}</td>
                            <td>{{ line.text }}</td>
                        </tr>
                    </table>
                </div>

            </div>
        </section>

    </div>

    <div id="js-status" ref="js-status">
        {{ loading ? 'Loading...' : 'Refreshing in ' + timer + ' seconds.' }}
    </div>

</template>

<script lang="ts">
import { defineComponent } from "vue";
import Streamer from "@/components/Streamer.vue";
import type { ApiStreamer } from "@/twitchautomator.d";
import { format } from 'date-fns';

export default defineComponent({
    name: "Dashboard",
    data() {
        return {
            loading: false,
            // streamerList: Array as () => ApiStreamer[],
            timer: 120,
            timerMax: 120,
            interval: 0,
            totalSize: 0,
            freeSize: 0,
            logFilename: '',
            logLines: [],
            logFromLine: 0
        };
    },
    created() {
        this.loading = true;
        this.fetchStreamers().then( (sl) => {
            this.$store.commit('updateStreamerList', sl);
            this.loading = false;
        }).then(() => {
            this.fetchLog();
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
        async fetchStreamers() {
            
            let response;
            try {
                response = await this.$http.get(`/api/v0/channels/list`);
            } catch (error) {
                console.error(error);
                return;
            }

            console.log("data", response.data);

            this.totalSize = response.data.data.total_size;
            this.freeSize = response.data.data.free_size;
            
            return response.data.data.streamer_list;

        },
        async fetchLog() {

            // today's log file
            if(this.logFilename == ''){
                this.logFilename = format(new Date(), "yyyy-MM-dd");
            }
            
            let response;
            try {
                response = await this.$http.get(`/api/v0/log/${this.logFilename}/${this.logFromLine}`);
            } catch (error) {
                console.error(error);
                return;
            }

            console.log("log data", response.data);

            if(!response.data.data.lines) return;

            this.logFromLine = response.data.data.last_line;
            
            this.logLines = this.logLines.concat(response.data.data.lines);

        },
        async fetchTicker(){
            if( this.timer <= 0 && !this.loading ){

                this.loading = true;
                const result : ApiStreamer[] = await this.fetchStreamers();
                this.loading = false;

                const isAnyoneLive = result.find( el => el.is_live == true ) !== undefined;

                if(!isAnyoneLive){
                    if(this.timerMax < 1800){ // 30 minutes
                        this.timerMax += 10;
                    }
                }else{
                    this.timerMax = 120;
                }

                this.$store.commit('updateStreamerList', result);

                this.fetchLog();

                this.timer = this.timerMax;

            }else{
                this.timer -= 1;
            }
        }
    },
    computed: {
        sortedStreamers(){
            const streamers = this.$store.state.streamerList;
            return streamers.sort((a:ApiStreamer, b:ApiStreamer) => a.display_name > b.display_name);
            /*
            return Object.entries( streamers ).sort(([, a], [, b]) =>
                (a as any).display_name.localeCompare((b as any).display_name)
            );*/
        }
    },
    components: {
        Streamer
        // HelloWorld
    },
});
</script>
