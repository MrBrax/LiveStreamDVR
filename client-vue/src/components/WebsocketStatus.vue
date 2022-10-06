<template>
    <div
        ref="js-status"
        :class="{ 'statustab': true, 'statustab-update': true, disconnected: websocket && !websocketConnected }"
    >
        <span v-if="store.loading">
            <span class="icon"><fa
                icon="sync"
                spin
            /></span> Store...
        </span>
        <div v-if="store.clientCfg('useWebsockets') && websocket">
            {{ websocketConnected ? $t('components.status.connected') : websocketConnecting ? $t('components.status.connecting') : $t('components.status.disconnected') }}
        </div>
        <div v-else-if="tickerInterval && store.clientCfg('useBackgroundTicker')">
            {{ loading ? $t('messages.loading') : $t('components.status.refreshing-in-x-seconds', [timer]) }}
        </div>
        <div v-else>
            {{ $t('components.status.disabled') }}
        </div>
    </div>
</template>

<script lang="ts" setup>
import { useStore } from "@/store";
import { faTimes, faSync, faExclamationTriangle, faClock, faCircle } from "@fortawesome/free-solid-svg-icons";
import { library } from "@fortawesome/fontawesome-svg-core";
library.add(faSync, faTimes, faExclamationTriangle, faClock, faCircle);

/*
export default defineComponent({
    name: "WebsocketStatus",
    props: {
        websocket: {
            type: WebSocket,
            required: true,
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
            required: true,
        },
        tickerInterval: {
            type: Number,
            required: true,
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
*/

const store = useStore();

const props = defineProps({
    websocket: {
        type: WebSocket,
        default: undefined,
        // required: true,
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
        required: true,
    },
    tickerInterval: {
        type: Number,
        required: true,
    },
    loading: {
        type: Boolean,
    },
});

</script>