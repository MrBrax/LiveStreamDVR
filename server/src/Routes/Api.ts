import express from "express";
import * as Settings from "../Controllers/Settings";
import * as Channels from "../Controllers/Channels";
import * as Log from "../Controllers/Log";
import * as Vod from "../Controllers/Vod";
import * as Games from "../Controllers/Games";
import * as About from "../Controllers/About";
import * as Jobs from "../Controllers/Jobs";
import * as Subscriptions from "../Controllers/Subscriptions";
import * as Cron from "../Controllers/Cron";
import * as TwitchAPI from "../Controllers/TwitchAPI";
import * as Hook from "../Controllers/Hook";
import * as KeyValue from "../Controllers/KeyValue";
import * as Debug from "../Controllers/Debug";
import * as Favourites from "../Controllers/Favourites";
import * as Notifications from "../Controllers/Notifications";
import * as Tools from "../Controllers/Tools";
import * as Files from "../Controllers/Files";
import { TwitchVOD } from "../Core/TwitchVOD";

const router = express.Router();

router.all("/hook", Hook.Hook);

router.get("/settings", Settings.GetSettings);
router.put("/settings", Settings.SaveSettings);
router.post("/settings/validate_url", Settings.ValidateExternalURL);
router.get("/settings/debug", Settings.SetDebug);

router.get("/channels", Channels.ListChannels);
router.post("/channels", Channels.AddChannel);
router.get("/channels/:login", Channels.GetChannel);
router.put("/channels/:login", Channels.UpdateChannel);
router.delete("/channels/:login", Channels.DeleteChannel);
router.get("/channels/:login/download/:video_id", Channels.DownloadVideo);
router.post("/channels/:login/subscribe", Channels.SubscribeToChannel);
router.post("/channels/:login/cleanup", Channels.CleanupChannelVods);
router.post("/channels/:login/refresh", Channels.RefreshChannel);
router.post("/channels/:login/force_record", Channels.ForceRecord);
router.post("/channels/:login/rename", Channels.RenameChannel);
router.post("/channels/:login/deleteallvods", Channels.DeleteAllChannelVods);

router.get("/vod/:basename", Vod.GetVod);
router.post("/vod/:basename", Vod.EditVod);
router.delete("/vod/:basename", Vod.DeleteVod);
router.post("/vod/:basename/archive", Vod.ArchiveVod);
router.post("/vod/:basename/renderwizard", Vod.RenderWizard);
router.post("/vod/:basename/download_chat", Vod.DownloadChat);
router.post("/vod/:basename/download", Vod.DownloadVod);
router.post("/vod/:basename/check_mute", Vod.CheckMute);
router.post("/vod/:basename/match", Vod.MatchVod);
router.post("/vod/:basename/cut", Vod.CutVod);
router.post("/vod/:basename/save", Vod.ArchiveVod);

router.get("/games", Games.ListGames);

router.get("/favourites", Favourites.ListFavourites);
// router.post("/favourites", Favourites.AddFavourite);
router.put("/favourites", Favourites.SaveFavourites);
router.patch("/favourites", Favourites.AddFavourite);

router.get("/about", About.About);

router.get("/log/:filename/:start_from?", Log.GetLog);
// router.get("/log/:filename/:start_from", Log.GetLog);

router.get("/jobs", Jobs.ListJobs);
router.delete("/jobs/:name", Jobs.KillJob);

router.get("/subscriptions", Subscriptions.ListSubscriptions);
router.post("/subscriptions", Subscriptions.SubscribeToAllChannels);
router.delete("/subscriptions/:sub_id", Subscriptions.UnsubscribeFromId);

router.get("/cron/check_deleted_vods", Cron.CheckDeletedVods);
router.get("/cron/check_muted_vods", Cron.CheckMutedVods);

router.get("/twitchapi/videos/:login", TwitchAPI.TwitchAPIVideos);
router.get("/twitchapi/video/:video_id", TwitchAPI.TwitchAPIVideo);
router.get("/twitchapi/user/:login", TwitchAPI.TwitchAPIUser);
router.get("/twitchapi/clips", TwitchAPI.TwitchAPIClips);

router.get("/keyvalue", KeyValue.GetAllKeyValues);
router.delete("/keyvalue", KeyValue.DeleteAllKeyValues);
router.get("/keyvalue/:key", KeyValue.GetKeyValue);
router.put("/keyvalue/:key", KeyValue.SetKeyValue);
router.delete("/keyvalue/:key", KeyValue.DeleteKeyValue);

router.get("/debug/vods", Debug.ListVodsInMemory);
router.get("/debug/channels", Debug.ListChannelsInMemory);
router.get("/debug/notify", Debug.NotifyTest);

router.get("/notifications", Notifications.GetNotificationSettings);
router.put("/notifications", Notifications.SaveNotificationSettings);

router.post("/tools/reset_channels", Tools.ResetChannels);
router.post("/tools/vod_download", Tools.DownloadVod);
router.post("/tools/chat_download", Tools.DownloadChat);
router.post("/tools/chat_dump", Tools.ChatDump);
router.post("/tools/clip_download", Tools.DownloadClip);

router.get("/files", Files.ListFiles);
router.delete("/files", Files.DeleteFile);

router.get("/test_video_download", (req, res) => {
    if (!req.query.video_id) {
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

export default router;