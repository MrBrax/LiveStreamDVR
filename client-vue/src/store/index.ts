import { ApiJob, ApiLogLine, ApiChannels, ApiVods } from "@common/Api/Client";
import { ApiResponse, ApiAuthResponse, ApiLoginResponse, ApiChannelResponse, ApiChannelsResponse, ApiErrorResponse, ApiJobsResponse, ApiSettingsResponse, ApiVodResponse } from "@common/Api/Api";
import axios from "axios";
import { defineStore } from "pinia";
import { ClientSettings, SidemenuShow } from "@/twitchautomator";
import TwitchChannel from "@/core/Providers/Twitch/TwitchChannel";
import TwitchVOD from "@/core/Providers/Twitch/TwitchVOD";
import { defaultConfig, defaultSidemenuShow } from "@/defs";
import YouTubeChannel from "@/core/Providers/YouTube/YouTubeChannel";
import YouTubeVOD from "@/core/Providers/YouTube/YouTubeVOD";
import { TwitchVODChapter } from "@/core/Providers/Twitch/TwitchVODChapter";
import { BaseVODChapter } from "@/core/Providers/Base/BaseVODChapter";
import { parseJSON } from "date-fns";

export type ChannelTypes = TwitchChannel | YouTubeChannel;
export type VODTypes = TwitchVOD | YouTubeVOD;
export type ChapterTypes = TwitchVODChapter | BaseVODChapter;

