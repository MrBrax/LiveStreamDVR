<template>
    <slot
        ref="trigger"
        name="trigger"
        :open="open"
    />
    <Teleport to="body">
        <div
            v-if="showMenu"
            class="context-menu-blackout"
            tabindex="0"
            aria-label="Close context menu"
            role="button"
            @click="close"
        />
        <Transition name="blinds">
            <div
                v-if="showMenu"
                ref="context"
                class="context-menu"
                :style="contextStyle"
                role="menu"
            >
                <slot name="entries" />
            </div>
        </Transition>
    </Teleport>
</template>

<script lang="ts" setup>
import { computed, nextTick, ref, useSlots, watch } from "vue";

const showMenu = ref(false);
// const slots = useSlots();
// const moreMenuTrigger = ref<HTMLElement | null>(null);
const context = ref<HTMLElement | null>(null);
const contextX = ref(0);
const contextY = ref(0);

function open(event: MouseEvent) {
    event.stopPropagation();
    showMenu.value = !showMenu.value;
    if (showMenu.value){
        document.addEventListener("keydown", keyDown);
        nextTick(() => {
            positionMenu(event);
            const buttons = context.value?.querySelectorAll("button");
            if (buttons) {
                buttons.forEach((button) => {
                    button.addEventListener("click", close);
                });
            } else {
                console.error("no buttons to add");
            }
        });
    } else {
        
    }
    // if (!slots.trigger) return;
    // const trigger = slots.trigger;
    console.log("open", event);
}

function close() {
    showMenu.value = false;
    document.removeEventListener("keydown", keyDown);
    const buttons = context.value?.querySelectorAll("button");
    if (buttons) {
        buttons.forEach((button) => {
            button.removeEventListener("click", close);
        });
    } else {
        console.error("no buttons to remove");
    }
}

function positionMenu(event: MouseEvent) {
    const contextMenu = context.value;
    const trigger = event.target as HTMLElement;
    if (!contextMenu || !trigger) {
        console.error("No context menu or trigger");
        return;
    }
    let x = 0, y = 0;
    if (event.pageX === 0 && event.pageY === 0) { // If the event is a keyboard event
        const rect = trigger.getBoundingClientRect();
        x = rect.left + 8;
        y = rect.top + 8;
        console.log("positionMenu keyboard", x, y);
        contextMenu.querySelector("button")?.focus(); // Focus the first button
    } else {
        x = event.pageX + 8;
        y = event.pageY + 8;
        console.log("positionMenu mouse", x, y);
    }

    // TODO: limit the menu to the screen

    contextX.value = x;
    contextY.value = y;    
}

function keyDown(event: KeyboardEvent) {
    console.debug("keyDown", event);
    const buttons = context.value?.querySelectorAll("button");
    if (event.key === "Escape") {
        close();
    } else if (event.key === "Tab") {
        event.preventDefault();
        if (!buttons) return;
        const current = document.activeElement as HTMLButtonElement;
        const index = Array.from(buttons).indexOf(current);
        if (event.shiftKey) {
            if (index === 0) {
                buttons[buttons.length - 1].focus();
            } else {
                buttons[index - 1].focus();
            }
        } else {
            if (index === buttons.length - 1) {
                buttons[0].focus();
            } else {
                buttons[index + 1]?.focus();
            }
        }
    } else if (event.key === "ArrowUp") {
        event.preventDefault();
        if (!buttons) return;
        const current = document.activeElement as HTMLButtonElement;
        const index = Array.from(buttons).indexOf(current);
        if (index === 0) {
            buttons[buttons.length - 1].focus();
        } else {
            buttons[index - 1].focus();
        }
    } else if (event.key === "ArrowDown") {
        event.preventDefault();
        if (!buttons) return;
        const current = document.activeElement as HTMLButtonElement;
        const index = Array.from(buttons).indexOf(current);
        if (index === buttons.length - 1) {
            buttons[0].focus();
        } else {
            buttons[index + 1]?.focus();
        }
    } else if (event.key == "Home") {
        event.preventDefault();
        if (!buttons) return;
        buttons[0].focus();
    } else if (event.key == "End") {
        event.preventDefault();
        if (!buttons) return;
        buttons[buttons.length - 1].focus();
    }
}

const contextStyle = computed(() => {
    return {
        left: `${contextX.value}px`,
        top: `${contextY.value}px`,
    };
});

defineExpose({ open, showMenu });

</script>

<style lang="scss">
.context-menu-blackout {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 100;
}

.context-menu {
    position: absolute;
    background-color: #222;
    border: 1px solid #000;
    color: #fff;
    width: 200px;
    z-index: 200;
    overflow: hidden;
    box-shadow: 0 5px 10px 0 rgba(0, 0, 0, 0.5);
    border-radius: 5px;

    // &::before {
    //     content: "";
    //     position: fixed;
    //     top: 0;
    //     left: 0;
    //     right: 0;
    //     bottom: 0;
    //     background-color: #000;
    //     opacity: 0.2;
    //     z-index: -1;
    // }
    ul {
        list-style: none;
        padding: 0;
        margin: 0;
        li {
            padding: 0;
            margin: 0;
        }
    }
}
.context-menu-button {
    display: block;
    width: 100%;
    text-align: left;
    padding: 0.5em;
    background: transparent;
    color: #fff;
    border: none;
    cursor: pointer;
    .icon {
        transition: margin-right 0.1s ease-in-out;
        margin-right: 0.5em;
    }
    &:not(:last-child) {
        margin-bottom: 0.2em;
    }
    &:hover, &:focus {
        background-color: #333;
        color: #ff0;
        .icon {
            margin-right: 0.6em;
        }
    }
}

.context-menu-header {
    display: none;
}

@media screen and (orientation: portrait) {
    .context-menu {
        position: fixed;
        // TODO: don't use !important
        left: 1em !important;
        right: 1em !important;
        bottom: 4em !important;
        top: unset !important;
        width: auto;
        // width: 100%;
        // height: 100%;
        border-radius: 0;
    
        .context-menu-button {
            padding: 1em;
        }
        .context-menu-header {
            display: block;
            padding: 1em !important;
            background-color: #252525;
            color: #fff;
            border-bottom: 1px solid #000;
            font-weight: bold;
        }
    }
}

</style>