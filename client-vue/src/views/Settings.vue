<template>
    <div class="container">

        <!-- streamers -->
        <section class="section">
            <div class="section-title"><h1>Streamers</h1></div>
            <div class="section-content">
                <div class="card" v-for="streamer in formStreamers" :key="streamer.username">
                    <div class="card-title"><h2>{{ streamer.username }}</h2></div>
                    <div class="card-content">
                        
                        <form method="POST" enctype="multipart/form-data" action="#" @submit="updateStreamer">
                        
                            <input type="hidden" name="username" :value="streamer.username" />
                            
                            <div class="field">
                                <label class="label" :for="'input_' + streamer.username + '_quality'">Quality</label>
                                <div class="control">
                                    <input class="input input-required" type="text" name="quality" :id="'input_' + streamer.username + '_quality'" :value="streamer.quality.join(' ')" />
                                    <p class="input-help">Separate by spaces, e.g. best 1080p 720p audio_only</p>
                                </div>
                            </div>

                            <div class="field">
                                <label class="label" :for="'input_' + streamer.username + '_match'">Match keywords</label>
                                <div class="control">
                                    <input class="input" type="text" name="match" :id="'input_' + streamer.username + '_match'" :value="streamer.match?.join(', ')" />
                                    <p class="input-help">Separate by commas, e.g. christmas,media share,opening,po box</p>
                                </div>
                            </div>

                            <div class="field">
                                <label class="checkbox">
                                    <input class="input" type="checkbox" name="download_chat" value="1" :checked="streamer.download_chat" />
                                    Download chat after video capture is complete
                                </label>
                            </div>

                            <div class="field">
                                <label class="checkbox">
                                    <input class="input" type="checkbox" name="burn_chat" value="1" :checked="streamer.burn_chat" />
                                    Burn chat after downloading
                                </label>
                            </div>

                            <div class="field">
                                <div class="control">
                                    <button class="button is-confirm" type="submit">
                                        <span class="icon"><i class="fa fa-save"></i></span> Save
                                    </button>
                                </div>
                            </div>

                        </form>
                        <!--
                        <hr>
                        <form>
                            <input type="hidden" name="username" :value="streamer.username" />
                            <button class="button is-danger" type="submit"><span class="icon"><i class="fa fa-trash"></i></span> Delete</button> (no undo, no confirmation)
                        </form>
                        -->
                    </div>
                </div>
            </div>
        </section>

        <!-- new streamer -->
        <section class="section">
            <div class="section-title"><h1>New streamer</h1></div>
            <div class="section-content">
                <form>
                    <div class="field">
                        <label class="label">Username <span class="required">*</span></label>
                        <div class="control">
                            <input class="input input-required" type="text" name="username" value="" />
                            <p class="input-help">Streamer username, case sensitive</p>
                        </div>
                    </div>
                    <div class="field">
                        <label class="label">Quality <span class="required">*</span></label>
                        <div class="control">
                            <input class="input input-required" type="text" name="quality" value="" />
                            <p class="input-help">Separate by spaces, e.g. best 1080p 720p audio_only</p>
                        </div>
                    </div>
                    <div class="field">
                        <label class="label">Match keywords</label>
                        <div class="control">
                            <input class="input" type="text" name="match" value="" />
                            <p class="input-help">Separate by commas, e.g. christmas,media share,opening,po box</p>
                        </div>
                    </div>
                    <div class="field">
                        <label class="checkbox">
                            <input type="checkbox" name="download_chat" value="1" />
                            Download chat after video capture is complete
                        </label>
                    </div>
                    <div class="field">
                        <label class="checkbox">
                            <input type="checkbox" name="burn_chat" value="1" />
                            Burn chat after downloading
                        </label>
                    </div>
                    <div class="field">
                        <div class="control">
                            <button class="button is-confirm" type="button">
                                <span class="icon"><i class="fa fa-user-plus"></i></span> Add
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </section>

        <!-- settings -->
        <section class="section">
            <div class="section-title"><h1>Settings</h1></div>
            <div class="section-content">
                <form ref="settings-form">
                    <div class="field" v-for="(data, key) in settingsFields" v-bind:key="key">
                        <label v-if="data.type != 'boolean'" class="label" :for="'input_' + key">{{ data.text }}</label>

                        <!-- boolean -->
                        <div v-if="data.type == 'boolean'" class="control">
                            <label class="checkbox">
                                <input type="checkbox" :name="key" :id="'input_' + key" v-model="settingsData[key]" />
                                {{ data.text }}
                            </label>
                        </div>

                        <!-- string -->
                        <div v-if="data.type == 'string'" class="control">
                            <input class="input" type="text" :name="key" :id="'input_' + key" v-model="settingsData[key]" />
                        </div>

                        <!-- number -->
                        <div v-if="data.type == 'number'" class="control">
                            <input class="input" type="number" :name="key" :id="'input_' + key" v-model="settingsData[key]" />
                        </div>

                        <!-- array -->
                        <div v-if="data.type == 'array'" class="control">
                            <!--<input class="input" :name="key" :id="key" :value="settings[key]" />-->
                            <select :name="key" :id="'input_' + key" v-model="settingsData[key]">
                                <option v-for="item in data.choices" :key="item">
                                    {{ item }}
                                </option>
                            </select>
                        </div>
                    </div>

                    <div class="control">
                        <button class="button is-confirm" type="button" @click="saveSettings">
                            <span class="icon"><i class="fa fa-save"></i></span> Save
                        </button>
                    </div>
                </form>
            </div>
        </section>

        <!-- favourites -->
        <section class="section">
            <div class="section-title"><h1>Favourite games</h1></div>
            <div class="section-content">
                <form ref="favourites-form">
                    <div class="favourites_list">
                        <div v-for="[id, game] in sortedGames" :key="id" class="checkbox">
                            <label>
                                <input type="checkbox" :name="'games[' + id + ']'" v-model="formFavourites.games[id]"  /> <!-- :checked="$store.state.config.favourites[id]" -->
                                {{ game.name }}
                                <span class="is-gray">{{ formatTimestamp(game.added) }}</span>
                            </label>
                        </div>
                    </div>

                    <div class="control">
                        <button class="button is-confirm" type="button" @click="saveFavourites">
                            <span class="icon"><i class="fa fa-save"></i></span> Save
                        </button>
                    </div>
                </form>
            </div>
        </section>
    </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
