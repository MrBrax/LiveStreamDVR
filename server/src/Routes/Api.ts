import { Config } from "@/Core/Config";
import { AuthAdmin, AuthCore, AuthGuest } from "@/Extend/express-auth";
import express from "express";
import * as About from "../Controllers/About";
import Auth from "../Controllers/Auth";
import * as Channels from "../Controllers/Channels";
import * as ClientSettings from "../Controllers/ClientSettings";
import * as Cron from "../Controllers/Cron";
import * as Exporter from "../Controllers/Exporter";
import * as Favourites from "../Controllers/Favourites";
import * as Files from "../Controllers/Files";
import * as Games from "../Controllers/Games";
import * as Hook from "../Controllers/Hook";
import * as Jobs from "../Controllers/Jobs";
import * as KeyValue from "../Controllers/KeyValue";
import * as KickAPI from "../Controllers/KickAPI";
import * as Log from "../Controllers/Log";
import * as Notifications from "../Controllers/Notifications";
import * as Settings from "../Controllers/Settings";
import * as Subscriptions from "../Controllers/Subscriptions";
import * as Telemetry from "../Controllers/Telemetry";
import * as Tools from "../Controllers/Tools";
import * as Twitch from "../Controllers/Twitch";
import * as TwitchAPI from "../Controllers/TwitchAPI";
import * as Vod from "../Controllers/Vod";
import * as YouTube from "../Controllers/YouTube";
import * as YouTubeAPI from "../Controllers/YouTubeAPI";

const router = express.Router();

router.all("/hook", AuthCore, Hook.HookTwitch); // deprecated
router.all("/hook/twitch", AuthCore, Hook.HookTwitch);
router.all("/hook/youtube", AuthCore, Hook.HookYouTube);

router.get("/settings", AuthGuest, Settings.GetSettings);
router.put("/settings", AuthAdmin, Settings.SaveSettings);
router.post("/settings/validate_url", AuthAdmin, Settings.ValidateExternalURL);
router.get("/settings/debug", AuthAdmin, Settings.SetDebug);

router.get("/clientsettings", AuthGuest, ClientSettings.GetClientSettings);
router.put("/clientsettings", AuthAdmin, ClientSettings.SaveClientSettings);

router.get("/channels", AuthGuest, Channels.ListChannels);
router.post("/channels", AuthAdmin, Channels.AddChannel);
router.get("/channels/:uuid", AuthGuest, Channels.GetChannel);
router.put("/channels/:uuid", AuthAdmin, Channels.UpdateChannel);
router.delete("/channels/:uuid", AuthAdmin, Channels.DeleteChannel);
router.get(
    "/channels/:uuid/download/:video_id",
    AuthAdmin,
    Channels.DownloadVideo
);
router.post(
    "/channels/:uuid/subscribe",
    AuthAdmin,
    Channels.SubscribeToChannel
);
router.post(
    "/channels/:uuid/unsubscribe",
    AuthAdmin,
    Channels.UnsubscribeFromChannel
);
router.get(
    "/channels/:uuid/checksubscriptions",
    AuthAdmin,
    Channels.CheckSubscriptions
);
router.post("/channels/:uuid/cleanup", AuthAdmin, Channels.CleanupChannelVods);
router.post("/channels/:uuid/refresh", AuthAdmin, Channels.RefreshChannel);
router.post("/channels/:uuid/force_record", AuthAdmin, Channels.ForceRecord);
router.post("/channels/:uuid/rename", AuthAdmin, Channels.RenameChannel);
router.post(
    "/channels/:uuid/deleteallvods",
    AuthAdmin,
    Channels.DeleteAllChannelVods
);
router.get("/channels/:uuid/history", AuthAdmin, Channels.GetHistory);
router.post("/channels/:uuid/scan", AuthAdmin, Channels.ScanVods);
router.post(
    "/channels/:uuid/scanlocalvideos",
    AuthAdmin,
    Channels.ScanLocalVideos
);
router.get("/channels/:uuid/clips", AuthAdmin, Channels.GetClips);
router.post("/channels/:uuid/exportallvods", AuthAdmin, Channels.ExportAllVods);
router.post(
    "/channels/:uuid/matchallprovidervods",
    AuthAdmin,
    Channels.MatchAllProviderVods
);

