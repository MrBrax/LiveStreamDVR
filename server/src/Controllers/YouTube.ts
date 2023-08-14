import { log, LOGLEVEL } from "@/Core/Log";
import { formatDistanceToNow } from "date-fns";
import type express from "express";
import { YouTubeHelper } from "../Providers/YouTube";

export function Authenticate(
    req: express.Request,
    res: express.Response
): void {
    if (!YouTubeHelper.oAuth2Client) {
        res.api(500, {
            status: "ERROR",
            message:
                "YouTube client not configured. Set it up in the settings page.",
        });
        log(
            LOGLEVEL.ERROR,
            "YouTube.Authenticate",
            "YouTube client not configured. Set it up in the settings page."
        );
        return;
    }

    log(LOGLEVEL.INFO, "YouTube.Authenticate", "Begin auth process...");

    const url = YouTubeHelper.oAuth2Client.generateAuthUrl({
        access_type: "offline",
        scope: YouTubeHelper.SCOPES,
        // prompt: "consent", // necessary?
    });

    if (!url) {
        res.api(500, {
            status: "ERROR",
            message: "No URL received from OAuth. Check your settings.",
        });
        log(
            LOGLEVEL.ERROR,
            "YouTube.Authenticate",
            "No URL received from OAuth, user stuck."
        );
        return;
    }

    if (req.query.rawurl) {
        log(
            LOGLEVEL.SUCCESS,
            "YouTube.Authenticate",
            `Send raw URL to user: ${url}`
        );
        res.api(200, {
            status: "OK",
            data: url,
        });
        return;
    } else {
        log(LOGLEVEL.SUCCESS, "YouTube.Authenticate", `Send user to: ${url}`);
        res.redirect(302, url);
    }
}

export async function DestroySession(
    req: express.Request,
    res: express.Response
): Promise<void> {
    if (!YouTubeHelper.oAuth2Client) {
        res.api(500, {
            status: "ERROR",
            message:
                "YouTube client not configured. Set it up in the settings page.",
        });
        return;
    }

    try {
        await YouTubeHelper.destroyCredentials();
    } catch (error) {
        res.api(500, {
            status: "ERROR",
            message: (error as Error).message,
        });
        return;
    }

    res.send({
        status: "OK",
        message: "YouTube credentials destroyed",
    });
}

export function Callback(
    req: express.Request,
    res: express.Response
): Promise<void> {
    log(LOGLEVEL.INFO, "YouTube.Callback", "Got callback from YouTube...");

    return new Promise<void>((resolve) => {
        if (!YouTubeHelper.oAuth2Client) {
            res.api(500, {
                status: "ERROR",
                message: "YouTube client not configured",
            });
            return;
        }

        const code = req.query.code as string | undefined;

        if (code) {
            YouTubeHelper.oAuth2Client.getToken(code, (err, token) => {
                if (err) {
                    log(
                        LOGLEVEL.ERROR,
                        "YouTube.Callback",
                        `Could not get token: ${err}`
                    );
                    res.api(400, {
                        status: "ERROR",
                        message: err.message,
                    });
                    // reject();
                    return;
                } else if (token && YouTubeHelper.oAuth2Client) {
                    log(
                        LOGLEVEL.SUCCESS,
                        "YouTube.Callback",
                        "Authenticated with YouTube"
                    );
                    YouTubeHelper.oAuth2Client.setCredentials(token);
                    // res.redirect(302, "/");
                    YouTubeHelper.authenticated = true;
                    YouTubeHelper.storeToken(token);
                    if (token.refresh_token) {
                        YouTubeHelper.storeRefreshToken(token.refresh_token);
                    } else {
                        log(
                            LOGLEVEL.WARNING,
                            "YouTube.Callback",
                            "No refresh token received"
                        );
                    }
                    YouTubeHelper.fetchUsername()
                        .then((username) => {
                            resolve();
                            res.send(
                                `Authenticated with YouTube (${username}). You can close this window now.`
                            );
                        })
                        .catch((err) => {
                            log(
                                LOGLEVEL.ERROR,
                                "YouTube.Callback",
                                `Could not get username: ${err.message}`
                            );
                            res.api(
                                500,
                                "Could not get username, please check the logs and settings."
                            );
                            // res.api(400, {
                            //     status: "ERROR",
                            //     message: `Could not get username: ${err.message}`,
                            // });
                            // reject();
                            return;
                        });
                    return;
                } else {
                    log(
                        LOGLEVEL.ERROR,
                        "YouTube.Callback",
                        "Could not get token, unknown error"
                    );
                    res.api(400, {
                        status: "ERROR",
                        message: "Could not get token, unknown error",
                    });
                    // reject();
                    return;
                }
            });
        } else {
            log(LOGLEVEL.ERROR, "YouTube.Callback", "No code provided");
            res.api(500, {
                status: "ERROR",
                message: "No code provided",
            });
        }
    });
}

