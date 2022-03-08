import { ApiChannel, ApiConfig, ApiJob, ApiVod, ClientSettings } from "@/twitchautomator";
import axios from "axios";
import { defineStore } from "pinia";

export const useStore = defineStore("twitchAutomator", {
    state: () => {
        return {
            streamerList: [] as ApiChannel[],
            jobList: [] as ApiJob[],
            config: {} as ApiConfig | null,
            version: "",
            clientConfig: {} as ClientSettings,
            serverType: "",
        };
    },
    actions: {
        cfg<T>(key: string, def: T | null = null): T | null {
            const k: keyof ApiConfig = key as keyof ApiConfig;
            if (!this.config) return null;
            // if (!key in this.config) return def;
            if (this.config[k] === undefined || this.config[k] === null) return def;
            return this.config[k] as unknown as T;
        },
        async fetchStreamerList() {
            console.debug("fetchStreamerList");
            let response;
            try {
                response = await axios.get(`/api/v0/channels`);
            } catch (error) {
                console.error(error);
                return false;
            }

            if (!response.data.data) {
                console.error("fetchStreamers invalid data", response.data);
                return false;
            }

            const data: { streamer_list: ApiChannel[]; total_size: number; free_size: number } = response.data.data;

            // this.streamerList = data.streamer_list;
            return data;
        },
        async fetchVod(basename: string) {
            let response;
            try {
                response = await axios.get(`/api/v0/vod/${basename}`);
            } catch (error) {
                console.error("fetchVod error", error);
                return false;
            }
            if (!response.data.data) return false;
            const vod: ApiVod = response.data.data;
            return vod;
        },
        async updateVod(basename: string) {
            const vod = await this.fetchVod(basename);
            if (!vod) return false;

            const index = this.streamerList.findIndex((s) => s.userid === vod.streamer_id);
            if (index === -1) return false;

            // check if vod is already in the streamer's vods
            const vodIndex = this.streamerList[index].vods_list.findIndex((v) => basename === v.basename);

            if (vodIndex === -1) {
                this.streamerList[index].vods_list.push(vod);
                console.debug("inserted vod", vod);
            } else {
                this.streamerList[index].vods_list[vodIndex] = vod;
                console.debug("updated vod", vod);
            }
            return true;
        },
        async updateCapturingVods() {
            this.streamerList.forEach((streamer) => {
                streamer.vods_list.forEach((vod) => {
                    if (vod.is_capturing) {
                        console.debug("updateCapturingVods", vod.basename);
                        this.updateVod(vod.basename);
                    }
                });
            });
        },
        async fetchStreamer(login: string) {
            let response;
            try {
                response = await axios.get(`/api/v0/channels/${login}`);
            } catch (error) {
                console.error("fetchStreamer error", error);
                return false;
            }
            if (!response.data.data) return false;
            const streamer: ApiChannel = response.data.data;
            return streamer;
        },
        async updateStreamer(login: string) {
            const streamer = await this.fetchStreamer(login);
            if (!streamer) return false;

            const index = this.streamerList.findIndex((s) => s.login === login);
            if (index === -1) return false;

            this.streamerList[index] = streamer;
            console.debug("updated streamer", streamer);
            return true;
        },
        updateStreamerList(data: ApiChannel[]) {
            console.debug("updateStreamerList", data);
            this.streamerList = data;
        },
        /*
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
        */
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
        updateServerType(data: string) {
            this.serverType = data;
        },
        fetchClientConfig() {
            // client config
            console.debug("fetchClientConfig");
            const currentClientConfig = localStorage.getItem("twitchautomator_config")
                ? JSON.parse(localStorage.getItem("twitchautomator_config") as string)
                : {};
            this.updateClientConfig(currentClientConfig);
        },
    },
});