router.get("/vod/:uuid", AuthGuest, Vod.GetVod);
router.post("/vod/:uuid", AuthAdmin, Vod.EditVod);
router.delete("/vod/:uuid", AuthAdmin, Vod.DeleteVod);
router.post("/vod/:uuid/delete_segment", AuthAdmin, Vod.DeleteVodSegment);
router.post("/vod/:uuid/archive", AuthAdmin, Vod.ArchiveVod);
router.post("/vod/:uuid/renderwizard", AuthAdmin, Vod.RenderWizard);
router.post("/vod/:uuid/download_chat", AuthAdmin, Vod.DownloadChat);
router.post("/vod/:uuid/download", AuthAdmin, Vod.DownloadVod);
router.post("/vod/:uuid/check_mute", AuthAdmin, Vod.CheckMute);
router.post("/vod/:uuid/match", AuthAdmin, Vod.MatchVod);
router.post("/vod/:uuid/cut", AuthAdmin, Vod.CutVod);
router.post("/vod/:uuid/save", AuthAdmin, Vod.ArchiveVod);
// router.post("/vod/:uuid/export", AuthAdmin, Vod.ExportVod);
router.post("/vod/:uuid/bookmark", AuthAdmin, Vod.AddBookmark);
router.delete("/vod/:uuid/bookmark", AuthAdmin, Vod.RemoveBookmark);
router.get("/vod/:uuid/sync", AuthAdmin, Vod.GetSync);
router.post("/vod/:uuid/rename", AuthAdmin, Vod.RenameVod);
router.post("/vod/:uuid/fix_issues", AuthAdmin, Vod.FixIssues);
router.post("/vod/:uuid/refresh_metadata", AuthAdmin, Vod.RefreshVodMetadata);
router.post("/vod/:uuid/splitbychapters", AuthAdmin, Vod.SplitVodByChapters);

router.get("/games", AuthGuest, Games.ListGames);
// router.get("/games/:id", AuthGuest, Games.GetGame);
router.get("/games/:id/refresh", AuthAdmin, Games.RefreshGame);

router.post("/exporter", AuthAdmin, Exporter.ExportFile);
router.get("/exporter/rclone/remotes", AuthAdmin, Exporter.GetRcloneRemotes);

router.get("/favourites", AuthGuest, Favourites.ListFavourites);
// router.post("/favourites", AuthAdmin, Favourites.AddFavourite);
router.put("/favourites", AuthAdmin, Favourites.SaveFavourites);
router.patch("/favourites", AuthAdmin, Favourites.AddFavourite);

router.get("/about", AuthAdmin, About.About);
router.get("/about/license", AuthAdmin, About.License);

// router.get("/log/:filename/:startFrom(\\d+)", AuthAdmin, Log.GetLog);
// router.get("/log/:filename", AuthAdmin, Log.GetLog);
router.get("/log", AuthAdmin, Log.GetLog);

router.get("/jobs", AuthAdmin, Jobs.ListJobs);
router.delete("/jobs/:name", AuthAdmin, Jobs.KillJob);

router.get("/subscriptions", AuthAdmin, Subscriptions.ListSubscriptions);
router.post("/subscriptions", AuthAdmin, Subscriptions.SubscribeToAllChannels);
router.delete(
    "/subscriptions/:sub_id",
    AuthAdmin,
    Subscriptions.UnsubscribeFromId
);

router.get("/cron/check_deleted_vods", AuthCore, Cron.CheckDeletedVods);
router.get("/cron/check_muted_vods", AuthCore, Cron.CheckMutedVods);

router.get("/twitchapi/videos/:login", AuthAdmin, TwitchAPI.TwitchAPIVideos);
router.get("/twitchapi/video/:video_id", AuthAdmin, TwitchAPI.TwitchAPIVideo);
router.get("/twitchapi/user/:login", AuthAdmin, TwitchAPI.TwitchAPIUser);
router.get("/twitchapi/streams/:login", AuthAdmin, TwitchAPI.TwitchAPIStreams);
router.get("/twitchapi/channel/:login", AuthAdmin, TwitchAPI.TwitchAPIChannel);
router.get("/twitchapi/clips", AuthAdmin, TwitchAPI.TwitchAPIClips);

router.get(
    "/youtubeapi/videos/:channel_id",
    AuthAdmin,
    YouTubeAPI.YouTubeAPIVideos
);
router.get(
    "/youtubeapi/video/:video_id",
    AuthAdmin,
    YouTubeAPI.YouTubeAPIVideo
);
router.post("/youtubeapi/channelid", AuthAdmin, YouTubeAPI.YouTubeAPIChannelID);

