import express from "express";
import * as About from "../Controllers/About";
import * as Auth from "../Controllers/Auth";
import * as Channels from "../Controllers/Channels";
import * as Cron from "../Controllers/Cron";
import * as Debug from "../Controllers/Debug";
import * as Exporter from "../Controllers/Exporter";
import * as Favourites from "../Controllers/Favourites";
import * as Files from "../Controllers/Files";
import * as Games from "../Controllers/Games";
import * as Hook from "../Controllers/Hook";
import * as Jobs from "../Controllers/Jobs";
import * as KeyValue from "../Controllers/KeyValue";
import * as Log from "../Controllers/Log";
import * as Notifications from "../Controllers/Notifications";
import * as Settings from "../Controllers/Settings";
import * as Subscriptions from "../Controllers/Subscriptions";
import * as Telemetry from "../Controllers/Telemetry";
import * as Tools from "../Controllers/Tools";
import * as TwitchAPI from "../Controllers/TwitchAPI";
import * as Vod from "../Controllers/Vod";
import * as YouTube from "../Controllers/YouTube";
import * as YouTubeAPI from "../Controllers/YouTubeAPI";
import { AuthAdmin, AuthCore, AuthGuest } from "../Helpers/Auth";

const router = express.Router();

router.all("/hook", AuthCore, Hook.HookTwitch); // deprecated
router.all("/hook/twitch", AuthCore, Hook.HookTwitch);
router.all("/hook/youtube", AuthCore, Hook.HookYouTube);

router.get("/settings", AuthGuest, Settings.GetSettings);
router.put("/settings", AuthAdmin, Settings.SaveSettings);
router.post("/settings/validate_url", AuthAdmin, Settings.ValidateExternalURL);
router.get("/settings/debug", AuthAdmin, Settings.SetDebug);

router.get("/channels", AuthGuest, Channels.ListChannels);
router.post("/channels", AuthAdmin, Channels.AddChannel);
router.get("/channels/:uuid", AuthGuest, Channels.GetChannel);
router.put("/channels/:uuid", AuthAdmin, Channels.UpdateChannel);
router.delete("/channels/:uuid", AuthAdmin, Channels.DeleteChannel);
router.get("/channels/:uuid/download/:video_id", AuthAdmin, Channels.DownloadVideo);
router.post("/channels/:uuid/subscribe", AuthAdmin, Channels.SubscribeToChannel);
router.get("/channels/:uuid/checksubscriptions", AuthAdmin, Channels.CheckSubscriptions);
router.post("/channels/:uuid/cleanup", AuthAdmin, Channels.CleanupChannelVods);
router.post("/channels/:uuid/refresh", AuthAdmin, Channels.RefreshChannel);
router.post("/channels/:uuid/force_record", AuthAdmin, Channels.ForceRecord);
router.post("/channels/:uuid/rename", AuthAdmin, Channels.RenameChannel);
router.post("/channels/:uuid/deleteallvods", AuthAdmin, Channels.DeleteAllChannelVods);
router.get("/channels/:uuid/history", AuthGuest, Channels.GetHistory);
router.post("/channels/:uuid/scan", AuthGuest, Channels.ScanVods);

router.get("/vod/:uuid", AuthGuest, Vod.GetVod);
router.post("/vod/:uuid", AuthAdmin, Vod.EditVod);
router.delete("/vod/:uuid", AuthAdmin, Vod.DeleteVod);
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

router.get("/games", AuthGuest, Games.ListGames);

router.post("/exporter", AuthAdmin, Exporter.ExportFile);

router.get("/favourites", AuthGuest, Favourites.ListFavourites);
// router.post("/favourites", AuthAdmin, Favourites.AddFavourite);
router.put("/favourites", AuthAdmin, Favourites.SaveFavourites);
router.patch("/favourites", AuthAdmin, Favourites.AddFavourite);

router.get("/about", AuthAdmin, About.About);

router.get("/log/:filename/:startFrom(\\d+)", AuthAdmin, Log.GetLog);
router.get("/log/:filename", AuthAdmin, Log.GetLog);

router.get("/jobs", AuthAdmin, Jobs.ListJobs);
router.delete("/jobs/:name", AuthAdmin, Jobs.KillJob);

router.get("/subscriptions", AuthAdmin, Subscriptions.ListSubscriptions);
router.post("/subscriptions", AuthAdmin, Subscriptions.SubscribeToAllChannels);
router.delete("/subscriptions/:sub_id", AuthAdmin, Subscriptions.UnsubscribeFromId);

router.get("/cron/check_deleted_vods", AuthCore, Cron.CheckDeletedVods);
router.get("/cron/check_muted_vods", AuthCore, Cron.CheckMutedVods);

router.get("/twitchapi/videos/:login", AuthAdmin, TwitchAPI.TwitchAPIVideos);
router.get("/twitchapi/video/:video_id", AuthAdmin, TwitchAPI.TwitchAPIVideo);
router.get("/twitchapi/user/:login", AuthAdmin, TwitchAPI.TwitchAPIUser);
router.get("/twitchapi/streams/:login", AuthAdmin, TwitchAPI.TwitchAPIStreams);
router.get("/twitchapi/channel/:login", AuthAdmin, TwitchAPI.TwitchAPIChannel);
router.get("/twitchapi/clips", AuthAdmin, TwitchAPI.TwitchAPIClips);

router.get("/youtubeapi/videos/:channel_id", AuthAdmin, YouTubeAPI.YouTubeAPIVideos);

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
router.get("/debug/jobprogress", AuthAdmin, Debug.JobProgress);

router.get("/notifications", AuthAdmin, Notifications.GetNotificationSettings);
router.put("/notifications", AuthAdmin, Notifications.SaveNotificationSettings);

router.post("/tools/reset_channels", AuthAdmin, Tools.ResetChannels);
router.post("/tools/vod_download", AuthAdmin, Tools.DownloadVod);
router.post("/tools/chat_download", AuthAdmin, Tools.DownloadChat);
router.post("/tools/chat_dump", AuthAdmin, Tools.ChatDump);
router.post("/tools/clip_download", AuthAdmin, Tools.DownloadClip);
router.get("/tools/shutdown", AuthAdmin, Tools.Shutdown);

router.get("/files", AuthAdmin, Files.ListFiles);
router.delete("/files", AuthAdmin, Files.DeleteFile);

router.get("/youtube/authenticate", AuthAdmin, YouTube.Authenticate);
router.get("/youtube/callback", AuthAdmin, YouTube.Callback);
router.get("/youtube/status", AuthAdmin, YouTube.Status);
router.get("/youtube/destroy", AuthAdmin, YouTube.DestroySession);

router.post("/auth/login", Auth.Login);
router.post("/auth/logout", Auth.Logout);
router.get("/auth/check", Auth.CheckLogin);

router.get("/telemetry/show", AuthAdmin, Telemetry.ShowTelemetry);
router.post("/telemetry/send", AuthAdmin, Telemetry.SendTelemetry);

export default router;