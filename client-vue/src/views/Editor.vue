<template>
    <div class="videoplayer">
        <video id="video" ref="player" :src="vodData.webpath + '/' + vodData.basename + '.mp4'" @timeupdate="updateVideoTime" width="1280"></video>
        <div id="videoplayer-controls">
            <button class="button" @click="play">Play</button>
            <button class="button" @click="pause">Pause</button>
        </div>
        <div id="timeline" ref="timeline" @click="seek">
            <div id="timeline-cut" v-bind:style="timelineCutStyle"></div>
            <div id="timeline-playhead" v-bind:style="timelinePlayheadStyle"></div>
        </div>

        <!--{{ currentVideoTime }} / {{ $refs.player ? $refs.player.currentTime : 'init' }} / {{ $refs.player ? $refs.player.duration : 'init' }}-->

        <div class="videoplayer-chapters">
            <div
                v-for="chapter in vodData.chapters"
                :key="chapter"
                :title="chapter.title + ' | \\n' + chapter.game_name"
                class="videoplayer-chapter"
                :style="{ width: chapter.width + '%' }"
                @click="scrub(chapter.offset, chapter.duration)"
            >
                <div class="videoplayer-chapter-title">{{ chapter.title }}</div>
                <div class="videoplayer-chapter-game">{{ chapter.game_name }}</div>
            </div>
        </div>

        <div class="videoplayer-cut">
            <input type="hidden" name="vod" value="{{ vodData.basename }}" />

            <div>
                <button type="button" class="button" @click="timeIn = Math.round(currentVideoTime)">Mark in</button>
                <input class="input" name="start" v-model="timeIn" placeholder="In timestamp" />
            </div>

            <div>
                <button type="button" class="button" @click="timeOut = Math.round(currentVideoTime)">Mark out</button>
                <input class="input" name="end" v-model="timeOut" placeholder="Out timestamp" />
            </div>

            <div>
                <input class="input" type="text" name="name" v-model="cutName" placeholder="Name (optional)" />
            </div>

            <div>
                <button type="button" class="button" @click="submit">Submit cut</button>
            </div>

            <!--
			<form method="post" action="{{ url_for('api_vod_export', { 'vod': vodclass.basename }) }}">
				<select name="destination">
					<option>YouTube</option>
				</select>
				<button type="submit" class="button" onclick="submit_cut();">Upload</button>
			</form>
			-->
        </div>
    </div>
</template>

<script lang="ts">

import { defineComponent, onMounted, ref } from "vue";
import type { ApiVod } from "@/twitchautomator.d";

export default defineComponent({
    name: "Editor",
    title: "Editor",
    data(){
        return {
            vodData: {} as ApiVod,
            timeIn: 0,
            timeOut: 0,
            currentVideoTime: 0,
            cutName: ''
            // videoDuration: 0,
        }
    },
    created() {
        this.fetchData();
    },
    props: {
        vod: String,
    },
    methods: {
        fetchData() {
            // this.vodData = [];
            /** @todo: axios */
            fetch(`api/v0/vod/${this.vod}/`)
            .then((response) => response.json())
            .then((json) => {
                this.vodData = json.data;
                console.log(json);
            });
        },
        play(){
            console.log("play", this.$refs.player);
            (this.$refs.player as HTMLVideoElement).play();
        },
        pause(){
            console.log("pause", this.$refs.player);
            (this.$refs.player as HTMLVideoElement).pause();
        },
        scrub(tIn : number, tOut : number){
            const gameOffset = this.vodData.game_offset;
            this.timeIn = Math.round(tIn-gameOffset);
		    this.timeOut = Math.round(tIn+tOut-gameOffset);
            // this.$forceUpdate();
        },
        seek(event : MouseEvent){
            console.log("seek", event);
            const duration = (this.$refs.player as HTMLVideoElement).duration;
            const rect = (this.$refs.timeline as HTMLDivElement).getBoundingClientRect();
            const percent = ( event.clientX - rect.left ) / (this.$refs.timeline as HTMLDivElement).clientWidth;
            const seconds = Math.round(duration * percent);
            (this.$refs.player as HTMLVideoElement).currentTime = seconds;

            // this.$forceUpdate();
        },
        updateVideoTime( event : MediaStreamEvent){
            // console.log(v);
            this.currentVideoTime = (event.target as HTMLVideoElement).currentTime;
        },
        submit(){
            console.log("submit", this.timeIn, this.timeOut, this.cutName);

            const data = new FormData();
            data.append('time_in', this.timeIn.toString());
            data.append('time_out', this.timeOut.toString());
            data.append('name', this.cutName);

            /** @todo: axios */
            fetch(`api/v0/vod/${this.vod}/cut`, {
                method: 'POST',
                body: data
            })
            .then((response) => response.json())
            .then((json) => {
                if(json.message) alert(json.message);
                console.log(json);
            });

        }
    },
    computed: {
        timelineCutStyle() : Record<string, any> {
            if(!this.currentVideoTime) return { left: '0%', right: '100%' };
            const dur = (this.$refs.player as HTMLVideoElement).duration;
            return {
                left: ( ( this.timeIn / dur ) * 100 ) + "%",
                right: ( 100 - ( this.timeOut / dur ) * 100 ) + "%",
            };
        },
        timelinePlayheadStyle() : Record<string, any> {
            if(!this.currentVideoTime) return { left: '0%' };
		    const percent = ( this.currentVideoTime / (this.$refs.player as HTMLVideoElement).duration ) * 100;
		    return {
                left: percent + "%"
            };
        }
    }
});
</script>
