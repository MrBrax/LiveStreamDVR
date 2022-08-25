<template>
    <span>{{ timeString }}</span>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { intervalToDuration, parseJSON } from "date-fns";

export default defineComponent({
    name: "DurationDisplay",
    props: ["startDate", "outputStyle"],
    data() {
        return {
            interval: 0,
            timeString: "??:??",
        };
    },
    mounted() {
        this.refreshTime();
        this.interval = window.setInterval(() => {
            this.refreshTime();
        }, 1000);
    },
    unmounted() {
        if (this.interval) {
            clearTimeout(this.interval);
        }
    },
    methods: {
        refreshTime() {
            if (!this.startDate) return;
            const dateObj = parseJSON(this.startDate);
            const dur = intervalToDuration({ start: dateObj, end: new Date() });
            if (this.outputStyle == "human") {
                let str = "";
                if (dur.hours && dur.hours > 0) str += `${dur.hours}h `;
                if ((dur.minutes && dur.minutes > 0) || (dur.hours && dur.hours > 0)) str += `${dur.minutes}m `;
                if ((dur.seconds && dur.seconds > 0) || (dur.minutes && dur.minutes > 0)) str += `${dur.seconds}s `;
                this.timeString = str.trim();
            } else {
                this.timeString =
                    dur.hours?.toString().padStart(2, "0") + ":" + dur.minutes?.toString().padStart(2, "0") + ":" + dur.seconds?.toString().padStart(2, "0");
            }
        },
    },
});
</script>
