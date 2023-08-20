import { Config } from "@/Core/Config";
import type { ApiAuthResponse, ApiLoginResponse } from "@common/Api/Api";
import type express from "express";
export function Login(req: express.Request, res: express.Response): void {
    const password = Config.getInstance().cfg<string>("password");
    const client_password = req.body.password;

    if (req.session.authenticated) {
        res.api(400, {
            authenticated: true,
            message: req.t("auth.already-authenticated"),
            status: "ERROR",
        } as ApiLoginResponse);
        return;
    }

    if (!password) {
        res.api(400, {
            authenticated: false,
            message: req.t("auth.no-password-set"),
            status: "ERROR",
        } as ApiLoginResponse);
        return;
    }

    if (client_password == password) {
        req.session.regenerate((err) => {
            if (err) {
                console.error(err);
                res.api(500, "Internal server error");
                return;
            }

            req.session.cookie.expires = new Date(
                Date.now() + 1000 * 60 * 60 * 24 * 7
            ); // 7 days

            req.session.authenticated = true;

            req.session.save((err) => {
                if (err) {
                    console.error(err);
                    res.api(500, "Internal server error");
                    return;
                }

                res.api<ApiLoginResponse>(200, {
                    authenticated: true,
                    message: req.t("auth.login-successful").toString(),
                    status: "OK",
                });
            });
        });
    } else {
        res.api<ApiLoginResponse>(401, {
            authenticated: false,
            message: req.t("auth.login-failed").toString(),
            status: "ERROR",
        });
    }
}

export function Logout(req: express.Request, res: express.Response): void {
    req.session.destroy((err) => {
        if (err) {
            console.error(err);
            res.api(500, "Internal server error");
            return;
        }
        res.api<ApiLoginResponse>(200, {
            authenticated: false,
            message: req.t("auth.logout-successful").toString(),
            status: "OK",
        });
    });
}

export function CheckLogin(req: express.Request, res: express.Response): void {
    if (!Config.getInstance().cfg<boolean>("password")) {
        res.status(200).send({
            authentication: false,
            authenticated: false,
            message: req.t("auth.no-password-protection"),
        } as ApiAuthResponse);
    } else if (req.session.authenticated) {
        res.status(200).send({
            authentication: true,
            authenticated: true,
            guest_mode: Config.getInstance().cfg<boolean>("guest_mode", false),
            message: req.t("auth.you-are-logged-in"),
            status: "OK",
        } as ApiAuthResponse);
    } else {
        res.status(401).send({
            authentication: true,
            authenticated: false,
            guest_mode: Config.getInstance().cfg<boolean>("guest_mode", false),
            message: req.t("auth.you-are-not-logged-in"),
            status: "ERROR",
        } as ApiAuthResponse);
    }
}