router.get("/kickapi/users/:slug", AuthAdmin, KickAPI.KickAPIUser);
router.get("/kickapi/channels/:slug", AuthAdmin, KickAPI.KickAPIChannel);

router.get("/keyvalue", AuthAdmin, KeyValue.GetAllKeyValues);
router.delete("/keyvalue", AuthAdmin, KeyValue.DeleteAllKeyValues);
router.get("/keyvalue/:key", AuthAdmin, KeyValue.GetKeyValue);
router.put("/keyvalue/:key", AuthAdmin, KeyValue.SetKeyValue);
router.delete("/keyvalue/:key", AuthAdmin, KeyValue.DeleteKeyValue);

// router.get("/debug/vods", AuthAdmin, Debug.ListVodsInMemory);
// router.get("/debug/channels", AuthAdmin, Debug.ListChannelsInMemory);
// router.get("/debug/notify", AuthAdmin, Debug.NotifyTest);
// router.get("/debug/clips", AuthAdmin, Debug.Clips);
// router.get("/debug/reencode/:basename", AuthAdmin, Debug.ReencodeVod);
// router.get("/debug/youtube", AuthAdmin, Debug.GetYouTubeChannel);
// router.get("/debug/jobprogress", AuthAdmin, Debug.JobProgress);
// router.get("/debug/rebuild", AuthAdmin, Debug.rebuildSegmentList);
// router.get("/debug/translatetest", AuthAdmin, Debug.TranslateTest);

router.get("/notifications", AuthAdmin, Notifications.GetNotificationSettings);
router.put("/notifications", AuthAdmin, Notifications.SaveNotificationSettings);
router.post(
    "/notifications/test",
    AuthAdmin,
    Notifications.TestNotificationSettings
);

router.post("/tools/reset_channels", AuthAdmin, Tools.ResetChannels);
router.post("/tools/vod_download", AuthAdmin, Tools.DownloadVod);
router.post("/tools/chat_download", AuthAdmin, Tools.DownloadChat);
router.post("/tools/chat_dump", AuthAdmin, Tools.ChatDump);
router.post("/tools/clip_download", AuthAdmin, Tools.DownloadClip);
router.post("/tools/shutdown", AuthAdmin, Tools.Shutdown);
router.get("/tools/runscheduler/:name", AuthAdmin, Tools.RunScheduler);
// router.post("/tools/buildclient", AuthAdmin, Tools.BuildClient);

router.get("/files", AuthAdmin, Files.ListFiles);
router.delete("/files", AuthAdmin, Files.DeleteFile);

router.get("/youtube/authenticate", AuthAdmin, YouTube.Authenticate);
router.get("/youtube/callback", AuthAdmin, YouTube.Callback);
router.get("/youtube/status", AuthAdmin, YouTube.Status);
router.get("/youtube/destroy", AuthAdmin, YouTube.DestroySession);
router.get("/youtube/playlists", AuthAdmin, YouTube.GetPlaylists);
router.post("/youtube/playlists", AuthAdmin, YouTube.CreatePlaylist);

router.get("/twitch/authenticate", AuthAdmin, Twitch.Authenticate);
router.get("/twitch/callback", AuthAdmin, Twitch.Callback);
router.get("/twitch/status", AuthAdmin, Twitch.Status);

router.post("/auth/login", Auth.Login);
router.post("/auth/logout", Auth.Logout);
router.get("/auth/check", Auth.CheckLogin);

router.get("/telemetry/show", AuthAdmin, Telemetry.ShowTelemetry);
router.post("/telemetry/send", AuthAdmin, Telemetry.SendTelemetry);

// 404
router.use(function (req, res, next) {
    res.status(404).send(
        `<h1>404 Not Found</h1>Endpoint <code>${req.originalUrl}</code> using method <code>${req.method}</code> does not exist.<br>` +
            "If you think this is a bug (did you not type the URL manually?), please report it to the developers." +
            (!Config.getInstance().cfg("password")
                ? `<hr>Version: ${process.env.npm_package_version}, debug ${
                      Config.debug ? "enabled" : "disabled"
                  }. ${new Date().toISOString()}`
                : "")
    );
});

export default router;
