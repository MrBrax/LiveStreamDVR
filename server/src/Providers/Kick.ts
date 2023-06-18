import axios from "axios";
import { KickChannel, KickUser, KickChannelVideo } from "@common/KickAPI/Kick";

const axiosInstance = axios.create({
    baseURL: "https://kick.com/api/v1/",
    headers: {
        "Content-Type": "application/json",
    },
});

export function getAxiosInstance() {
    return axiosInstance;
}

export function setApiToken(token: string) {
    axiosInstance.defaults.headers.common["Authorization"] = `Bearer ${token}`;
}

export async function GetUser(username: string): Promise<KickUser> {
    const request = axiosInstance.get<KickUser>(`users/${username}`);
    const response = await request;
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

