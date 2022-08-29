import { ApiChannel, ApiJob, ApiLogLine, ApiVod } from "../../../common/Api/Client";
import { ApiChannelResponse, ApiChannelsResponse, ApiErrorResponse, ApiJobsResponse, ApiSettingsResponse, ApiVodResponse } from "../../../common/Api/Api";
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
    // diskTotalSize: number;
    diskFreeSize: number;
    loading: boolean;
    authentication: boolean;
    authenticated: boolean;
    guest_mode: boolean;
    serverGitHash?: string;
}

export const useStore = defineStore("twitchAutomator", {
    state: function (): StoreType {
        return {
            app_name: "LiveStreamDVR",
            streamerList: [],
            streamerListLoaded: false,
            jobList: [],
            config: {},
            favourite_games: [],
            version: "?",
            clientConfig: undefined,
            serverType: "",
            websocketUrl: "",
            errors: [],
            log: [],
            // diskTotalSize: 0,
            diskFreeSize: 0,
            loading: false,
            authentication: false,
            authenticated: false,
            guest_mode: false,
            serverGitHash: "",
        };
    },
    actions: {
        cfg<T>(key: string, def?: T): T {
            if (!this.config) {
                console.error(`Config is not loaded, tried to get key: ${key}`);
                return <T><unknown>undefined;
            }
            if (this.config[key] === undefined || this.config[key] === null) return <T>def;
            return this.config[key];
        },
        clientCfg(key: keyof ClientSettings, def: any = undefined): any {
            if (!this.clientConfig) return undefined;
            if (this.clientConfig[key] === undefined || this.clientConfig[key] === null) return def;
            return this.clientConfig[key];
        },
        async fetchData() {
            // clear config
            this.updateConfig(null);

            let response;

            try {
                response = await axios.get(`/api/v0/settings`);
            } catch (error) {
                alert(error);
                return;
            }

            if (response.status !== 200) {
                alert("Non-200 response from server");
                return;
            }

            if (!response.data || !response.data.data) {
                alert("No data received for settings");
                return;
            }

            const data: ApiSettingsResponse = response.data;

            console.log(`Server type: ${data.data.server ?? "unknown"}`);

            this.updateConfig(data.data.config);
            this.updateVersion(data.data.version);
            this.updateServerType(data.data.server);
            this.updateFavouriteGames(data.data.favourite_games);
            this.updateErrors(data.data.errors ?? []);
            this.websocketUrl = data.data.websocket_url;
            this.app_name = data.data.app_name;
            this.serverGitHash = data.data.server_git_hash;

            await this.fetchAndUpdateStreamerList();
            await this.fetchAndUpdateJobs();

        },
        async fetchAndUpdateStreamerList(): Promise<void> {
            const data = await this.fetchStreamerList();
            if (data) {
                const channels = data.streamer_list.map((channel) => TwitchChannel.makeFromApiResponse(channel));
                this.streamerList = channels;
                this.streamerListLoaded = true;
                this.diskFreeSize = data.free_size;
                // this.diskTotalSize = data.total_size;
            }
        },
        async fetchStreamerList(): Promise<false | { streamer_list: ApiChannel[]; total_size: number; free_size: number; }> {
            this.loading = true;
            let response;
            try {
                response = await axios.get(`/api/v0/channels`);
            } catch (error) {
                console.error(error);
                this.loading = false;
                return false;
            }

            const data: ApiChannelsResponse | ApiErrorResponse = response.data;

            if (data.status === "ERROR") {
                // console.error("fetchStreamerList", data.message);
                this.loading = false;
                return false;
            }
            this.loading = false;
            return data.data;
        },
        async fetchVod(basename: string): Promise<false | ApiVod> {
            this.loading = true;
            let response;
            try {
                response = await axios.get(`/api/v0/vod/${basename}`);
            } catch (error) {
                console.error("fetchVod error", error);
                this.loading = false;
                return false;
            }

            const data: ApiVodResponse | ApiErrorResponse = response.data;

            if (data.status === "ERROR") {
                console.error("fetchVod", data.message);
                this.loading = false;
                return false;
            }

            this.loading = false;
            return data.data;
        },
        async fetchAndUpdateVod(basename: string): Promise<boolean> {
            const vod_data = await this.fetchVod(basename);
            if (!vod_data) return false;

            // check if streamer is already in the list
            const index = this.streamerList.findIndex((s) => s.userid === vod_data.streamer_id);
            if (index === -1) return false;

            const vod = TwitchVOD.makeFromApiResponse(vod_data);

            return this.updateVod(vod);
        },
        updateVod(vod: TwitchVOD): boolean {
            const index = this.streamerList.findIndex((s) => s.userid === vod.streamer_id);
            if (index === -1) return false;

            // check if vod is already in the streamer's vods
            const vodIndex = this.streamerList[index].vods_list.findIndex((v) => v.basename === vod.basename);

            console.debug("updateVod", vod.basename, vodIndex);

            if (vodIndex === -1) {
                console.debug("inserting vod", vod);
                this.streamerList[index].vods_list.push(vod);
            } else {
                console.debug("updating vod", vod);
                this.streamerList[index].vods_list[vodIndex] = vod;
            }
            return true;
        },
        updateVodFromData(vod_data: ApiVod): boolean {
            const vod = TwitchVOD.makeFromApiResponse(vod_data);
            return this.updateVod(vod);
        },
        removeVod(basename: string): void {
            this.streamerList.forEach((s) => {
                const index = s.vods_list.findIndex((v) => v.basename === basename);
                if (index !== -1) {
                    s.vods_list.splice(index, 1);
                }
            });
        },
        async updateCapturingVods(): Promise<void> {
            this.streamerList.forEach((streamer) => {
                streamer.vods_list.forEach((vod) => {
                    if (vod.is_capturing) {
                        // console.debug("updateCapturingVods", vod.basename);
                        this.fetchAndUpdateVod(vod.basename);
                    }
                });
            });
        },
        async fetchStreamer(login: string): Promise<false | ApiChannel> {
            this.loading = true;
            let response;
            try {
                response = await axios.get(`/api/v0/channels/${login}`);
            } catch (error) {
                console.error("fetchStreamer error", error);
                this.loading = false;
                return false;
            }
            if (!response.data) {
                this.loading = false;
                return false;
            }
            const data: ApiChannelResponse | ApiErrorResponse = response.data;

            if (data.status === "ERROR") {
                console.error("fetchVod", data.message);
                this.loading = false;
                return false;
            }

            const streamer: ApiChannel = data.data;

            this.loading = true;
            return streamer;
        },
        async fetchAndUpdateStreamer(login: string): Promise<boolean> {
            const streamer_data = await this.fetchStreamer(login);
            if (!streamer_data) return false;

            const index = this.streamerList.findIndex((s) => s.login === login);
            if (index === -1) return false;

            const streamer = TwitchChannel.makeFromApiResponse(streamer_data);

            this.updateStreamer(streamer);
            console.debug("updated streamer", streamer);
            return true;
        },
        updateStreamer(streamer: TwitchChannel): boolean {
            const index = this.streamerList.findIndex((s) => s.login === streamer.login);

            console.debug("updateStreamer", streamer.login, index);

            if (index === -1) {
                this.streamerList.push(streamer);
            } else {
                this.streamerList[index] = streamer;
            }

            return true;
        },
        updateStreamerFromData(streamer_data: ApiChannel): boolean {
            const streamer = TwitchChannel.makeFromApiResponse(streamer_data);
            return this.updateStreamer(streamer);
        },
        updateStreamerList(data: ApiChannel[]): void {
            // console.debug("updateStreamerList", data);
            if (!data || typeof data !== "object") {
                console.warn("updateStreamerList malformed data", typeof data, data);
            }
            const channels = data.map((channel) => TwitchChannel.makeFromApiResponse(channel));
            this.streamerList = channels;
            this.streamerListLoaded = true;
        },
        updateErrors(data: string[]): void {
            this.errors = data;
        },
        async fetchAndUpdateJobs(): Promise<void> {
            this.loading = true;
            let response;

            try {
                response = await axios.get(`/api/v0/jobs`);
            } catch (error) {
                console.error(error);
                this.loading = false;
                return;
            }

            this.loading = false;

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
        updateJobProgress(job_name: string, progress: number) {
            const index = this.jobList.findIndex((j) => j.name === job_name);
            if (index === -1) {
                console.warn(`Job '${job_name}' not found in job list (progress: ${progress})`);
                return;
            }
            this.jobList[index].progress = progress;
            console.debug(`Update job '${job_name}', progress: ${progress}`);
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

            let init = false;
            if (!localStorage.getItem("twitchautomator_config")) {
                console.debug("No config found, using default");
                init = true;
            }

            const currentClientConfig: ClientSettings = localStorage.getItem("twitchautomator_config")
                ? JSON.parse(localStorage.getItem("twitchautomator_config") as string)
                : { ...defaultConfig };

            // set default values, useful if new settings are added
            for (const key of Object.keys(defaultConfig)) {
                const k = key as keyof ClientSettings;
                if (currentClientConfig[k] === undefined) {
                    const defaultValue = defaultConfig[k];
                    console.debug(`Setting default value for ${k}: ${defaultValue}`);
                    currentClientConfig[k] = defaultValue as never; // no solution for type shit
                }
            }

            if (currentClientConfig.language) {
                axios.defaults.headers.common["X-Language"] = currentClientConfig.language;
                console.debug(`Setting axios language to ${currentClientConfig.language}`);
            }

            this.updateClientConfig(currentClientConfig);
            if (init) this.saveClientConfig();
        },
        saveClientConfig() {
            localStorage.setItem("twitchautomator_config", JSON.stringify(this.clientConfig));
            console.log("Saved client config");
        },
        getStreamers(): TwitchChannel[] {
            return this.streamerList;
        },
        addLog(lines: ApiLogLine[]) {
            this.log.push(...lines);
        },
        clearLog() {
            this.log = [];
        },
        async login(password: string): Promise<boolean> {
            this.loading = true;
            let response;

            try {
                response = await axios.post(`/api/v0/auth/login`, { password });
            } catch (error) {
                console.error(error);
                this.loading = false;
                return false;
            }

            this.loading = false;

            if (!response.data.authenticated) {
                alert(response.data.message);
                return false;
            }
            
            return true;
        },
        async logout(): Promise<void> {
            this.loading = true;
            let response;

            try {
                response = await axios.post(`/api/v0/auth/logout`);
            } catch (error) {
                console.error(error);
                this.loading = false;
                return;
            }

            this.loading = false;
        },
        playMedia(source: string) {
            console.log("play media", source);
        }
    },
    getters: {
        isAnyoneLive(state: StoreType): boolean {
            return this.channelsOnline > 0;
        },
        channelsOnline(): number {
            if (!this.streamerList) return 0;
            return this.streamerList.filter((a) => a.is_live || a.is_capturing).length;
        },
        diskTotalSize(): number {
            if (!this.streamerList) return 0;
            return this.streamerList.reduce((acc, channel) => acc + (channel.vods_size || 0), 0);
        },
        authElement(): boolean {
            if (!this.authentication) return true;
            if (this.guest_mode && !this.authenticated) return false;
            if (this.authentication && this.authenticated) return true;
            return false;
        }
    },
});
