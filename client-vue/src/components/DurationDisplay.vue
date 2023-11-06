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

const props = defineProps<{
    startDate: string | number | Date;
    outputStyle?: "human" | "humanLong" | "numbers";
}>();

// interval counter
const interval = ref<number>(0);

// the time string to display, updated every second and when the start date changes
const timeString = ref<string>("??:??");

// update the time string when the start date changes
watch(
    () => props.startDate,
    () => {
        refreshTime();
    },
);

// start the interval when the component is mounted
onMounted(() => {
    refreshTime();
    // start the interval on a rounded second
    const now = new Date();
    const delay = 1000 - now.getMilliseconds();
    window.setTimeout(() => {
        interval.value = window.setInterval(refreshTime, 1000);
    }, delay);
});

// clear the interval when the component is unmounted
onUnmounted(() => {
    if (interval.value) {
        console.debug("Clearing interval");
        window.clearTimeout(interval.value);
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
