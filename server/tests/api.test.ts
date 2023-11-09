import { applySessionParser } from "@/Extend/express-session";
import type { Express } from "express";
import express from "express";
import request from "supertest";
import type { UserData } from "../../common/User";
import { AppName } from "../src/Core/BaseConfig";
import { Config } from "../src/Core/Config";
import { LiveStreamDVR } from "../src/Core/LiveStreamDVR";
import { TwitchChannel } from "../src/Core/Providers/Twitch/TwitchChannel";
import { applyExpressApiFunction } from "../src/Extend/express-api";
import { Auth } from "../src/Extend/express-auth";
import i18n from "../src/Helpers/i18n";
import { TwitchHelper } from "../src/Providers/Twitch";
import ApiRouter from "../src/Routes/Api";
import "./environment";

// jest.mock("../src/Core/TwitchChannel");

let app: Express | undefined;
let spy1: jest.SpyInstance | undefined;

// jest.mock("../src/Providers/Twitch");
// jest.mock("../src/Core/Config");

jest.spyOn(TwitchHelper, "getAccessToken").mockImplementation(() => {
    return new Promise((resolve) => {
        resolve("test");
    });
});

jest.spyOn(Config.prototype, "saveConfig").mockImplementation(
    (source?: string): boolean => {
        console.debug(`Config.saveConfig(${source})`);
        return true;
    }
);

beforeAll(async () => {
    await LiveStreamDVR.init();
    app = express();

    applyExpressApiFunction(app);

    applySessionParser(app);

    app.use(
        express.json({
            verify: (req, res, buf) => {
                (req as any).rawBody = buf;
            },
        })
    );

    app.use(Auth);

    app.use(i18n);

    const baserouter = express.Router();
    baserouter.use("/api/v0", ApiRouter);
    app.use("", baserouter);

    // TwitchChannel.getChannelDataProxy
    spy1 = jest
        .spyOn(TwitchChannel, "getUserDataProxy")
        .mockImplementation(() => {
            return Promise.resolve({
                provider: "twitch",
                id: "12345",
                login: "test",
                display_name: "test",
                type: "",
                broadcaster_type: "partner",
                description: "test",
                profile_image_url: "test",
                offline_image_url: "test",
                view_count: 0,
                created_at: "test",
                _updated: 1234,
                cache_avatar: "test",
                cache_offline_image: "",
            } as UserData);
        });
});

// afterEach(() => {
//     Config.destroyInstance();
// });

afterAll(() => {
    Config.destroyInstance();
    LiveStreamDVR.shutdown("test", true);
    app = undefined;
    spy1?.mockRestore();
    jest.restoreAllMocks();
});

describe("settings", () => {
    it("should return settings", async () => {
        const res = await request(app).get("/api/v0/settings");
        // console.log(res.status, res.body);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("data.app_name");
        expect(res.body).toHaveProperty("data.version");
        expect(res.body).toHaveProperty("data.config");

        const fields = Config.settingsFields;
        for (const key in fields) {
            const field = fields[key];
            if (!field.default) continue;
            expect(res.body.data.config[key]).toBeDefined();
        }

        expect(res.body.data.app_name).toBe(AppName);
    });

    it("should update settings", async () => {
        const res = await request(app)
            .put("/api/v0/settings")
            .send({
                config: {
                    password: "test",
                    bin_dir: "test",
                    ffmpeg_path: "test",
                    mediainfo_path: "test",
                    api_client_id: "test",
                    api_secret: "test",
                    eventsub_secret: "test",
                    app_url: "debug",
                },
                // TODO: automatic required fields
            });
        expect(res.body.message).toBe("Settings saved");
        expect(res.status).toBe(200);
        expect(Config.getInstance().cfg("password")).toBe("test");
    });

    it("should fail adding when required fields are missing", async () => {
        Config.destroyInstance();
        Config.getInstance().generateConfig();
        expect(Config.getInstance().cfg("password")).toBe(undefined);
        const res = await request(app)
            .put("/api/v0/settings")
            .send({
                config: {
                    password: "test",
                },
            });
        expect(res.body.message).toBe("Missing required setting: bin_dir");
        expect(res.status).toBe(400);

        Config.destroyInstance();
        Config.getInstance().generateConfig();
        const res2 = await request(app)
            .put("/api/v0/settings")
            .send({
                config: {
                    password: "test",
                    bin_dir: "test",
                },
            });
        expect(res2.body.message).toBe("Missing required setting: ffmpeg_path");
    });
});

