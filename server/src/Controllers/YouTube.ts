import express from "express";
import { YouTubeHelper } from "../Providers/YouTube";
import { Log, LOGLEVEL } from "../Core/Log";

export function Authenticate(req: express.Request, res: express.Response): void {

    if (!YouTubeHelper.oAuth2Client) {
        res.status(400).send({
            status: "ERROR",
            message: "YouTube client not configured",
        });
        return;
    }

    const url = YouTubeHelper.oAuth2Client.generateAuthUrl({
        access_type: "offline",
        scope: YouTubeHelper.SCOPES,
    });

    res.redirect(302, url);

}

export function Callback(req: express.Request, res: express.Response): Promise<void> {

    return new Promise<void>((resolve, reject) => {

        if (!YouTubeHelper.oAuth2Client) {
            res.status(400).send({
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
                    reject();
                    return;
                } else if (token && YouTubeHelper.oAuth2Client) {
                    Log.logAdvanced(LOGLEVEL.SUCCESS, "YouTube", "Authenticated with YouTube");
                    YouTubeHelper.oAuth2Client.setCredentials(token);
                    res.redirect("/", 302);
                    YouTubeHelper.authenticated = true;
                    YouTubeHelper.storeToken(token);
                    resolve();
                    return;
                } else {
                    Log.logAdvanced(LOGLEVEL.ERROR, "YouTube", "Could not get token, unknown error");
                    res.status(400).send({
                        status: "ERROR",
                        message: "Could not get token, unknown error",
                    });
                    reject();
                    return;
                }
            });

        }

    });

}

export function Status(req: express.Request, res: express.Response): void {

    if (!YouTubeHelper.authenticated) {
        res.status(400).send({
            status: "ERROR",
            message: "YouTube not authenticated",
        });
        return;
    }

    res.send({
        status: "OK",
        message: "YouTube authenticated",
    });

}