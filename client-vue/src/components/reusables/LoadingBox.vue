<template>
    <div class="loading">
        <span class="icon"><fa
            icon="sync"
            spin
        /></span> {{ t("messages.loading") }}
        <div
            v-if="tookTooLong"
            class="tooktoolong"
        >
            <span class="icon"><fa
                icon="exclamation-triangle"
            /></span> {{ t("messages.loading-takes-longer-than-expected") }} {{ timeTaken }}s
        </div>
    </div>
</template>

<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import { library } from "@fortawesome/fontawesome-svg-core";
import { faSync, faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";
import { onBeforeUnmount, onMounted, ref } from "vue";

library.add(faSync, faExclamationTriangle);

const { t } = useI18n();

const tookTooLong = ref(false);
const timeout = ref<number>();
const startLoad = ref<Date>();
const ticker = ref<number>();
const timeTaken = ref<string>();

onMounted(() => {
    timeout.value = window.setTimeout(() => {
        tookTooLong.value = true;
    }, 5000);

    startLoad.value = new Date();
    ticker.value = window.setInterval(() => {
        if (!startLoad.value) {
            return;
        }
        const now = new Date();
        const diff = now.getTime() - startLoad.value.getTime();
        // seconds with 1 decimal
        timeTaken.value = (diff / 1000).toFixed(1);        
    }, 100);
});

onBeforeUnmount(() => {
    window.clearTimeout(timeout.value);
    window.clearInterval(ticker.value);
});

</script>

<style lang="scss" scoped>
.loading {
    /*
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 2em;
    font-weight: 700;
    text-shadow: 0 0 10px #000;
    */
    padding: 1em;
    background-color: rgba(59, 160, 255, 0.1);
    border-radius: 1em;
    animation: pulse 1s infinite ease-in-out;
}

@keyframes pulse {
    0% {
        background-color: rgba(59, 160, 255, 0.1);
    }
    50% {
        background-color: rgba(59, 160, 255, 0.2);
    }
    100% {
        background-color: rgba(59, 160, 255, 0.1);
    }
}

.tooktoolong {
    margin-top: 1em;
    font-size: 0.9em;
    font-weight: 400;
    color: #ff9900;
    text-shadow: none;
}
</style>