interface StoreType {
    app_name: string;
    streamerList: ChannelTypes[];
    streamerListLoaded: boolean;
    jobList: ApiJob[];
    config: Record<string, any> | null;
    favourite_games: string[];
    version: string;
    clientConfig: ClientSettings | undefined;
    sidemenuShow: SidemenuShow;
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
    serverGitBranch?: string;
    visibleVod: string;
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
            sidemenuShow: defaultSidemenuShow,
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
            serverGitBranch: "",
            visibleVod: "",
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
                response = await axios.get<ApiSettingsResponse>(`/api/v0/settings`);
            } catch (error) {
                alert(error);
                return;
            }

            if (response.status !== 200) {
                alert("Non-200 response from server");
                return;
            }

            if (!response.data || !response.data.data) {
                alert(`No data received for settings, status ${response.status} ${response.statusText}`);
                console.error("No data received for settings", response);
                return;
            }

            const data = response.data;

            console.log(`Server type: ${data.data.server ?? "unknown"}`);

            this.updateConfig(data.data.config);
            this.updateVersion(data.data.version);
            this.updateServerType(data.data.server);
            this.updateFavouriteGames(data.data.favourite_games);
            this.updateErrors(data.data.errors ?? []);
            this.websocketUrl = data.data.websocket_url;
            this.app_name = data.data.app_name;
            this.serverGitHash = data.data.server_git_hash;
            this.serverGitBranch = data.data.server_git_branch;

            await this.fetchAndUpdateStreamerList();
            await this.fetchAndUpdateJobs();

        },
        async fetchAndUpdateStreamerList(): Promise<void> {
            const data = await this.fetchStreamerList();
            if (data) {
                const channels = data.streamer_list.map((channel) => {
                    switch (channel.provider) {
                        case "twitch":
                            return TwitchChannel.makeFromApiResponse(channel);
                        case "youtube":
                            return YouTubeChannel.makeFromApiResponse(channel);
                    }
                }).filter(c => c !== undefined);

                if (!channels) {
                    console.error("No channels found");
                    return;
                }

                this.streamerList = channels;
                this.streamerListLoaded = true;
                this.diskFreeSize = data.free_size;
                // this.diskTotalSize = data.total_size;
            }
        },
        async fetchStreamerList(): Promise<false | { streamer_list: ApiChannels[]; total_size: number; free_size: number; }> {
            this.loading = true;
            let response;
            try {
                response = await axios.get<ApiChannelsResponse | ApiErrorResponse>(`/api/v0/channels`);
            } catch (error) {
                console.error(error);
                this.loading = false;
                return false;
            }

            const data = response.data;

            if (data.status === "ERROR") {
                // console.error("fetchStreamerList", data.message);
                this.loading = false;
                return false;
            }
            this.loading = false;
            return data.data;
        },
        async fetchVod(uuid: string): Promise<false | ApiVods> {
            this.loading = true;
            let response;
            try {
                response = await axios.get<ApiVodResponse | ApiErrorResponse>(`/api/v0/vod/${uuid}`);
            } catch (error) {
                console.error("fetchVod error", error);
                this.loading = false;
                return false;
            }

            const data = response.data;

            if (data.status === "ERROR") {
                console.error("fetchVod", data.message);
                this.loading = false;
                return false;
            }

            this.loading = false;
            return data.data;
        },
        async fetchAndUpdateVod(uuid: string): Promise<boolean> {
            const vod_data = await this.fetchVod(uuid);
            if (!vod_data) return false;

            // check if streamer is already in the list
            if (vod_data.provider == "twitch") {
                const index = this.streamerList.findIndex((s) => s instanceof TwitchChannel && s.uuid === vod_data.uuid);
                if (index === -1) return false;
                const vod = TwitchVOD.makeFromApiResponse(vod_data);
                return this.updateVod(vod);
            } else if (vod_data.provider == "youtube") {
                const index = this.streamerList.findIndex((s) => s instanceof YouTubeChannel && s.uuid === vod_data.uuid);
                if (index === -1) return false;
                const vod = YouTubeVOD.makeFromApiResponse(vod_data);
                return this.updateVod(vod);
            }
            return false;
        },
        updateVod(vod: VODTypes): boolean {

            const provider = vod.provider;

            const streamer = this.streamerList.find<ChannelTypes>((s): s is ChannelTypes => {
                if (provider == "twitch") return s instanceof TwitchChannel && s.uuid === vod.channel_uuid;
                if (provider == "youtube") return s instanceof YouTubeChannel && s.uuid === vod.channel_uuid;
                return false;
            });
            if (!streamer) return false;

            // check if vod is already in the streamer's vods
            const vodIndex = streamer.vods_list.findIndex((v) => v.uuid === vod.uuid);

            if (vodIndex === -1) {
                console.debug("inserting vod", vod);
                if (streamer instanceof TwitchChannel) {
                    streamer.vods_list.push(vod as TwitchVOD);
                } else if (streamer instanceof YouTubeChannel) {
                    streamer.vods_list.push(vod as YouTubeVOD);
                }
            } else {
                console.debug("updating vod", vod);
                streamer.vods_list[vodIndex] = vod;
            }
            return true;
        },
        updateVodFromData(vod_data: ApiVods): boolean {
            // const vod = TwitchVOD.makeFromApiResponse(vod_data);
            // return this.updateVod(vod);

            if (vod_data.provider == "twitch") {
                const index = this.streamerList.findIndex((channel) => channel instanceof TwitchChannel && channel.uuid === vod_data.channel_uuid);
                if (index === -1) return false;
                const vod = TwitchVOD.makeFromApiResponse(vod_data);
                return this.updateVod(vod);
            } else if (vod_data.provider == "youtube") {
                const index = this.streamerList.findIndex((channel) => channel instanceof YouTubeChannel && channel.uuid === vod_data.channel_uuid);
                if (index === -1) return false;
                const vod = YouTubeVOD.makeFromApiResponse(vod_data);
                return this.updateVod(vod);
            }

            return false;

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
                        this.fetchAndUpdateVod(vod.uuid);
                    }
                });
            });
        },
        async fetchStreamer(uuid: string): Promise<false | ApiChannels> {
            this.loading = true;
            let response;
            try {
                response = await axios.get<ApiChannelResponse | ApiErrorResponse>(`/api/v0/channels/${uuid}`);
            } catch (error) {
                console.error("fetchStreamer error", error);
                this.loading = false;
                return false;
            }
            if (!response.data) {
                this.loading = false;
                return false;
            }
            const data = response.data;

            if (data.status === "ERROR") {
                console.error("fetchVod", data.message);
                this.loading = false;
                return false;
            }

            const streamer: ApiChannels = data.data;

            this.loading = true;
            return streamer;
        },
        async fetchAndUpdateStreamer(uuid: string): Promise<boolean> {
            const streamer_data = await this.fetchStreamer(uuid);
            if (!streamer_data) return false;

            /*
            const index = this.streamerList.findIndex((s) => s.login === login);
            if (index === -1) return false;

            const streamer = TwitchChannel.makeFromApiResponse(streamer_data);

            this.updateStreamer(streamer);
            console.debug("updated streamer", streamer);
            return true;
            */

            if (streamer_data.provider == "twitch") {
                const index = this.streamerList.findIndex((channel) => channel instanceof TwitchChannel && channel.uuid === streamer_data.uuid);
                if (index === -1) return false;
                const streamer = TwitchChannel.makeFromApiResponse(streamer_data);
                return this.updateStreamer(streamer);
            } else if (streamer_data.provider == "youtube") {
                const index = this.streamerList.findIndex((channel) => channel instanceof YouTubeChannel && channel.uuid === streamer_data.uuid);
                if (index === -1) return false;
                const streamer = YouTubeChannel.makeFromApiResponse(streamer_data);
                return this.updateStreamer(streamer);
            }
            return false;
        },
        updateStreamer(streamer: ChannelTypes): boolean {
            const index = this.streamerList.findIndex((s) => s.uuid === streamer.uuid);

            console.debug("updateStreamer", streamer.internalName, index);

            if (index === -1) {
                this.streamerList.push(streamer);
            } else {
                this.streamerList[index] = streamer;
            }

            return true;
        },
        updateStreamerFromData(streamer_data: ApiChannels): boolean {
            let streamer;
            if (streamer_data.provider == "youtube") {
                streamer = YouTubeChannel.makeFromApiResponse(streamer_data);
            } else {
                streamer = TwitchChannel.makeFromApiResponse(streamer_data);
            }
            return this.updateStreamer(streamer);
        },
        updateStreamerList(data: ApiChannels[]): void {
            // console.debug("updateStreamerList", data);
            if (!data || typeof data !== "object") {
                console.warn("updateStreamerList malformed data", typeof data, data);
            }
            const channels = data.map((channel) => {
                if (channel.provider == "youtube") {
                    return YouTubeChannel.makeFromApiResponse(channel);
                } else {
                    return TwitchChannel.makeFromApiResponse(channel);
                }
            });
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
                response = await axios.get<ApiJobsResponse | ApiErrorResponse>(`/api/v0/jobs`);
            } catch (error) {
                console.error(error);
                this.loading = false;
                return;
            }

            this.loading = false;

            if (response.data.status === "ERROR") {
                console.error("fetchAndUpdateJobs", response.data.message);
                return;
            }

            const json = response.data;
            this.updateJobList(json.data);
        },
        updateJobList(data: ApiJob[]) {
            console.debug(`Update job list with ${data.length} jobs`);
            this.jobList = data;
        },
        updateJob(job: ApiJob) {
            const index = this.jobList.findIndex((j) => j.name === job.name);
            if (index === -1) {
                console.debug(`Create job '${job.name}', status: ${job.status}`);
                this.jobList.push(job);
            } else {
                console.debug(`Update job '${job.name}', status: ${job.status}`);
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
        getJobTimeRemaining(job_name: string): number {
            const index = this.jobList.findIndex((j) => j.name === job_name);
            if (index === -1) {
                console.warn(`Job '${job_name}' not found in job list`);
                return 0;
            }

            // https://math.stackexchange.com/a/3694290
            const job = this.jobList[index];
            const now = Date.now();
            const start = parseJSON(job.dt_started_at).getTime();
            const elapsedSeconds = (now - start);
            const calc = elapsedSeconds * (1 / (job.progress) - 1);
            // console.debug(job_name, job.dt_started_at, elapsedSeconds, job.progress, calc);
            return calc;
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

            const currentSidemenuShow: SidemenuShow = localStorage.getItem("twitchautomator_sidemenu")
                ? JSON.parse(localStorage.getItem("twitchautomator_sidemenu") as string)
                : defaultSidemenuShow;

            this.sidemenuShow = currentSidemenuShow;

            this.updateClientConfig(currentClientConfig);
            if (init) this.saveClientConfig();
        },
        saveClientConfig() {
            localStorage.setItem("twitchautomator_config", JSON.stringify(this.clientConfig));
            localStorage.setItem("twitchautomator_sidemenu", JSON.stringify(this.sidemenuShow));
            console.log("Saved client config");
        },
        getStreamers(): ChannelTypes[] {
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
                response = await axios.post<ApiLoginResponse>(`/api/v0/auth/login`, { password });
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
                response = await axios.post<ApiResponse>(`/api/v0/auth/logout`);
            } catch (error) {
                console.error(error);
                this.loading = false;
                return;
            }

            this.loading = false;
        },
        playMedia(source: string) {
            console.log("play media", source);
        },
        keyEvent(key: string) {
            // console.log("key down", key);
        },
        setVisibleVod(basename: string) {
            this.visibleVod = basename;
        },
        channelUUIDToInternalName(uuid: string): string {
            const channel = this.streamerList.find(c => c.uuid === uuid);
            if (!channel) return "";
            return channel.internalName;
        }
    },
    getters: {
        isAnyoneLive(): boolean {
            return this.channelsOnline > 0;
        },
        isAnyoneCapturing(): boolean {
            return this.channelsCapturing > 0;
        },
        channelsOnline(): number {
            if (!this.streamerList) return 0;
            return this.streamerList.filter((a) => a.is_live || a.is_capturing).length;
        },
        channelsCapturing(): number {
            if (!this.streamerList) return 0;
            return this.streamerList.filter((a) => a.is_capturing).length;
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
        },
        appUrl(): string {
            if (!this.config) return "";
            const url = this.config.app_url;
            if (url == "debug") return "http://localhost:8080";
            return url;
        }
    },
});
