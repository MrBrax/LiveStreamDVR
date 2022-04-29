<template>
   <div id="js-status" :class="{ disconnected: websocket && !websocketConnected }" ref="js-status">
        <template v-if="websocket">
            {{ websocketConnected ? "Connected" : websocketConnecting ? "Connecting..." : "Disconnected" }}
        </template>
        <template v-else>Disabled</template>
    </div>
</template>

<script lang="ts">
import { useStore } from "@/store";
import { JobStatus } from "@common/Defs";
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
    },
    setup() {
        const store = useStore();
        return { store };
    },
});
</script>