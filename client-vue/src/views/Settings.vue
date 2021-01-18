<template>
    <div class="container">
        
        <section class="section">

            <div class="section-title"><h1>Settings</h1></div>

            <div class="section-content">
                <div
                    class="field"
                    v-for="(data, key) in settingsFields"
                    v-bind:key="key"
                >
                    <label v-if="data.type != 'boolean'" class="label" :for="'input_' + key">{{ data.text }}</label>

                    <!-- boolean -->
                    <div v-if="data.type == 'boolean'" class="control">
                        <label class="checkbox">
                            <input
                                type="checkbox"
                                :name="key"
                                :id="'input_' + key"
                                v-model="settingsData[key]"
                            />
                            {{ data.text }}
                        </label>
                    </div>

                    <!-- string -->
                    <div v-if="data.type == 'string'" class="control">
                        <input
                            class="input"
                            type="text"
                            :name="key"
                            :id="'input_' + key"
                            v-model="settingsData[key]"
                        />
                    </div>

                    <!-- number -->
                    <div v-if="data.type == 'number'" class="control">
                        <input
                            class="input"
                            type="number"
                            :name="key"
                            :id="'input_' + key"
                            v-model="settingsData[key]"
                        />
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
                    <button class="button is-confirm" type="button" @click="saveSettings"><span class="icon"><i class="fa fa-save"></i></span> Save</button>
                </div>
            </div>
        
        </section>

    </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
// import HelloWorld from "@/components/HelloWorld.vue"; // @ is an alias to /src

import type { ApiSettingsField } from "@/twitchautomator.d";

export default defineComponent({
    name: "Settings",
    data() {
        return {
            settingsData: [],
            settingsFields: Array as () => ApiSettingsField[],
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
                    console.log(json);
                    this.settingsData = json.data.config;
                    this.settingsFields = json.data.fields;
                });
        },
        saveSettings(){
            alert("save form");
        }
    },
    components: {
        // HelloWorld
    },
});
</script>
