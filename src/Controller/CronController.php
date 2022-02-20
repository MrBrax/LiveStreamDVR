<?php

declare(strict_types=1);

namespace App\Controller;

use App\TwitchConfig;
use App\TwitchHelper;
use App\TwitchVOD;
use App\TwitchChannel;
use Slim\Psr7\Request;
use Slim\Psr7\Response;
// use Slim\Views\Twig;

class CronController
{

    private $notify_cache = [];
    private $notify_cache_file = __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "cache" . DIRECTORY_SEPARATOR . "notify.json";

    public function __construct()
    {
        $this->notify_cache = file_exists($this->notify_cache_file) ? json_decode(file_get_contents($this->notify_cache_file), true) : [];
    }

    private function saveNotifyCache()
    {
        file_put_contents($this->notify_cache_file, json_encode($this->notify_cache));
    }

    private function addToNotifyCache($string)
    {
        array_push($this->notify_cache, $string);
        $this->saveNotifyCache();
    }

    private function isInNotifyCache($string)
    {
        return in_array($string, $this->notify_cache);
    }

    private function sendNotify($string)
    {
        TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "cron", "Notification: {$string}");
        // this is where it would notify if i had a solution

        TwitchHelper::webhook([
            'action' => 'notify',
            'text' => $string
        ]);
    }

    /**
     * Undocumented function
     *
     * @return TwitchChannel[]
     */
    private function generateStreamerList()
    {

        /*
        $streamerListStatic = TwitchConfig::getStreamers();
        $streamerList = [];

        foreach ($streamerListStatic as $streamer) {

            $data = new TwitchChannel();
            $data->load($streamer['username']);

            $streamerList[] = $data;
        }
        return $streamerList;*/
        return TwitchConfig::getChannels();
    }

    public function check_deleted_vods(Request $request, Response $response, $args)
    {

        TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "cron", "Cronjob deleted check start");

        $force = isset($_GET['force']);

        $streamerList = $this->generateStreamerList();

        $data = [];

        foreach ($streamerList as $streamer) {

            /**
             * @var TwitchVOD
             */
            foreach ($streamer->vods_list as $vod) {

                if (!$force && $this->isInNotifyCache("deleted_{$vod->basename}")) {
                    TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "cron", "Cronjob deleted check for {$vod->basename} skipped, already notified");
                    continue;
                }

                $check = $vod->checkValidVod(true, $force);

                if ($vod->twitch_vod_id && $check === false) {
                    // notify
                    $this->sendNotify("{$vod->basename} deleted");
                    $response->getBody()->write("{$vod->basename} deleted<br>\n");
                    $this->addToNotifyCache("deleted_{$vod->basename}");
                    TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "cron", "Cronjob deleted check: {$vod->basename} deleted");
                }
            }
        }

        TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "cron", "Cronjob deleted check end");

        file_put_contents(TwitchHelper::$cron_folder . DIRECTORY_SEPARATOR . "check_deleted_vods", time());

        return $response;
    }

    public function check_muted_vods(Request $request, Response $response, $args)
    {

        TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "cron", "Cronjob mute check start");

        $force = isset($_GET['force']);

        $streamerList = $this->generateStreamerList();

        $data = [];

        foreach ($streamerList as $streamer) {

            foreach ($streamer->vods_list as $vod) {

                /** @var TwitchVOD $vod */

                if (!$force && $this->isInNotifyCache("mute_{$vod->basename}")) {
                    TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "cron", "Cronjob mute check for {$vod->basename} skipped, already notified");
                    continue;
                }

                if ($vod->twitch_vod_muted === true) {
                    // muted forever
                    continue;
                }

                $old = $vod->twitch_vod_muted;

                try {
                    $check = $vod->checkMutedVod(true, $force);
                } catch (\Throwable $th) {
                    $response->getBody()->write("{$vod->basename} error: {$th->getMessage()}<br>\n");
                    TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "cron", "Cronjob mute check: {$vod->basename} error: {$th->getMessage()}");
                    continue;
                }

                if ($check === true) {
                    // notify
                    $this->sendNotify("{$vod->basename} muted");
                    $response->getBody()->write("{$vod->basename} muted<br>\n");
                    $this->addToNotifyCache("mute_{$vod->basename}");
                    TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "cron", "Cronjob mute check: {$vod->basename} muted");
                } elseif ($check === false) {
                    // $response->getBody()->write( $vod->basename . " not muted<br>\n" );
                }
            }
        }

        TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "cron", "Cronjob mute check end");

        file_put_contents(TwitchHelper::$cron_folder . DIRECTORY_SEPARATOR . "check_muted_vods", time());

        return $response;
    }

    public function dump_playlists(Request $request, Response $response, $args)
    {

        TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "cron", "Cronjob dump playlists start");

        $streamerList = $this->generateStreamerList();

        $data = [];

        foreach ($streamerList as $streamer) {

            $playlists = $streamer->getPlaylists();

            $stored_data_file = $streamer->getFolder() . DIRECTORY_SEPARATOR . "playlists_{$streamer->login}.json";
            $stored_data = [];
            if (file_exists($stored_data_file)) {
                $stored_data = json_decode(file_get_contents($stored_data_file), true);
            }

            $stored_data = $stored_data + $playlists;

            file_put_contents($stored_data_file, json_encode($stored_data));

            return $response;
        }

        TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "cron", "Cronjob dump playlists end");

        file_put_contents(TwitchHelper::$cron_folder . DIRECTORY_SEPARATOR . "dump_playlists", time());

        return $response;
    }
}
