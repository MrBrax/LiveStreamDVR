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
        /*
        fetchStreamerList(state) {

            this.$http.get(`/api/v0/channels/list`)
            .then((response) => {
                if(!response.data.data){
                    console.error("fetchStreamers invalid data", response.data);
                    return;
                }
                this.totalSize = response.data.data.total_size;
                this.freeSize = response.data.data.free_size;
                (state as any).streamerList = response.data.data.streamer_list;
            }).catch((err) => {
                console.error("fetchStreamerList error", err.response);
            });

        },
        */
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
