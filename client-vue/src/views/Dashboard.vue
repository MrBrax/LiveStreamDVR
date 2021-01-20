<template>
    
    <div class="container vertical">
        
        <section class="section" data-section="vods">
            <div class="section-title"><h1>Recorded VODs</h1></div>
            <div class="section-content" v-if="$store.state.config && $store.state.streamerList && $store.state.streamerList.length > 0">
                <streamer v-for="streamer in sortedStreamers" v-bind:key="streamer.userid" v-bind:streamer="streamer" />
                <hr />
                <div>
                    <strong>Total size: {{ formatBytes(totalSize) }}</strong><br>
                    <strong>Free space: {{ formatBytes(freeSize) }}</strong>
                </div>
            </div>
        </section>

        <section class="section">
            <div class="section-title" @click="logToggle"><h1>Logs</h1></div>
            <div class="section-content" v-if="logVisible">

                <!--
                <select id="log_select">
                    {% for f in log_files %}
                        <option>{{ f }}</button>
                    {% endfor %}
                </select>
                -->

                <div class="log_viewer" ref="logViewer">
                    <table>
                        <tr v-for="line in logFiltered" :key="line" :class="'log-line log-line-'+(line.level.toLowerCase())">
                            <td>{{ line.date_string }}</td>
                            <td><a @click="logSetFilter(line.module)">{{ line.module }}</a></td>
                            <td>{{ line.level }}</td>
                            <td>{{ line.text }}</td>
                        </tr>
                    </table>
                </div>

            </div>
        </section>

    </div>

    <div id="js-status" ref="js-status" @click="timer = 0">
        {{ loading ? 'Loading...' : 'Refreshing in ' + timer + ' seconds.' }}
    </div>

</template>

<script lang="ts">
import { defineComponent } from "vue";
import Streamer from "@/components/Streamer.vue";
import type { ApiStreamer } from "@/twitchautomator.d";
import { format } from 'date-fns';
import { MutationPayload } from "vuex";

type LogLine = {
    level: number;
    module: string;
};

