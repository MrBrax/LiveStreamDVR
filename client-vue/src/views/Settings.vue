<template>
  <div class="settings">
    <h1>Settings page</h1>
    <div class="field" v-for="(data, key) in settingsFields" v-bind:key="key">
      <label class="label" :for="key">{{ data.text }}</label>
      
      <div v-if="data.type == 'string'" class="control">
        <input class="input" type="text" :name="key" :id="key" v-model="settingsData[key]" />
      </div>

      <div v-if="data.type == 'number'" class="control">
        <input class="input" type="number" :name="key" :id="key" v-model="settingsData[key]" />
      </div>

      <div v-if="data.type == 'array'" class="control">
        <!--<input class="input" :name="key" :id="key" :value="settings[key]" />-->
          <select :name="key" :id="key" v-model="settingsData[key]">
            <option v-for="item in data.choices" :key="item">
              {{ item }}
            </option>
          </select>
      </div>

    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
// import HelloWorld from "@/components/HelloWorld.vue"; // @ is an alias to /src

export default defineComponent({
  name: "Settings",
  data() {
    return {
      settingsData: [],
      settingsFields: [],
    };
  },
  created() {
    this.fetchData();
  },
  methods: {
    fetchData() {
      this.settingsData = [];
      this.settingsFields = [];
      fetch("/api/v0/settings/list")
        .then((response) => response.json())
        .then((json) => {
          console.log(json);
          this.settingsData = json.data.config;
          this.settingsFields = json.data.fields;
        });
    },
  },
  components: {
    // HelloWorld
  },
});
</script>