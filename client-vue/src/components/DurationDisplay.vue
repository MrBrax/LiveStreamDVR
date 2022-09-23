<template>
    <span>{{ timeString }}</span>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { intervalToDuration, parseJSON } from "date-fns";

export default defineComponent({
    name: "DurationDisplay",
    props: {
        startDate: { type: [String, Number], default: "0", },
        outputStyle: { type: String, default: "human", }
    },
    data() {
        return {
            interval: 0,
            timeString: "??:??",
        };
    },
    watch: {
        startDate(a, b) {
            console.debug("DurationDisplay: startDate changed", a, b);
            this.refreshTime();
        },
    },
    mounted() {
        this.refreshTime();
        console.debug("Starting interval");
        this.interval = window.setInterval(() => {
            this.refreshTime();
        }, 1000);
    },
    unmounted() {
        if (this.interval) {
            console.debug("Clearing interval");
            clearTimeout(this.interval);
        }
    },
    methods: {
        refreshTime() {
            if (!this.startDate || this.startDate == "0") return;
            const dateObj = parseJSON(this.startDate);
            // const dur = intervalToDuration({ start: dateObj, end: new Date() });
            const totalSeconds = Math.abs(Math.floor((new Date().getTime() - dateObj.getTime()) / 1000));
            if (this.outputStyle == "human") {
                
                // let str = "";
                // if (dur.hours && dur.hours > 0) str += `${dur.hours}h `;
                // if ((dur.minutes && dur.minutes > 0) || (dur.hours && dur.hours > 0)) str += `${dur.minutes}m `;
                // if ((dur.seconds && dur.seconds > 0) || (dur.minutes && dur.minutes > 0)) str += `${dur.seconds}s `;
                this.timeString = this.niceDuration(totalSeconds);
            } else if(this.outputStyle == "humanLong") {
                this.timeString = this.shortDuration(totalSeconds);
            } else if(this.outputStyle == "numbers") {
                this.timeString = this.formatDuration(totalSeconds);
            } else {
                this.timeString = "Invalid output style";
            }
            console.debug("updateTime", this.startDate, this.timeString);
        },
    },
});
</script>
