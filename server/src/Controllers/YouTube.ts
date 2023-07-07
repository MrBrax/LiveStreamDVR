import express from "express";
import { YouTubeHelper } from "../Providers/YouTube";
import { log, LOGLEVEL } from "../Core/Log";
import { formatDistanceToNow, formatISO9075 } from "date-fns";

export function Authenticate(req: express.Request, res: express.Response): void {

    if (!YouTubeHelper.oAuth2Client) {
        res.status(500).send({
            status: "ERROR",
            message: "YouTube client not configured. Set it up in the settings page.",
        });
        log(LOGLEVEL.ERROR, "YouTube", "YouTube client not configured. Set it up in the settings page.");
        return;
    }

    log(LOGLEVEL.INFO, "YouTube", "Begin auth process...");

    const url = YouTubeHelper.oAuth2Client.generateAuthUrl({
        access_type: "offline",
        scope: YouTubeHelper.SCOPES,
        // prompt: "consent", // necessary?
    });

    if (!url) {
        res.status(500).send({
            status: "ERROR",
            message: "No URL received from OAuth. Check your settings.",
        });
        log(LOGLEVEL.ERROR, "YouTube", "No URL received from OAuth, user stuck.");
        return;
    }

    if (req.query.rawurl) {
        log(LOGLEVEL.SUCCESS, "YouTube", `Send raw URL to user: ${url}`);
        res.status(200).send({
            status: "OK",
            data: url,
        });
        return;
    } else {
        log(LOGLEVEL.SUCCESS, "YouTube", `Send user to: ${url}`);
        res.redirect(302, url);
    }

}

export async function DestroySession(req: express.Request, res: express.Response): Promise<void> {

    if (!YouTubeHelper.oAuth2Client) {
        res.status(500).send({
            status: "ERROR",
            message: "YouTube client not configured. Set it up in the settings page.",
        });
        return;
    }

    try {
        await YouTubeHelper.destroyCredentials();
    } catch (error) {
        res.status(500).send({
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

export function Callback(req: express.Request, res: express.Response): Promise<void> {

    log(LOGLEVEL.INFO, "YouTube", "Got callback from YouTube...");

    return new Promise<void>((resolve, reject) => {

        if (!YouTubeHelper.oAuth2Client) {
            res.status(500).send({
                status: "ERROR",
                message: "YouTube client not configured",
            });
            return;
        }

        const code = req.query.code as string | undefined;

        if (code) {
            YouTubeHelper.oAuth2Client.getToken(code, (err, token) => {
                if (err) {
                    log(LOGLEVEL.ERROR, "YouTube", `Could not get token: ${err}`);
                    res.status(400).send({
                        status: "ERROR",
                        message: err.message,
                    });
                    // reject();
                    return;
                } else if (token && YouTubeHelper.oAuth2Client) {
                    log(LOGLEVEL.SUCCESS, "YouTube", "Authenticated with YouTube");
                    YouTubeHelper.oAuth2Client.setCredentials(token);
                    // res.redirect(302, "/");
                    YouTubeHelper.authenticated = true;
                    YouTubeHelper.storeToken(token);
                    YouTubeHelper.fetchUsername().then((username) => {
                        resolve();
                        res.send(`Authenticated with YouTube (${username}). You can close this window now.`);
                    }).catch(err => {
                        log(LOGLEVEL.ERROR, "YouTube", `Could not get username: ${err.message}`);
                        res.status(500).send("Could not get username, please check the logs and settings.");
                        // res.status(400).send({
                        //     status: "ERROR",
                        //     message: `Could not get username: ${err.message}`,
                        // });
                        // reject();
                        return;
                    });
                    return;
                } else {
                    log(LOGLEVEL.ERROR, "YouTube", "Could not get token, unknown error");
                    res.status(400).send({
                        status: "ERROR",
                        message: "Could not get token, unknown error",
                    });
                    // reject();
                    return;
                }
            });
        } else {
            log(LOGLEVEL.ERROR, "YouTube", "No code provided");
            res.status(500).send({
                status: "ERROR",
                message: "No code provided",
            });
        }

    });

}

export async function Status(req: express.Request, res: express.Response): Promise<void> {

    if (!YouTubeHelper.oAuth2Client) {
        res.status(500).send({
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
        res.status(500).send({
            status: "ERROR",
            message: `YouTube not authenticated: ${(error as Error).message}`,
        });
        return;
    }

    const end_date = new Date(YouTubeHelper.accessTokenTime);

    const expires_in = formatDistanceToNow(end_date);

    if (username !== "") {
        if (YouTubeHelper.accessTokenTime > 0) {
            res.send({
                status: "OK",
                message: `YouTube authenticated with user: ${username}, expires in ${expires_in} (${formatISO9075(end_date)})`,
            });
        } else {
            res.send({
                status: "OK",
                message: `YouTube authenticated with user: ${username}, unknown expiration.`,
            });
        }
    } else {
        res.status(500).send({
            status: "ERROR",
            message: "YouTube not authenticated, username is blank",
        });
    }

}

export async function GetPlaylists(req: express.Request, res: express.Response): Promise<void> {

    let playlists = [];
    try {
        playlists = await YouTubeHelper.getPlaylists();
    } catch (error) {
        res.status(500).send({
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

export async function CreatePlaylist(req: express.Request, res: express.Response): Promise<void> {

    const title = req.body.title as string | undefined;
    const description = req.body.description as string || "";

    if (!title) {
        res.status(400).send({
            status: "ERROR",
            message: "No title provided",
        });
        return;
    }

    let playlist = null;
    try {
        playlist = await YouTubeHelper.createPlaylist(title, description);
    } catch (error) {
        res.status(500).send({
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
