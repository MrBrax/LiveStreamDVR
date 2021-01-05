<?php

declare(strict_types=1);

namespace App\Controller;

use App\TwitchConfig;
use App\TwitchHelper;
use App\TwitchVOD;
use App\TwitchChannel;
use Slim\Psr7\Request;
use Slim\Psr7\Response;
use Slim\Views\Twig;

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

        $streamerListStatic = TwitchConfig::getStreamers();
        $streamerList = [];

        foreach ($streamerListStatic as $streamer) {

            $data = new TwitchChannel();
            $data->load($streamer['username']);

            $streamerList[] = $data;
        }
        return $streamerList;
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

                if (!$force && $this->isInNotifyCache("deleted_{$vod->basename}")) continue;

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

                if (!$force && $this->isInNotifyCache("mute_{$vod->basename}")) continue;

                if ($vod->twitch_vod_muted === true) {
                    // muted forever
                    continue;
                }

                $old = $vod->twitch_vod_muted;

                $check = $vod->checkMutedVod(true, $force);

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

            $stored_data_file = $streamer->getFolder() . DIRECTORY_SEPARATOR . "playlists_{$streamer->username}.json";
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

    public function sub(Request $request, Response $response, $args)
    {

        $response->getBody()->write('<h1>Subbing...</h1>');

        $streamers = TwitchConfig::getStreamers();

        foreach ($streamers as $k => $v) {

            $username = $v['username'];

            $response->getBody()->write('<strong>Subbing to ' . $username . '...</strong>');

            $response->getBody()->write('<pre>');

            $ret = TwitchHelper::sub($username);

            if ($ret === true) {
                $response->getBody()->write('Subscription request sent, check logs for details');
            } else {
                $response->getBody()->write("Error: {$ret}");
            }

            $response->getBody()->write('</pre>');

            $response->getBody()->write('<hr />');

            // sleep(2);

        }

        if (count($streamers) == 0) $response->getBody()->write('No channels to subscribe to');

        // store data to disk
        $subs = TwitchHelper::getSubs();
        $subfile = TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . "subs.json";
        $subs_data = [];
        // if (file_exists($subfile)) $subs_data = json_decode(file_get_contents($subfile), true);

        $response->getBody()->write('<br>Checking subs status...');
        if ($subs['data']) {

            foreach ($subs['data'] as $data) {

                $user_id = explode("=", $data['topic'])[1];

                $user_data = TwitchHelper::getChannelData($user_id);
                $username = $user_data['display_name'];
                
                $response->getBody()->write("<br>Inserting data for {$username}");

                $subs_data[$username] = [
                    'topic' => $data['topic'],
                    'user_id' => $user_id,
                    'username' => $username,
                    'subbed_at' => date(TwitchHelper::DATE_FORMAT),
                    'expires_at' => $data['expires_at']
                ];
            }
        }else{
            $response->getBody()->write('<br>No sub data.');
        }

        $response->getBody()->write("<br>Saving subs data...");

        file_put_contents($subfile, json_encode($subs_data));

        // save cron last
        file_put_contents(TwitchHelper::$cron_folder . DIRECTORY_SEPARATOR . "sub", time());

        return $response;
    }
}