export async function Status(
    req: express.Request,
    res: express.Response
): Promise<void> {
    if (!YouTubeHelper.oAuth2Client) {
        res.api(500, {
            status: "ERROR",
            message: "YouTube client not configured",
        });
        return;
    }

    // if (!YouTubeHelper.authenticated) {
    //     res.status(403).send({
    //         status: "ERROR",
    //         message: "YouTube not authenticated",
    //     });
    //     return;
    // }

    let username = "";
    try {
        username = await YouTubeHelper.fetchUsername(true);
    } catch (error) {
        res.api(500, {
            status: "ERROR",
            message: `YouTube not authenticated: ${(error as Error).message}`,
        });
        return;
    }

    const end_date = YouTubeHelper.accessTokenExpiryDate;

    const expires_in = end_date ? formatDistanceToNow(end_date) : "unknown";

    if (username !== "") {
        let message = "";
        if (YouTubeHelper.accessTokenExpiryDate) {
            message += `YouTube authenticated with user: ${username}, expires in ${expires_in} (${
                end_date ? end_date.toISOString() : "unknown"
            }).`;
        } else {
            message += `YouTube authenticated with user: ${username}, unknown expiration.`;
        }
        message += ` Refresh token: ${
            YouTubeHelper.hasRefreshToken() ? "yes" : "no"
        }. Access token: ${
            YouTubeHelper.hasToken() ? "yes" : "no"
        }. OAuth2 cred token: ${
            YouTubeHelper.hasSetOAuth2ClientToken() ? "yes" : "no"
        }. OAuth2 cred refresh token: ${
            YouTubeHelper.hasSetOAuth2ClientRefreshToken() ? "yes" : "no"
        }.`;

        res.api(200, {
            status: "OK",
            message,
        });
    } else {
        res.api(500, {
            status: "ERROR",
            message: "YouTube not authenticated, username is blank",
        });
    }
}

export async function GetPlaylists(
    req: express.Request,
    res: express.Response
): Promise<void> {
    let playlists = [];
    try {
        playlists = await YouTubeHelper.getPlaylists();
    } catch (error) {
        res.api(500, {
            status: "ERROR",
            message: `Could not fetch playlists: ${(error as Error).message}`,
        });
        return;
    }

    res.send({
        status: "OK",
        data: playlists,
    });
}

export async function CreatePlaylist(
    req: express.Request,
    res: express.Response
): Promise<void> {
    const title = req.body.title as string | undefined;
    const description = (req.body.description as string) || "";

    if (!title) {
        res.api(400, {
            status: "ERROR",
            message: "No title provided",
        });
        return;
    }

    let playlist = null;
    try {
        playlist = await YouTubeHelper.createPlaylist(title, description);
    } catch (error) {
        res.api(500, {
            status: "ERROR",
            message: `Could not create playlist: ${(error as Error).message}`,
        });
        return;
    }

    res.send({
        status: "OK",
        data: playlist,
    });
}