describe("channels", () => {
    it("should return channels", async () => {
        const res = await request(app).get("/api/v0/channels");
        console.log("channels", res.status, res.body);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("data.streamer_list");
        expect(res.body).toHaveProperty("data.total_size");
        expect(res.body).toHaveProperty("data.free_size");
    });

    const add_data = {
        provider: "twitch",
        internalName: "test",
        quality: "best 1080p60",
        match: "",
        download_chat: true,
        live_chat: false,
        burn_chat: false,
        no_capture: false,
        no_cleanup: true,
        max_storage: 2,
        max_vods: 5,
        download_vod_at_end: false,
        download_vod_at_end_quality: "best",
    };

    it("should add a channel in isolated mode", async () => {
        Config.getInstance().setConfig("app_url", "");
        Config.getInstance().setConfig("isolated_mode", true);
        const res3 = await request(app).post("/api/v0/channels").send(add_data);
        expect(res3.body.message).toContain("'test' created");
        expect(res3.body.data).toHaveProperty("displayName");
        expect(res3.status).toBe(200);

        LiveStreamDVR.getInstance().clearChannels();
        LiveStreamDVR.getInstance().channels_config = [];
    });

    it("should not add a channel", async () => {
        spy1?.mockClear();

        const res = await request(app).post("/api/v0/channels").send({
            provider: "twitch",
            login: "test",
            quality: "best 1080p6",
            match: "",
            download_chat: true,
            burn_chat: false,
            no_capture: false,
            live_chat: true,
        });

        expect(res.status).toBe(400);
        // expect(res.body.message).toContain("Invalid quality");

        expect(spy1).not.toHaveBeenCalled();
    });

    it("should fail adding channel due to subscribe stuff", async () => {
        // both disabled
        Config.getInstance().setConfig("app_url", "");
        Config.getInstance().setConfig("isolated_mode", false);
        const res1 = await request(app).post("/api/v0/channels").send(add_data);
        expect(res1.body.message).toContain("no app_url");
        expect(res1.status).toBe(400);

        // debug app url
        // Config.getInstance().setConfig("app_url", "debug");
        // Config.getInstance().setConfig("isolated_mode", false);
        // const res2 = await request(app).post("/api/v0/channels").send(add_data);
        // expect(res2.body.message).toContain("'test' created");
        // expect(res2.body.data).toHaveProperty("display_name");
        // expect(res2.status).toBe(200);

        // isolated mode
        // Config.getInstance().setConfig("app_url", "");
        // Config.getInstance().setConfig("isolated_mode", true);
        // const res3 = await request(app).post("/api/v0/channels").send(add_data);
        // expect(res3.body.message).toContain("'test' created");
        // expect(res3.body.data).toHaveProperty("display_name");
        // expect(res3.status).toBe(200);
        //
        // TwitchChannel.channels = [];
        // TwitchChannel.channels_config = [];
    });

    let uuid = "";

    it("should add a channel", async () => {
        Config.getInstance().setConfig("app_url", "https://example.com");
        Config.getInstance().setConfig("isolated_mode", false);
        const res4 = await request(app).post("/api/v0/channels").send(add_data);
        expect(res4.body.message).toContain("'test' created");
        expect(res4.body.data).toHaveProperty("display_name");
        expect(res4.status).toBe(200);

        uuid = res4.body.data.uuid;
        expect(uuid).not.toBe("");

        // TwitchChannel.channels = [];
        // TwitchChannel.channels_config = [];

        expect(spy1).toHaveBeenCalled();
        expect(TwitchChannel.subscribeToIdWithWebhook).toHaveBeenCalled();

        Config.getInstance().setConfig("app_url", "");
        Config.getInstance().setConfig("isolated_mode", false);
    });

    it("duplicate channel should not be added", async () => {
        const res = await request(app).post("/api/v0/channels").send({
            login: "test",
            quality: "best 1080p60",
            match: "",
            download_chat: true,
            burn_chat: false,
            no_capture: false,
            live_chat: true,
        });

        expect(res.status).toBe(400);
    });

    it("added channel should be in channel route", async () => {
        expect(uuid).not.toBe("");
        const channel_res = await request(app).get(`/api/v0/channels/${uuid}`);
        expect(channel_res.status).toBe(200);
        expect(channel_res.body.data).toHaveProperty("display_name");
    });

    it("added channel should be in channels list", async () => {
        expect(uuid).not.toBe("");
        const channels_res = await request(app).get("/api/v0/channels");
        expect(channels_res.status).toBe(200);
        expect(channels_res.body.data.streamer_list).toHaveLength(1);
        expect(channels_res.body.data.streamer_list[0].display_name).toBe(
            "test"
        );
    });

    it("should remove a channel", async () => {
        const res = await request(app).delete(`/api/v0/channels/${uuid}`);
        expect(res.body.message).toContain("'test' deleted");
        expect(res.body.status).toBe("OK");
        expect(res.status).toBe(200);
        expect(TwitchChannel.unsubscribeFromIdWithWebhook).toHaveBeenCalled();
    });
});

describe("auth", () => {
    const ignored_paths = [
        "/api/v0/hook",
        "/api/v0/cron/sub",
        "/api/v0/cron/check_muted_vods",
        "/api/v0/cron/check_deleted_vods",
        // "/api/v0/cron/playlist_dump",
    ];

    it("should be properly password protected", async () => {
        // const res = await request(app).get("/api/v0/settings");
        Config.getInstance().setConfig("password", "test");

        for (const path of ignored_paths) {
            const res = await request(app).get(path);
            expect(res.status).not.toBe(401);
        }

        const res = await request(app).get("/api/v0/settings");
        expect(res.status).toBe(401);

        Config.getInstance().unsetConfig("password");
    });
});

// describe("Routes", () => {
//     it("all get routes should return 200", async () => {
//         for (const route of ["/api/v0/settings", "/api/v0/channels"]) {
//             const res = await request(app).get(route);
//            expect(res.status).toBe(200);
//         }
//     });
// });
