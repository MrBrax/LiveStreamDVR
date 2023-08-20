<template>
    <span class="duration-display" :data-date="startDate">{{ timeString }}</span>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted, ref, watch } from "vue";
import { isDate, parseJSON } from "date-fns";
import { humanDuration, niceDuration, shortDuration } from "@/mixins/newhelpers";
/**
 * Shows duration in a human readable format that auto updates every second.
 * @param startDate The start date of the duration.
 * @param outputStyle The output style of the duration.
 */

const props = defineProps({
    startDate: { type: [String, Number, Date], default: "0" },
    outputStyle: { type: String, default: "human" },
});

const interval = ref(0);
const timeString = ref("??:??");

watch(
    () => props.startDate,
    (a, b) => {
        refreshTime();
    },
);

onMounted(() => {
    refreshTime();
    // start the interval on a rounded second
    const now = new Date();
    const delay = 1000 - now.getMilliseconds();
    setTimeout(() => {
        interval.value = window.setInterval(refreshTime, 1000);
    }, delay);
});

onUnmounted(() => {
    if (interval.value) {
        console.debug("Clearing interval");
        clearTimeout(interval.value);
    }
});

const refreshTime = () => {
    if (!props.startDate || props.startDate == "0") {
        timeString.value = "??:??";
        return;
    }
    const dateObj = parseJSON(props.startDate);
    if (!isDate(dateObj)) {
        timeString.value = "??:??";
        return;
    }
    // const dur = intervalToDuration({ start: dateObj, end: new Date() });
    const totalSeconds = Math.abs(Math.floor((new Date().getTime() - dateObj.getTime()) / 1000));
    if (props.outputStyle == "human") {
        // let str = "";
        // if (dur.hours && dur.hours > 0) str += `${dur.hours}h `;
        // if ((dur.minutes && dur.minutes > 0) || (dur.hours && dur.hours > 0)) str += `${dur.minutes}m `;
        // if ((dur.seconds && dur.seconds > 0) || (dur.minutes && dur.minutes > 0)) str += `${dur.seconds}s `;
        timeString.value = niceDuration(totalSeconds);
    } else if (props.outputStyle == "humanLong") {
        timeString.value = shortDuration(totalSeconds);
    } else if (props.outputStyle == "numbers") {
        timeString.value = humanDuration(totalSeconds);
    } else {
        timeString.value = "Invalid output style";
    }
};
</script>
