<template>
   <div id="js-status" :class="{ disconnected: websocket && !websocketConnected }" ref="js-status">
        <div v-if="store.clientCfg('useWebsockets') && websocket">
            {{ websocketConnected ? "Connected" : websocketConnecting ? "Connecting..." : "Disconnected" }}
        </div>
        <div v-else-if="tickerInterval && store.clientCfg('useBackgroundTicker')">
            {{ loading ? "Loading..." : `Refreshing in ${timer} seconds.` }}
        </div>
        <div v-else>
            Disabled
        </div>
    </div>
</template>

<script lang="ts">
import { useStore } from "@/store";
import { defineComponent } from "vue";
import { faTimes, faSync, faExclamationTriangle, faClock, faCircle } from "@fortawesome/free-solid-svg-icons";
import { library } from "@fortawesome/fontawesome-svg-core";
library.add(faSync, faTimes, faExclamationTriangle, faClock, faCircle);

export default defineComponent({
    name: "WebsocketStatus",
    props: {
        websocket: {
            type: WebSocket,
        },
        websocketConnected: {
            type: Boolean,
            required: true,
        },
        websocketConnecting: {
            type: Boolean,
            required: true,
        },
        timer: {
            type: Number,
        },
        tickerInterval: {
            type: Number,
        },
        loading: {
            type: Boolean,
        },
    },
    setup() {
        const store = useStore();
        return { store };
    },
});
</script>