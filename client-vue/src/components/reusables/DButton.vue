<template>
    <button
        class="button"
        :class="buttonClass"
        @click="onClick"
    >
        <span
            v-if="icon"
            class="icon"
        >
            <font-awesome-icon
                :icon="icon"
                :spin="iconSpin"
            />
        </span>
        <span v-if="slots.default"><slot /></span>
        <span v-else>{{ text }}</span>
    </button>
</template>

<script lang="ts" setup>
import { computed, useSlots } from 'vue';

const slots = useSlots();

const props = defineProps<{
    onClick: () => void;
    buttonClass: string;
    icon?: string;
    iconSpin?: boolean;
    loading?: boolean;
    text?: string;
}>();

const properIcon = computed(() => {
    if (props.loading) {
        return 'spinner';
    }
    return props.icon;
});

</script>