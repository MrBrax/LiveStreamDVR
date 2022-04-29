import { ApiChannel, ApiJob, ApiLogLine, ApiVod } from "../../../common/Api/Client";
import { ApiChannelResponse, ApiChannelsResponse, ApiErrorResponse, ApiJobsResponse, ApiVodResponse } from "../../../common/Api/Api";
import axios from "axios";
import { defineStore } from "pinia";
import { ClientSettings } from "@/twitchautomator";
import TwitchChannel from "@/core/channel";
import TwitchVOD from "@/core/vod";
import { defaultConfig } from "@/defs";

interface StoreType {
    app_name: string;
    streamerList: TwitchChannel[];
    streamerListLoaded: boolean;
    jobList: ApiJob[];
    config: Record<string, any> | null;
    favourite_games: string[];
    version: string;
    clientConfig: ClientSettings | undefined;
    serverType: string;
    websocketUrl: string;
    errors: string[];
    log: ApiLogLine[];
    diskTotalSize: number;
    diskFreeSize: number;
}

export const useStore = defineStore("twitchAutomator", {
    state: function (): StoreType {
        return {
            app_name: "",
            streamerList: [],
            streamerListLoaded: false,
            jobList: [],
            config: {},
            favourite_games: [],
            version: "",
            clientConfig: undefined,
            serverType: "",
            websocketUrl: "",
            errors: [],
            log: [],
            diskTotalSize: 0,
            diskFreeSize: 0,
        };
    },
    actions: {
        cfg(key: string, def: any = null): any {
            if (!this.config) return null;
            if (this.config[key] === undefined || this.config[key] === null) return def;
            return this.config[key];
        },
        clientCfg(key: keyof ClientSettings, def: any = undefined): any {
            if (!this.clientConfig) return undefined;
            if (this.clientConfig[key] === undefined || this.clientConfig[key] === null) return def;
            return this.clientConfig[key];
        },
        async fetchAndUpdateStreamerList() {
            const data = await this.fetchStreamerList();
            if (data){
                const channels = data.streamer_list.map((channel) => TwitchChannel.makeFromApiResponse(channel));
                this.streamerList = channels;
                this.streamerListLoaded = true;
                this.diskFreeSize = data.free_size;
                this.diskTotalSize = data.total_size;
            }
        },
        async fetchStreamerList() {
            let response;
            try {
                response = await axios.get(`/api/v0/channels`);
            } catch (error) {
                console.error(error);
                return false;
            }

            const data: ApiChannelsResponse | ApiErrorResponse = response.data;

            if (data.status === "ERROR") {
                // console.error("fetchStreamerList", data.message);
                return false;
            }
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
        async fetchAndUpdateVod(basename: string) {
            const vod_data = await this.fetchVod(basename);
            if (!vod_data) return false;

            // check if streamer is already in the list
            const index = this.streamerList.findIndex((s) => s.userid === vod_data.streamer_id);
            if (index === -1) return false;

            const vod = TwitchVOD.makeFromApiResponse(vod_data);

            return this.updateVod(vod);
        },
        updateVod(vod: TwitchVOD) {
            const index = this.streamerList.findIndex((s) => s.userid === vod.streamer_id);
            if (index === -1) return false;

            // check if vod is already in the streamer's vods
            const vodIndex = this.streamerList[index].vods_list.findIndex((v) => v.basename === vod.basename);

            if (vodIndex === -1) {
                this.streamerList[index].vods_list.push(vod);
                // console.debug("inserted vod", vod);
            } else {
                this.streamerList[index].vods_list[vodIndex] = vod;
                // console.debug("updated vod", vod);
            }
            return true;
        },
        updateVodFromData(vod_data: ApiVod) {
            const vod = TwitchVOD.makeFromApiResponse(vod_data);
            return this.updateVod(vod);
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
                        // console.debug("updateCapturingVods", vod.basename);
                        this.fetchAndUpdateVod(vod.basename);
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
        async fetchAndUpdateStreamer(login: string) {
            const streamer_data = await this.fetchStreamer(login);
            if (!streamer_data) return false;

            const index = this.streamerList.findIndex((s) => s.login === login);
            if (index === -1) return false;

            const streamer = TwitchChannel.makeFromApiResponse(streamer_data);

            this.streamerList[index] = streamer;
            console.debug("updated streamer", streamer);
            return true;
        },
        updateStreamerList(data: ApiChannel[]) {
            // console.debug("updateStreamerList", data);
            const channels = data.map((channel) => TwitchChannel.makeFromApiResponse(channel));
            this.streamerList = channels;
            this.streamerListLoaded = true;
        },
        updateErrors(data: string[]) {
            this.errors = data;
        },
        async fetchAndUpdateJobs() {
            let response;

            try {
                response = await axios.get(`/api/v0/jobs`);
            } catch (error) {
                console.error(error);
                return;
            }

            const json: ApiJobsResponse = response.data;
            this.updateJobList(json.data);
        },
        updateJobList(data: ApiJob[]) {
            console.debug(`Update job list with ${data.length} jobs`);
            this.jobList = data;
        },
        updateJob(job: ApiJob) {
            console.debug(`Update job '${job.name}', status: ${job.status}`);
            const index = this.jobList.findIndex((j) => j.name === job.name);
            if (index === -1) {
                this.jobList.push(job);
            } else {
                this.jobList[index] = job;
            }
        },
        removeJob(name: string) {
            console.debug(`Delete job '${name}'`);
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
            // console.debug("fetchClientConfig");
            const currentClientConfig = localStorage.getItem("twitchautomator_config")
                ? JSON.parse(localStorage.getItem("twitchautomator_config") as string)
                : {...defaultConfig};
            this.updateClientConfig(currentClientConfig);
        },
        getStreamers(): TwitchChannel[] {
            return this.streamerList;
        },
        addLog(lines: ApiLogLine[]) {
            this.log.push(...lines);
        },
        clearLog() {
            this.log = [];
        }
    },
    getters: {
        isAnyoneLive(state: StoreType): boolean {
            return this.channelsOnline > 0;
        },
        channelsOnline(): number {
            if (!this.streamerList) return 0;
            return this.streamerList.filter((a) => a.is_live).length;
        },
    },
});
