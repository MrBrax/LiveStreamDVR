<template>
    <span>{{ timeString }}</span>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted, ref, watch } from "vue";
import { parseJSON } from "date-fns";
import { formatDuration, niceDuration, shortDuration } from "@/mixins/newhelpers";

const props = defineProps({
    startDate: { type: [String, Number, Date], default: "0", },
    outputStyle: { type: String, default: "human", }
});

const interval = ref(0);
const timeString = ref("??:??");

watch(() => props.startDate, (a, b) => {
    console.debug("DurationDisplay: startDate changed", a, b);
    refreshTime();
});


onMounted(() => {
    refreshTime();
    console.debug("Starting interval");
    interval.value = window.setInterval(() => {
        refreshTime();
    }, 1000);
});

onUnmounted(() => {
    if (interval.value) {
        console.debug("Clearing interval");
        clearTimeout(interval.value);
    }
});

const refreshTime = () => {
    if (!props.startDate || props.startDate == "0") return;
    const dateObj = parseJSON(props.startDate);
    // const dur = intervalToDuration({ start: dateObj, end: new Date() });
    const totalSeconds = Math.abs(Math.floor((new Date().getTime() - dateObj.getTime()) / 1000));
    if (props.outputStyle == "human") {
        // let str = "";
        // if (dur.hours && dur.hours > 0) str += `${dur.hours}h `;
        // if ((dur.minutes && dur.minutes > 0) || (dur.hours && dur.hours > 0)) str += `${dur.minutes}m `;
        // if ((dur.seconds && dur.seconds > 0) || (dur.minutes && dur.minutes > 0)) str += `${dur.seconds}s `;
        timeString.value = niceDuration(totalSeconds);
    } else if(props.outputStyle == "humanLong") {
        timeString.value = shortDuration(totalSeconds);
    } else if(props.outputStyle == "numbers") {
        timeString.value = formatDuration(totalSeconds);
    } else {
        timeString.value = "Invalid output style";
    }
    console.debug("updateTime", props.startDate, timeString);
};
   
</script>
