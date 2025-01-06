import { LOGLEVEL, log } from "@/Core/Log";
import type {
    KickChannel,
    KickChannelLivestream,
    KickChannelLivestreamResponse,
    KickChannelVideo,
    KickUser,
} from "@common/KickAPI/Kick";
import axios, { isAxiosError } from "axios";

const kickAxios = axios.create({});

const baseURL = "https://kick.com/api/v2/";

const kickCookies: Record<string, string> = {};

/* function baseFetchOptions(): RequestInit {
    return {
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; rv:114.0) Gecko/20100101 Firefox/114.0",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*;q=0.8",
            Cookie: Object.entries(kickCookies)
                .map(([key, value]) => `${key}=${value}`)
                .join("; "),
        },
        credentials: "include",
        mode: "cors",
        referrerPolicy: "no-referrer",
        redirect: "follow",
        cache: "no-cache",
    };
} */

let xsrfToken: string | undefined;

interface FetchResponse<T> {
    data: T | undefined;
    // error: string | undefined;
    status: number;
    statusText: string;
}

// get xsrf token from cookie
export async function fetchXSFRToken(): Promise<boolean> {
    /* const request = await fetch("https://kick.com", {
        ...baseFetchOptions(),
        method: "GET",
    }); */

    let request;

    try {
        request = await kickAxios.get("https://kick.com", {
            method: "GET",
            headers: {
                // "Content-Type": "application/json",
                // "User-Agent":
                //     "Mozilla/5.0 (Windows NT 10.0; rv:114.0) Gecko/20100101 Firefox/133.0",
                // "Sec-Fetch-User": "?1",
            },
        });
    } catch (error) {
        log(
            LOGLEVEL.ERROR,
            "KickAPI.fetchXSFRToken",
            `Error getting XSFR token: ${error}`
        );
        throw error;
    }

    // const cookies = request.headers.get("set-cookie");

    const cookies = request.headers["set-cookie"];

    if (!cookies) {
        throw new Error("No cookies");
    }

    // remove all cookies to make sure we don't have any old ones
    Object.keys(kickCookies).forEach((key) => {
        delete kickCookies[key];
    });

    cookies.forEach((cookie: string) => {
        const [key, value] = cookie.split(";")[0].split("=");
        kickCookies[key] = value;
    });

    const xsrfCookie = cookies.find((cookie) => cookie.includes("XSRF-TOKEN"));

    if (!xsrfCookie) {
        console.log(cookies);
        throw new Error("No XSRF-TOKEN cookie");
    }

    xsrfToken = xsrfCookie.split("=")[1];

    console.log(`Got XSRF-TOKEN: ${xsrfToken}`);

    return true;
}

// fetchXSFRToken();

export async function getRequest<T>(url: string): Promise<FetchResponse<T>> {
    // const request = await fetch(baseURL + url, mergedOptions);
    // const body = await request.text();
    // console.debug(body);

    // const fullURL = baseURL + url;

    log(LOGLEVEL.DEBUG, "KickAPI.getRequest", `Getting ${url}`);

    if (!xsrfToken) {
        await fetchXSFRToken();
    }

    let request;

    try {
        request = await kickAxios.get(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; rv:114.0) Gecko/20100101 Firefox/133.0",
                "Sec-Fetch-User": "?1",
            },
        });
    } catch (error) {
        if (isAxiosError(error)) {
            log(
                LOGLEVEL.ERROR,
                "KickAPI.getRequest",
                `Error getting data from '${url}' : (${error.response?.config.url}): ${error.response?.data}`,
                error
            );
            if (
                error.response?.data.includes("window._cf_chl") ||
                error.response?.data.includes("<!DOCTYPE html>")
            ) {
                log(
                    LOGLEVEL.ERROR,
                    "KickAPI.getRequest",
                    "Error getting data: Cloudflare challenge"
                );
                throw new Error("Cloudflare challenge");
            }
        } else {
            log(
                LOGLEVEL.ERROR,
                "KickAPI.getRequest",
                `Error getting data from '${url}' : ${error}`,
                error
            );
        }

        throw error;
    }

    const body = request.data;

    return {
        data: body,
        // error: request.error,
        status: request.status,
        statusText: request.statusText,
    };
}

export async function GetUser(username: string): Promise<KickUser | undefined> {
    log(LOGLEVEL.DEBUG, "KickAPI.GetUser", `Getting user ${username}`);
    let response;
    try {
        // response = await axiosInstance.get<KickUser>(`users/${username}`);
        response = await getRequest<KickUser>(`users/${username}`);
    } catch (error) {
        log(
            LOGLEVEL.ERROR,
            "KickAPI.GetUser",
            `Error getting user data: ${error}`
        );
        throw error;
    }

    if (!response.data) {
        log(LOGLEVEL.ERROR, "KickAPI.GetUser", `User ${username} not found`);
        // return undefined;
        throw new Error(`User ${username} not found`);
    }
    log(
        LOGLEVEL.DEBUG,
        "KickAPI.GetUser",
        `Got user ${response.data.username}`
    );
    return response.data;
}

export async function GetChannel(
    username: string
): Promise<KickChannel | undefined> {
    // const request = axiosInstance.get<KickChannel>(`channels/${username}`);
    // const response = await request;
    // return response.data;
    const response = await getRequest<KickChannel>(
        `https://kick.com/api/v2/channels/${username}`
    );
    return response.data;
}

// TODO: don't know if to use videos/latest or getchannel
export async function GetChannelVideos(
    username: string
): Promise<KickChannelVideo[] | undefined> {
    // const response = await getRequest<KickChannelVideo[]>(
    //     `channels/${username}/videos/latest`
    // );
    // return response.data;

    let response;

    try {
        // response = await axiosInstance.get<KickChannelVideo[]>(
        //     `channels/${username}/videos/latest`
        // );
        response = await getRequest<KickChannelVideo[]>(
            `channels/${username}/videos/latest`
        );
    } catch (error) {
        log(
            LOGLEVEL.ERROR,
            "KickAPI.GetChannelVideos",
            `Error getting data: ${error}`
        );
        throw error;
    }

    if (!response.data) {
        log(
            LOGLEVEL.ERROR,
            "KickAPI.GetChannelVideos",
            `Channel ${username} not found`
        );
        // return undefined;
        throw new Error(`Channel ${username} not found`);
    }

    log(
        LOGLEVEL.DEBUG,
        "KickAPI.GetChannelVideos",
        `Got ${response.data.length} videos`
    );

    return response.data;
}

export async function GetStream(
    username: string
): Promise<KickChannelLivestream | undefined> {
    // const request = axiosInstance.get<KickChannelLivestreamResponse>(`channels/${username}/livestream`);
    // const response = await request;
    // return response.data ? response.data.data : undefined;
    const response = await getRequest<KickChannelLivestreamResponse>(
        `https://kick.com/api/v2/channels/${username}/livestream`
    );
    return response.data ? response.data.data : undefined;
}
