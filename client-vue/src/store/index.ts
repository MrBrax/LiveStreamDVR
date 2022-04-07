import { ApiChannel, ApiJob, ApiVod } from "../../../common/Api/Client";
import { ApiChannelResponse, ApiChannelsResponse, ApiErrorResponse, ApiVodResponse } from "../../../common/Api/Api";
import axios from "axios";
import { defineStore } from "pinia";
import { ClientSettings } from "@/twitchautomator";

export const useStore = defineStore("twitchAutomator", {
    state: function (): {
        streamerList: ApiChannel[];
        jobList: ApiJob[];
        config: Record<string, any> | null;
        favourite_games: string[];
        version: string;
        clientConfig: ClientSettings | null;
        serverType: string;
        websocketUrl: string;
    } {
        return {
            streamerList: [],
            jobList: [],
            config: {},
            favourite_games: [],
            version: "",
            clientConfig: null,
            serverType: "",
            websocketUrl: "",
        };
    },
    actions: {
        // cfg<T>(key: string, def: T | null = null): T | null {
        //     const k: keyof ApiConfig = key as keyof ApiConfig;
        //     if (!this.config) return null;
        //     // if (!key in this.config) return def;
        //     if (this.config[k] === undefined || this.config[k] === null) return def;
        //     return this.config[k] as unknown as T;
        // },
        cfg(key: string, def: any = null): any {
            if (!this.config) return null;
            if (this.config[key] === undefined || this.config[key] === null) return def;
            return this.config[key];
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

            const data: ApiChannelsResponse | ApiErrorResponse = response.data;

            if (data.status === "ERROR") {
                console.error("fetchStreamerList", data.message);
                return false;
            }

            // this.streamerList = data.streamer_list;
            return data.data;
        },
        async fetchVod(basename: string) {
            let response;
            try {
                response = await axios.get(`/api/v0/vod/${basename}`);
            } catch (error) {
                console.error("fetchVod error", error);
                return false;
            }

            const data: ApiVodResponse | ApiErrorResponse = response.data;

            if (data.status === "ERROR") {
                console.error("fetchVod", data.message);
                return false;
            }

            return data.data;
        },
        async updateVodApi(basename: string) {
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
        updateVod(vod: ApiVod) {
            const index = this.streamerList.findIndex((s) => s.userid === vod.streamer_id);
            if (index === -1) return false;

            // check if vod is already in the streamer's vods
            const vodIndex = this.streamerList[index].vods_list.findIndex((v) => v.basename === vod.basename);

            if (vodIndex === -1) {
                this.streamerList[index].vods_list.push(vod);
                console.debug("inserted vod", vod);
            } else {
                this.streamerList[index].vods_list[vodIndex] = vod;
                console.debug("updated vod", vod);
            }
            return true;
        },
        removeVod(basename: string) {
            this.streamerList.forEach((s) => {
                const index = s.vods_list.findIndex((v) => v.basename === basename);
                if (index !== -1) {
                    s.vods_list.splice(index, 1);
                }
            });
        },
        async updateCapturingVods() {
            this.streamerList.forEach((streamer) => {
                streamer.vods_list.forEach((vod) => {
                    if (vod.is_capturing) {
                        console.debug("updateCapturingVods", vod.basename);
                        this.updateVodApi(vod.basename);
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
            if (!response.data) return false;
            const data: ApiChannelResponse | ApiErrorResponse = response.data;

            if (data.status === "ERROR") {
                console.error("fetchVod", data.message);
                return false;
            }

            const streamer: ApiChannel = data.data;

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
        updateJob(job: ApiJob) {
            const index = this.jobList.findIndex((j) => j.name === job.name);
            if (index === -1) {
                this.jobList.push(job);
            } else {
                this.jobList[index] = job;
            }
        },
        removeJob(name: string) {
            const index = this.jobList.findIndex((j) => j.name === name);
            if (index !== -1) {
                this.jobList.splice(index, 1);
            }
        },
        updateConfig(data: Record<string, any> | null) {
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
        updateFavouriteGames(data: string[]) {
            this.favourite_games = data;
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
