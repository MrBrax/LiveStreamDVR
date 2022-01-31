import { ApiChannel, ApiConfig, ApiJob, ApiVod, ClientSettings } from "@/twitchautomator";
import { defineStore } from "pinia";

export const useStore = defineStore("twitchAutomator", {
    state: () => {
        return {
            streamerList: [] as ApiChannel[],
            jobList: [] as ApiJob[],
            config: {} as ApiConfig | null,
            version: "",
            clientConfig: {} as ClientSettings,
        };
    },
    actions: {
        updateStreamerList(data: ApiChannel[]) {
            this.streamerList = data;
        },
        updateVod(vod: ApiVod) {
            const streamer_login = vod.streamer_login;
            const vod_basename = vod.basename;
            console.log("updateVod", this.streamerList);
            for (const streamer of this.streamerList as ApiChannel[]) {
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
        updateJobList(data: ApiJob[]) {
            this.jobList = data;
        },
        updateConfig(data: ApiConfig | null) {
            this.config = data;
        },
        updateClientConfig(data: ClientSettings) {
            this.clientConfig = data;
        },
        updateVersion(data: string) {
            this.version = data;
        },
    },
});
