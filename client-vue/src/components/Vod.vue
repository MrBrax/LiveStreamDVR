<template>
  <div
    :class="{
      'is-recording': vod.is_capturing,
      'is-converting': vod.is_converting,
      'is-finalized': vod.is_finalized,
      'is-favourite': vod.hasFavouriteGame,
    }"
  >
    <div :id="'vod_' + vod.basename" class="anchor"></div>

    <!-- title -->
    <div class="video-title">
      <h3>
        <span class="icon"><i class="fas fa-file-video"></i></span>
        <span class="video-date" v-if="vod.dt_started_at">{{ startedAt }}</span>
        <span class="video-filename">{{ vod.basename }}</span>
      </h3>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";

import type { ApiVod } from "@/twitchautomator.d";

import { format, toDate, parse } from 'date-fns';

const dateFormat = "yyyy-MM-dd HH:mm:ss.SSSSSS"; // 2020-11-03 02:48:01.000000

export default defineComponent({
  name: "Vod",
  props: {
    vod: Object as () => ApiVod,
  },
  computed: {
      startedAt() : string {
          if(!this.vod) return "";
          return format(parse(this.vod.dt_started_at.date, dateFormat, new Date()), "yyyy-MM-dd");
      }
  }
});
</script>
