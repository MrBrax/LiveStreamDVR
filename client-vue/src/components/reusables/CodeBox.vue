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
            <font-awesome-icon :icon="hasCopied ? 'check' : 'copy'" />
        </span>
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
.code-box {
    display: inline-block;
    padding: 0.15rem 0.3rem;
    border-radius: 0.25rem;
    background-color: #f5f5f5;
    font-family: monospace;
    font-size: 0.95em;
    cursor: pointer;
    transition: background-color 0.2s ease-in-out;

    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.1);

    &:hover {
        background-color: #e5e5e5;
    }

    .icon {
        margin-left: 0.25rem;
        font-size: 0.8em;
    }

    &.is-flashing {
        animation: flash 0.5s ease-in-out;
    }

}
li > .code-box {
    margin: 0.15em 0;
}
</style>