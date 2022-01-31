import { ApiChannel, ApiConfig, ApiJob, ApiVod } from "@/twitchautomator";
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
        updateStreamerList(state, data: ApiChannel[]) {
            (state as any).streamerList = data;
        },
        updateVod(state, vod: ApiVod) {
            const streamer_login = vod.streamer_login;
            const vod_basename = vod.basename;
            console.log("updateVod", (state as any).streamerList);
            for (const streamer of (state as any).streamerList as ApiChannel[]) {
                if (streamer.login === streamer_login) {
                    for (let streamer_vod of streamer.vods_list) {
                        if (streamer_vod.basename === vod_basename) {
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
