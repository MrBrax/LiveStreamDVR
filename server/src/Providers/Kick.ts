import axios, { isAxiosError } from "axios";
import type { KickChannel, KickUser, KickChannelVideo, KickChannelLivestream, KickChannelLivestreamResponse } from "@common/KickAPI/Kick";
import { Log } from "../Core/Log";

const axiosInstance = axios.create({
    baseURL: "https://kick.com/api/v1/",
    "headers": {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; rv:114.0) Gecko/20100101 Firefox/114.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.8,sv-SE;q=0.5,sv;q=0.3",
        "Alt-Used": "kick.com",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
    },
});

export function getAxiosInstance() {
    return axiosInstance;
}

export function hasAxiosInstance() {
    return axiosInstance !== undefined;
}

export function setApiToken(token: string) {
    axiosInstance.defaults.headers.common["Authorization"] = `Bearer ${token}`;
}

export async function GetUser(username: string): Promise<KickUser | undefined> {
    Log.logAdvanced(Log.Level.DEBUG, "KickAPI.GetUser", `Getting user ${username}`);
    console.debug(axiosInstance.getUri({url: `users/${username}`}));
    console.debug(axiosInstance.defaults.baseURL + `users/${username}`);
    let response;
    try {
        response = await axiosInstance.get<KickUser>(`users/${username}`);
    } catch (error) {
        if (isAxiosError(error)) {
            Log.logAdvanced(Log.Level.ERROR, "KickAPI.GetUser", `Error getting user data (${axios.getUri(error.request)}): ${error.response?.statusText}`, error);
            if (error.response?.data.includes("challenge-form")) {
                Log.logAdvanced(Log.Level.ERROR, "KickAPI.GetUser", `Error getting user data: Cloudflare challenge`);
            }
        } else {
            Log.logAdvanced(Log.Level.ERROR, "KickAPI.GetUser", `Error getting user data: ${(error as Error).message}`, error);
        }
        return undefined;        
    }
    if (!response.data) {
        Log.logAdvanced(Log.Level.ERROR, "KickAPI.GetUser", `User ${username} not found`);
        return undefined;
    }
    Log.logAdvanced(Log.Level.DEBUG, "KickAPI.GetUser", `Got user ${response.data.username}`);
    return response.data;
}

export async function GetChannel(username: string): Promise<KickChannel> {
    const request = axiosInstance.get<KickChannel>(`channels/${username}`);
    const response = await request;
    return response.data;
}

// TODO: don't know if to use videos/latest or getchannel
export async function GetChannelVideos(username: string): Promise<KickChannelVideo[]> {
    const request = axiosInstance.get<KickChannelVideo[]>(`channels/${username}/videos/latest`);
    const response = await request;
    return response.data;
}

export async function GetStream(username: string): Promise<KickChannelLivestream | undefined> {
    const request = axiosInstance.get<KickChannelLivestreamResponse>(`channels/${username}/livestream`);
    const response = await request;
    return response.data ? response.data.data : undefined;
}