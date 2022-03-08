import express from "express";
import * as Settings from "./Controllers/Settings";
import * as Channels from "./Controllers/Channels";
import * as Log from "./Controllers/Log";
import * as Vod from "./Controllers/Vod";
import * as Games from "./Controllers/Games";
import * as About from "./Controllers/About";
import { TwitchConfig } from "./Core/TwitchConfig";
import history from "connect-history-api-fallback";
import path from "path";
import { TwitchVOD } from "./Core/TwitchVOD";

TwitchConfig.init();

const app = express();
const port = TwitchConfig.cfg<number>("server_port", 8080);

app.use(express.json());

// app.get("/", (req, res) => {
//     // res.send(TwitchConfig.cfg<string>("app_url", "test"));
//     res.send(TwitchConfig.config);
// });

// single page app
// app.use(history());
// app.use(express.static( path.join(__dirname, "..", "..", "client-vue", "dist")) );

app.get("/api/v0/settings", Settings.GetSettings);

app.get("/api/v0/channels", Channels.ListChannels);
app.get("/api/v0/channels/:login", Channels.GetChannel);

app.get("/api/v0/vod/:basename", Vod.GetVod);

app.get("/api/v0/games", Games.ListGames);

app.get("/api/v0/about", About.About);

app.get("/api/v0/log/:filename/?:last_line?", Log.GetLog);

app.get("/api/v0/test_video_download", (req, res) => {
    if (!req.query.video_id){
        res.send("Missing video_id");
        return;
    }

    TwitchVOD.downloadVideo(req.query.video_id as string, "best", req.query.video_id as string + ".mp4")
        .then(() => {
            res.send("OK");
        })
        .catch(() => {
            res.send("FAIL");
        });
});


app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});