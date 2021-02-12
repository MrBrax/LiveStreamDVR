import { ApiStreamer, ApiConfig, ApiJob, ApiVod } from "@/twitchautomator";
import { createStore } from "vuex";

export default createStore({
    state() {
        // eslint-disable-next-line no-unused-labels
        streamerList: [];

        // eslint-disable-next-line no-unused-labels
        jobList: [];

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
        updateVod(state, vod: ApiVod){
            const streamer_name = vod.streamer_name;
            const vod_basename = vod.basename;
            console.log("updateVod", (state as any).streamerList);
            for (const streamer of (state as any).streamerList as ApiStreamer[]){
                if (streamer.username === streamer_name) {
                    for (let streamer_vod of streamer.vods_list){
                        if(streamer_vod.basename === vod_basename){
                            streamer_vod = vod;
                            console.log("replaced");
                        }
                    }
                    break;
                }
            }
        },
        updateJobList(state, data: ApiJob[]) {
            (state as any).jobList = data;
        },
        updateConfig(state, data: ApiConfig[]) {
            (state as any).config = data;
        },
        updateClientConfig(state, data: Record<string, any>) {
            (state as any).clientConfig = data;
        },
        updateVersion(state, data: number) {
            (state as any).version = data;
        },
    },
    actions: {},
    modules: {},
});
