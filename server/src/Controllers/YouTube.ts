import express from "express";
import { YouTubeHelper } from "../Providers/YouTube";
import { Log, LOGLEVEL } from "../Core/Log";
import { formatDistanceToNow, formatISO9075 } from "date-fns";

export function Authenticate(req: express.Request, res: express.Response): void {

    if (!YouTubeHelper.oAuth2Client) {
        res.status(500).send({
            status: "ERROR",
            message: "YouTube client not configured",
        });
        return;
    }

    Log.logAdvanced(LOGLEVEL.INFO, "YouTube", "Begin auth process...");

    const url = YouTubeHelper.oAuth2Client.generateAuthUrl({
        access_type: "offline",
        scope: YouTubeHelper.SCOPES,
    });

    res.redirect(302, url);

}

export async function DestroySession(req: express.Request, res: express.Response): Promise<void> {

    if (!YouTubeHelper.oAuth2Client) {
        res.status(500).send({
            status: "ERROR",
            message: "YouTube client not configured",
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

    Log.logAdvanced(LOGLEVEL.INFO, "YouTube", "Got callback from YouTube...");

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
                    Log.logAdvanced(LOGLEVEL.ERROR, "YouTube", `Could not get token: ${err}`);
                    res.status(400).send({
                        status: "ERROR",
                        message: err.message,
                    });
                    // reject();
                    return;
                } else if (token && YouTubeHelper.oAuth2Client) {
                    Log.logAdvanced(LOGLEVEL.SUCCESS, "YouTube", "Authenticated with YouTube");
                    YouTubeHelper.oAuth2Client.setCredentials(token);
                    res.redirect(302, "/");
                    YouTubeHelper.authenticated = true;
                    YouTubeHelper.storeToken(token);
                    YouTubeHelper.fetchUsername().then(() => {
                        resolve();
                    }).catch(err => {
                        Log.logAdvanced(LOGLEVEL.ERROR, "YouTube", `Could not get username: ${err.message}`);
                        // res.status(400).send({
                        //     status: "ERROR",
                        //     message: `Could not get username: ${err.message}`,
                        // });
                        // reject();
                        return;
                    });
                    return;
                } else {
                    Log.logAdvanced(LOGLEVEL.ERROR, "YouTube", "Could not get token, unknown error");
                    res.status(400).send({
                        status: "ERROR",
                        message: "Could not get token, unknown error",
                    });
                    // reject();
                    return;
                }
            });
        } else {
            Log.logAdvanced(LOGLEVEL.ERROR, "YouTube", "No code provided");
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