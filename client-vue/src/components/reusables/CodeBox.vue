<template>
    <span
        class="code-box"
        :class="{
            'is-flashing': isFlashing,
        }"
        @click="copyText"
    >
        <slot />
        <span class="icon">
            <font-awesome-icon :icon="isFlashing ? 'check' : 'copy'" />
        </span>
        <span 
            v-if="isFlashing"
            class="tooltip"
        >Copied!</span>
    </span>
</template>

<script lang="ts" setup>
import { computed, ref, useSlots } from 'vue';
import { library } from "@fortawesome/fontawesome-svg-core";
import { faCopy, faCheck } from "@fortawesome/free-solid-svg-icons";
library.add(faCopy, faCheck);

const slots = useSlots();
const isFlashing = ref(false);
const hasCopied = ref(false);

const slotText = computed((): string => {
    if (!slots || !slots.default) return "";
    return slots.default()[0].children?.toString().trim() || "";
});

function copyText() {
    console.debug("copyText", slotText.value);
    navigator.clipboard.writeText(slotText.value);
    hasCopied.value = true;
    flashBox();
}

function flashBox() {
    isFlashing.value = true;
    setTimeout(() => {
        isFlashing.value = false;
    }, 1000);
}

</script>

<style lang="scss" scoped>
.code-box {
    position: relative;
    display: inline-block;
    padding: 0.15rem 0.3rem;
    border-radius: 0.25rem;
    background-color: var(--codebox-background-color);
    font-family: monospace;
    font-size: 0.95em;
    cursor: pointer;
    transition: background-color 0.2s ease-in-out;

    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.1);

    &:hover {
        background-color: var(--codebox-hover-background-color);
    }

    .icon {
        margin-left: 0.25rem;
        font-size: 0.8em;
    }

    &.is-flashing {
        animation: flash 0.5s ease-in-out;
    }

}

.tooltip {
    position: absolute;
    text-align: center;
    // top: 0;
    left: calc(50% - 1.5rem);
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    background-color: rgba(0, 0, 0, 0.8);
    color: white;
    font-size: 0.8em;
    font-weight: bold;
    text-transform: uppercase;
    white-space: nowrap;
    // opacity: 0;
    // transition: opacity 0.2s ease-in-out;
    pointer-events: none;
    animation: tooltip 1s ease-in-out;

    &.is-visible {
        opacity: 1;
    }
}
li > .code-box {
    margin: 0.15em 0;
}

@keyframes flash {
    0% {
        background-color: #f5f5f5;
    }
    50% {
        background-color: #4bbd50;
    }
    100% {
        background-color: #f5f5f5;
    }
}

@keyframes tooltip {
    0% {
        opacity: 0;
        transform: translateY(0rem);
    }
    75% {
        opacity: 1;
        transform: translateY(-1rem);
    }
    100% {
        opacity: 0;
        transform: translateY(-1rem);
    }
}
</style>