// import HelloWorld from "@/components/HelloWorld.vue"; // @ is an alias to /src

import type { ApiSettingsField, ApiGame } from "@/twitchautomator.d";

export default defineComponent({
    name: "Settings",
    data() {
        return {
            settingsData: [],
            settingsFields: Array as () => ApiSettingsField[],
            games: Array as () => ApiGame[],
            formStreamers: {},
            formNewStreamer: {},
            formFavourites: {
                games: {}
            }
            // games: Object as () => [key: string]: ApiGame
        };
    },
    created() {
        this.fetchData();
    },
    methods: {
        fetchData() {
            this.settingsData = [];
            this.settingsFields = [] as any;

            fetch("/api/v0/settings/list")
            .then((response) => response.json())
            .then((json) => {

                const config = json.data.config;
                const favourites = config.favourites;
                const streamers = config.streamers;

                this.formFavourites.games = favourites;
                this.formStreamers = streamers;

                this.settingsData = config;
                this.settingsFields = json.data.fields;

            });

            fetch("/api/v0/games/list")
            .then((response) => response.json())
            .then((json) => {
                console.log("game data", json.data);
                const games = json.data;
                this.games = games;
            });

        },
        saveSettings(){
            alert("save settings form");
        },
        saveFavourites(){
            alert("save favourites form");
        },
        updateStreamer( event : Event ){

            const form = event.target as HTMLFormElement;

            const inputs = new FormData(form);

            console.log( "form", form );
            console.log( "entries", inputs, inputs.entries(), inputs.values() );

            fetch(`/api/v0/channels/update`, {
                method: 'POST',
                body: inputs
            })
            .then((response) => response.json())
            .then((json) => {
                if(json.message) alert(json.message);
                console.log("Success", json);
            }).catch((test) => {
                console.error("Error", test);
            });

            event.preventDefault();
            return false;
        }
    },
    computed: {
        sortedGames(){
            return Object.entries( (this as any).games ).sort(([, a], [, b]) =>
                (a as any).name.localeCompare((b as any).name)
            );
        }
    },
    components: {
        // HelloWorld
    },
});
</script>
