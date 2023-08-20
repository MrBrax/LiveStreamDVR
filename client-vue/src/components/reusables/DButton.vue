<template>
    <button :class="buttonClass" @click="onClick">
        <span v-if="icon" class="icon">
            <font-awesome-icon :icon="properIcon" :spin="iconSpin" />
        </span>
        <span v-if="slots.default"><slot /></span>
        <span v-else>{{ text }}</span>
    </button>
</template>

<script lang="ts" setup>
import { computed, useSlots } from "vue";

const slots = useSlots();

const props = defineProps<{
    onClick: () => void;
    color?: string;
    // buttonClass: string;
    icon?: string;
    iconSpin?: boolean;
    loading?: boolean;
    text?: string;
    size?: "small";
}>();

const properIcon = computed(() => {
    if (props.loading) {
        return "spinner";
    }
    return props.icon;
});

const buttonClass = computed((): Record<string, boolean> => {
    const classes: Record<string, boolean> = {
        button: true,
        // 'is-loading': props.loading,
        "is-small": props.size === "small",
    };
    if (props.color) {
        classes[`is-${props.color}`] = true;
    }
    return classes;
});
</script>
