import { ApiStreamer, ApiConfig } from "@/twitchautomator";
import { createStore } from "vuex";

export default createStore({
    state() {
        // eslint-disable-next-line no-unused-labels
        streamerList: [];

        // eslint-disable-next-line no-unused-labels
        config: [];

        // eslint-disable-next-line no-unused-labels
        version: "";

        // eslint-disable-next-line no-unused-labels
        clientConfig: [];
    },
    mutations: {
        updateStreamerList(state, data: ApiStreamer[]) {
            (state as any).streamerList = data;
        },
        updateConfig(state, data: ApiConfig[]) {
            (state as any).config = data;
        },
        updateClientConfig(state, data: Record<string, any>) {
            (state as any).clientConfig = data;
        },
        updateVersion(state, data: number) {
            (state as any).version = data;
        }
    },
    actions: {},
    modules: {}
});