export default defineComponent({
    name: "Dashboard",
    title() : string {
        if(this.streamersOnline > 0) return `[${this.streamersOnline}] Dashboard`;
        return "Dashboard";
    },
    data() {
        return {
            loading: false,
            timer: 120,
            timerMax: 120,
            interval: 0,
            totalSize: 0,
            freeSize: 0,
            logFilename: '',
            logLines: [],
            logFromLine: 0,
            logVisible: false,
            logModule: '',
            oldData: Array as any,
            notificationSub: Function as any
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
        
        this.processNotifications();
    },
    unmounted(){
        if(this.interval){
            clearTimeout(this.interval);
        }
        this.notificationSub();
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

            if(!response.data.data){
                console.error("fetchStreamers invalid data", response.data);
                return;
            }

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

            // console.debug("log data", response.data);

            if(!response.data.data){
                console.error("fetchLog invalid data", response.data);
                return;
            }

            if(!response.data.data.lines) return;

            this.logFromLine = response.data.data.last_line;
            
            this.logLines = this.logLines.concat(response.data.data.lines);

            // scroll to bottom
            setTimeout(() => {
                const lv = (this.$refs.logViewer as HTMLDivElement);
                if(!lv) return;
                lv.scrollTop = lv.scrollHeight;
            }, 100);

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
        },
        processNotifications(){

            /*
                let old_data = previousData[ username ];

                if(old_data && Notification.permission === "granted"){

                    let opt = {
                        icon: streamer.channel_data.profile_image_url,
                        image: streamer.channel_data.profile_image_url,
                        body: streamer.current_game ? streamer.current_game.game_name : "No game",
                    };

                    let text: string = "";

                    if( !old_data.is_live && streamer.is_live ){
                        text = `${username} is live!`;
                    }

                    if( ( !old_data.current_game && streamer.current_game ) || ( old_data.current_game && streamer.current_game && old_data.current_game.game_name !== streamer.current_game.game_name ) ){
                        if( streamer.current_game.favourite ){
                            text = `${username} is now playing one of your favourite games: ${streamer.current_game.game_name}!`;
                        }else{
                            text = `${username} is now playing ${streamer.current_game.game_name}!`;
                        }
                    }

                    if( old_data.is_live && !streamer.is_live ){
                        text = `${username} has gone offline!`;
                    }

                    if(text !== ""){

                        console.log( `Notify: ${text}` );

                        if (Notification.permission === "granted") {
                            let n = new Notification( text, opt );
                        }

                        if( config.useSpeech ){
                            let speakText = text;
                            if(streamerPronounciation[username]){
                                console.debug(`Using pronounciation for ${username}`);
                                speakText.replace(username, streamerPronounciation[username]);
                            }
                            let utterance = new SpeechSynthesisUtterance( speakText );
                            window.speechSynthesis.speak(utterance);
                        }

                    }

                }

                previousData[ username ] = streamer;
            */
            
            if(!this.$store.state.clientConfig.enableNotifications){
                return;
            }

            console.log("Notifications enabled");

            this.notificationSub = this.$store.subscribe((mutation : MutationPayload, state : any ) => {

                // unsub if changed
                if(!this.$store.state.clientConfig.enableNotifications){
                    console.log("Notification setting disabled, stopping subscription.");
                    this.notificationSub();
                    return;
                }

                // console.log("subscribe", mutation.payload, this.$store.state.streamerList);
                /*
                if( mutation.payload[0].current_game !== state.streamerList[0].current_game ){
                    alert( mutation.payload[0].display_name + ": " + mutation.payload[0].current_game );
                }*/
                // console.log( "values", Object.(mutation.payload[0]));
                const streamerPronounciation: { [key: string]: string } = {
                    'pokelawls': 'pookelawls',
                    'xQcOW': 'eckscueseeow'
                };

                for( const streamer of mutation.payload as ApiStreamer[] ){

                    const username = streamer.display_name;

                    if( this.oldData[ streamer.display_name ] ){
                        
                        const oldStreamer = this.oldData[ streamer.display_name ];

                        const opt = {
                            icon: streamer.channel_data.profile_image_url,
                            image: streamer.channel_data.profile_image_url,
                            body: streamer.current_game ? streamer.current_game.game_name : "No game",
                        };

                        let text = "";

                        if( !oldStreamer.is_live && streamer.is_live ){
                            text = `${username} is live!`;
                        }

                        if(
                            ( !oldStreamer.current_game && streamer.current_game ) || // from no game to new game
                            ( oldStreamer.current_game && streamer.current_game && oldStreamer.current_game.game_name !== streamer.current_game.game_name ) // from old game to new game
                        ){
                            // alert( streamer.display_name + " is now playing " + streamer.current_game.game_name );
                            
                            if( streamer.current_game.favourite ){
                                text = `${username} is now playing one of your favourite games: ${streamer.current_game.game_name}!`;
                            }else{
                                text = `${username} is now playing ${streamer.current_game.game_name}!`;
                            }

                        }

                        if( oldStreamer.is_live && !streamer.is_live ){
                            text = `${username} has gone offline!`;
                        }

                        if(text !== ""){

                            console.log( `Notify: ${text}` );

                            if (Notification.permission === "granted") {
                                const toast = new Notification( text, opt );
                            }

                            const useSpeech = true;
                            if( useSpeech ){
                                
                                let speakText = text;
                                
                                if(streamerPronounciation[username]){
                                    console.debug(`Using pronounciation for ${username}`);
                                    speakText = speakText.replace(username, streamerPronounciation[username]);
                                }
                                const utterance = new SpeechSynthesisUtterance( speakText );
                                window.speechSynthesis.speak(utterance);
                            }

                        }else{
                            console.log(`No notification text for ${streamer.display_name}`);
                        }

                    }

                    this.oldData[ streamer.display_name ] = streamer;
                }

            });

        },
        logSetFilter( val: string ){
            if(this.logModule){
                this.logModule = '';
            }else{
                this.logModule = val;
            }
            console.log(`Log filter set to ${this.logModule}`)
        },
        logToggle(){
            this.logVisible = !this.logVisible;
            setTimeout(() => {
                const lv = (this.$refs.logViewer as HTMLDivElement);
                if(!lv) return;
                lv.scrollTop = lv.scrollHeight;
            }, 100);
        }
    },
    computed: {
        sortedStreamers(){
            const streamers : ApiStreamer[] = this.$store.state.streamerList;
            return streamers.sort((a, b) => a.display_name.localeCompare(b.display_name));
            /*
            return Object.entries( streamers ).sort(([, a], [, b]) =>
                (a as any).display_name.localeCompare((b as any).display_name)
            );*/
        },
        logFiltered() : Record<string, any> {
            if(!this.logModule) return this.logLines;
            return this.logLines.filter( val => (val as LogLine).module == this.logModule );
        },
        streamersOnline() : number {
            if(!this.$store.state.streamerList) return 0;
            return this.$store.state.streamerList.filter( a => a.is_live ).length;
        }
    },
    components: {
        Streamer
        // HelloWorld
    },
    watch: {
        streamersOnline(){
            document.title = `[${this.streamersOnline}] Dashboard `;
        }
    }
});
</script>
