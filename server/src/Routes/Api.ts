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
import * as YouTube from "../Controllers/YouTube";
import * as Exporter from "../Controllers/Exporter";
import * as Auth from "../Controllers/Auth";
import * as Telemetry from "../Controllers/Telemetry";
import { AuthGuest, AuthAdmin, AuthCore } from "../Helpers/Auth";

const router = express.Router();

router.all("/hook", AuthCore, Hook.Hook);

router.get("/settings", AuthGuest, Settings.GetSettings);
router.put("/settings", AuthAdmin, Settings.SaveSettings);
router.post("/settings/validate_url", AuthAdmin, Settings.ValidateExternalURL);
router.get("/settings/debug", AuthAdmin, Settings.SetDebug);

router.get("/channels", AuthGuest, Channels.ListChannels);
router.post("/channels", AuthAdmin, Channels.AddChannel);
router.get("/channels/:login", AuthGuest, Channels.GetChannel);
router.put("/channels/:login", AuthAdmin, Channels.UpdateChannel);
router.delete("/channels/:login", AuthAdmin, Channels.DeleteChannel);
router.get("/channels/:login/download/:video_id", AuthAdmin, Channels.DownloadVideo);
router.post("/channels/:login/subscribe", AuthAdmin, Channels.SubscribeToChannel);
router.post("/channels/:login/cleanup", AuthAdmin, Channels.CleanupChannelVods);
router.post("/channels/:login/refresh", AuthAdmin, Channels.RefreshChannel);
router.post("/channels/:login/force_record", AuthAdmin, Channels.ForceRecord);
router.post("/channels/:login/rename", AuthAdmin, Channels.RenameChannel);
router.post("/channels/:login/deleteallvods", AuthAdmin, Channels.DeleteAllChannelVods);
router.get("/channels/:login/history", AuthGuest, Channels.GetHistory);

router.get("/vod/:basename", AuthGuest, Vod.GetVod);
router.post("/vod/:basename", AuthAdmin, Vod.EditVod);
router.delete("/vod/:basename", AuthAdmin, Vod.DeleteVod);
router.post("/vod/:basename/archive", AuthAdmin, Vod.ArchiveVod);
router.post("/vod/:basename/renderwizard", AuthAdmin, Vod.RenderWizard);
router.post("/vod/:basename/download_chat", AuthAdmin, Vod.DownloadChat);
router.post("/vod/:basename/download", AuthAdmin, Vod.DownloadVod);
router.post("/vod/:basename/check_mute", AuthAdmin, Vod.CheckMute);
router.post("/vod/:basename/match", AuthAdmin, Vod.MatchVod);
router.post("/vod/:basename/cut", AuthAdmin, Vod.CutVod);
router.post("/vod/:basename/save", AuthAdmin, Vod.ArchiveVod);
// router.post("/vod/:basename/export", AuthAdmin, Vod.ExportVod);
router.post("/vod/:basename/bookmark", AuthAdmin, Vod.AddBookmark);
router.delete("/vod/:basename/bookmark", AuthAdmin, Vod.RemoveBookmark);

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

router.get("/keyvalue", AuthAdmin, KeyValue.GetAllKeyValues);
router.delete("/keyvalue", AuthAdmin, KeyValue.DeleteAllKeyValues);
router.get("/keyvalue/:key", AuthAdmin, KeyValue.GetKeyValue);
router.put("/keyvalue/:key", AuthAdmin, KeyValue.SetKeyValue);
router.delete("/keyvalue/:key", AuthAdmin, KeyValue.DeleteKeyValue);

// router.get("/debug/vods", AuthAdmin, Debug.ListVodsInMemory);
// router.get("/debug/channels", AuthAdmin, Debug.ListChannelsInMemory);
// router.get("/debug/notify", AuthAdmin, Debug.NotifyTest);
// router.get("/debug/clips", AuthAdmin, Debug.Clips);
router.get("/debug/reencode/:basename", AuthAdmin, Debug.ReencodeVod);

router.get("/notifications", AuthAdmin, Notifications.GetNotificationSettings);
router.put("/notifications", AuthAdmin, Notifications.SaveNotificationSettings);

router.post("/tools/reset_channels", AuthAdmin, Tools.ResetChannels);
router.post("/tools/vod_download", AuthAdmin, Tools.DownloadVod);
router.post("/tools/chat_download", AuthAdmin, Tools.DownloadChat);
router.post("/tools/chat_dump", AuthAdmin, Tools.ChatDump);
router.post("/tools/clip_download", AuthAdmin, Tools.DownloadClip);

router.get("/files", AuthAdmin, Files.ListFiles);
router.delete("/files", AuthAdmin, Files.DeleteFile);

router.get("/youtube/authenticate", AuthAdmin, YouTube.Authenticate);
router.get("/youtube/callback", AuthAdmin, YouTube.Callback);
router.get("/youtube/status", AuthAdmin, YouTube.Status);

router.post("/auth/login", Auth.Login);
router.post("/auth/logout", Auth.Logout);
router.get("/auth/check", Auth.CheckLogin);

router.get("/telemetry/show", AuthAdmin, Telemetry.ShowTelemetry);
router.post("/telemetry/send", AuthAdmin, Telemetry.SendTelemetry);

export default router;