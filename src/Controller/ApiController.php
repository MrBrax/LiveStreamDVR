<?php

declare(strict_types=1);

namespace App\Controller;

use Slim\Psr7\Request;
use Slim\Psr7\Response;
use Slim\Views\Twig;

use App\TwitchAutomator;
use App\TwitchConfig;
use App\TwitchHelper;
use App\TwitchVOD;
use App\TwitchChannel;
use App\TwitchPlaylistAutomator;
use App\TwitchAutomatorJob;

use App\Traits\ApiVod;
use App\Traits\ApiChannel;
use App\Traits\ApiChannels;
use App\Traits\ApiSettings;
use App\Traits\ApiFavourites;
use App\Traits\ApiSubs;
use App\Traits\ApiTools;

class ApiController
{

    use ApiVod;

    use ApiChannels;
    use ApiChannel;

    use ApiSettings;
    use ApiFavourites;
    use ApiTools;
    use ApiSubs;

    /**
     * @var Twig
     */
    private $twig;

    public function __construct(Twig $twig)
    {
        $this->twig = $twig;
    }
    
    private function generateStreamerList()
    {

        $total_size = 0;

        $streamerListStatic = TwitchConfig::getStreamers();
        $streamerList = [];

        /*
        usort( $streamerListStatic, function($a, $b){
            return $a->display_name <=> $b->display_name;
        });
        */

        foreach ($streamerListStatic as $streamer) {

            $data = new TwitchChannel();
            $data->load($streamer['username'], true);

            $total_size += $data->vods_size;

            $streamerList[] = $data;
        }
        return [$streamerList, $total_size];
    }

    public function jobs_list(Request $request, Response $response, $args)
    {

        $current_jobs_raw = glob(TwitchHelper::$pids_folder . DIRECTORY_SEPARATOR . "*.json");
        $current_jobs = [];
        foreach ($current_jobs_raw as $v) {
            // $pid = file_get_contents($v);
            $job = new TwitchAutomatorJob(basename($v, ".json"));
            $job->load();
            $current_jobs[] = $job;
        }

        $payload = json_encode([
            'data' => $current_jobs,
            'status' => 'OK'
        ]);

        $response->getBody()->write($payload);
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function jobs_kill(Request $request, Response $response, $args)
    {

        $job = new TwitchAutomatorJob($args['job']);
        if ($job->load()) {
            $out = $job->kill();
            $payload = json_encode([
                'data' => $out == '' ? true : $out,
                'status' => 'OK'
            ]);
        } else {
            $payload = json_encode([
                'error' => 'Failed loading job',
                'status' => 'ERROR'
            ]);
        }

        $response->getBody()->write($payload);

        return $response->withHeader('Content-Type', 'application/json');
    }

    /*
    public function render_menu(Request $request, Response $response, $args)
    {

        list($streamerList, $total_size) = $this->generateStreamerList();

        return $this->twig->render($response, 'components/menu.twig', [
            'streamerList' => $streamerList
        ]);
    }

    public function render_log(Request $request, Response $response, $args)
    {

        $log_lines = [];

        $current_log = date("Y-m-d");
        if (isset($args['filename'])) $current_log = $args['filename'];

        $filter = isset($_GET['filter']) ? $_GET['filter'] : null;

        $log_path = TwitchHelper::$logs_folder . DIRECTORY_SEPARATOR . $current_log . ".log.json";

        if (file_exists($log_path)) {

            $json = json_decode(file_get_contents($log_path), true);

            if ($json) {

                foreach ($json as $line) {

                    if (!TwitchConfig::cfg("debug") && $line["level"] == 'DEBUG') continue;

                    // filter
                    if (isset($filter) && isset($line['module']) && $filter != $line['module']) {
                        continue;
                    }

                    if ($line["date"]) {
                        $dt = \DateTime::createFromFormat("U.u", (string)$line["date"]);
                        if (!$dt) $dt = \DateTime::createFromFormat("U", (string)$line["date"]);
                        if ($dt) {
                            $dt->setTimezone(TwitchConfig::$timezone);
                            $line['date_string'] = $dt->format("Y-m-d H:i:s.v");
                        } else {
                            $line['date_string'] = "ERROR:" . $line["date"];
                        }
                    } else {
                        $line['date_string'] = '???';
                    }

                    $log_lines[] = $line;
                }
            }
        }

        return $this->twig->render($response, 'components/logviewer.twig', [
            'log_lines' => $log_lines
        ]);
    }

    public function render_streamer(Request $request, Response $response, $args)
    {

        $username = $args['username'];

        $data = new TwitchChannel();
        $data->load($username);

        return $this->twig->render($response, 'components/streamer.twig', [
            'streamer' => $data
        ]);
    }
    */

    public function check_vods(Request $request, Response $response, $args)
    {

        list($streamerList, $total_size) = $this->generateStreamerList();

        $data = [];

        foreach ($streamerList as $streamer) {

            foreach ($streamer->vods_list as $vod) {

                $check = $vod->checkValidVod(true);

                if ($vod->twitch_vod_id && !$check) {
                    // notify
                }

                $data[] = [
                    'basename' => $vod->basename,
                    'finalized' => $vod->is_finalized,
                    'vod_id' => $vod->twitch_vod_id,
                    'exists' => $check,
                    'deleted' => $vod->twitch_vod_id && !$check,
                    'never_saved' => $vod->twitch_vod_neversaved
                ];
            }
        }

        $payload = json_encode([
            'data' => $data,
            'status' => 'OK'
        ]);
        $response->getBody()->write($payload);
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function twitchapi_videos(Request $request, Response $response, $args)
    {

        $username = $args['username'];

        $userid = TwitchHelper::getChannelId($username);

        $data = TwitchHelper::getVideos($userid);

        $payload = json_encode([
            'data' => $data,
            'status' => 'OK'
        ]);
        $response->getBody()->write($payload);
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function twitchapi_video(Request $request, Response $response, $args)
    {

        $video_id = $args['video_id'];

        $data = TwitchHelper::getVideo((int)$video_id);

        $payload = json_encode([
            'data' => $data,
            'status' => 'OK'
        ]);
        $response->getBody()->write($payload);
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function playlist_dump(Request $request, Response $response, $args)
    {

        $username = $args['username'];

        $pa = new TwitchPlaylistAutomator();
        $pa->setup($username, isset($_GET['quality']) ? $_GET['quality'] : 'best');

        // $output = TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . 'playlist' . DIRECTORY_SEPARATOR . $username . 'vod.ts';

        $pa->output_file = $pa->getCacheFolder() . DIRECTORY_SEPARATOR . $pa->username . '-' . $pa->video_id . '.ts';

        try {
            $data = $pa->downloadLatest();
        } catch (\Throwable $th) {
            $response->getBody()->write(json_encode([
                'error' => $th->getMessage(),
                'status' => 'ERROR'
            ]));
            return $response->withHeader('Content-Type', 'application/json');
        }

        $payload = json_encode([
            'data' => $data,
            'status' => 'OK'
        ]);
        $response->getBody()->write($payload);
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function games_list(Request $request, Response $response, $args)
    {

        $games = TwitchConfig::getGames();

        $payload = json_encode([
            'data' => $games,
            'status' => 'OK'
        ]);

        $response->getBody()->write($payload);
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function about(Request $request, Response $response, array $args)
    {

        $bins = [];

        $pip_requirements = [];
        $requirements_file = __DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'requirements.txt';
        if (file_exists($requirements_file)) {
            $requirements_data = file_get_contents($requirements_file);
            $lines = explode("\n", $requirements_data);
            foreach ($lines as $line) {
                preg_match("/^([a-z_-]+)([=<>]+)(.*)$/", $line, $matches);
                if ($matches) {
                    $pip_requirements[trim($matches[1])] = [
                        'comparator' => trim($matches[2]),
                        'version' => trim($matches[3])
                    ];
                }
            }
        }

        $bins['ffmpeg'] = [];
        $bins['ffmpeg']['path'] = TwitchHelper::path_ffmpeg();
        if (TwitchHelper::path_ffmpeg() && file_exists(TwitchHelper::path_ffmpeg())) {
            $out = TwitchHelper::exec([TwitchHelper::path_ffmpeg(), "-version"]);
            $out = explode("\n", $out)[0];
            $bins['ffmpeg']['status'] = $out;
        } else {
            $bins['ffmpeg']['status'] = 'Not installed.';
        }

        $bins['mediainfo'] = [];
        $bins['mediainfo']['path'] = TwitchHelper::path_mediainfo();
        if (TwitchHelper::path_mediainfo() && file_exists(TwitchHelper::path_mediainfo())) {
            $out = TwitchHelper::exec([TwitchHelper::path_mediainfo(), "--Version"]);
            if ($out) {
                $out = explode("\n", $out)[1];
                $bins['mediainfo']['status'] = $out;
            } else {
                $bins['mediainfo']['status'] = 'Output error.';
            }
        } else {
            $bins['mediainfo']['status'] = 'Not installed.';
        }

        // tcd
        $bins['tcd'] = [];
        $bins['tcd']['path'] = TwitchHelper::path_tcd();
        if (TwitchHelper::path_tcd() && file_exists(TwitchHelper::path_tcd())) {
            $out = TwitchHelper::exec([TwitchHelper::path_tcd(), "--version", "--settings-file", TwitchHelper::$config_folder . DIRECTORY_SEPARATOR . "tcd_settings.json"]);
            $bins['tcd']['status'] = $out;
            $bins['tcd']['installed'] = true;

            $version = trim(substr($bins['tcd']['status'], 23));
            if (version_compare($version, $pip_requirements['tcd']['version'], $pip_requirements['tcd']['comparator'])) {
                $bins['tcd']['update'] = 'Version OK';
            } else {
                $bins['tcd']['update'] = 'Please update to at least ' . $pip_requirements['tcd']['version'];
            }
        } else {
            $bins['tcd']['status'] = 'Not installed.';
        }


        // streamlink
        $bins['streamlink'] = [];
        $bins['streamlink']['path'] = TwitchHelper::path_streamlink();
        if (TwitchHelper::path_streamlink() && file_exists(TwitchHelper::path_streamlink())) {
            $out = TwitchHelper::exec([TwitchHelper::path_streamlink(), "--version"]);
            $bins['streamlink']['status'] = trim($out);
            $bins['streamlink']['installed'] = true;

            $version = trim(substr($bins['streamlink']['status'], 11));
            if (version_compare($version, $pip_requirements['streamlink']['version'], $pip_requirements['streamlink']['comparator'])) {
                $bins['streamlink']['update'] = 'Version OK';
            } else {
                $bins['streamlink']['update'] = 'Please update to at least ' . $pip_requirements['streamlink']['version'];
            }
        } else {
            $bins['streamlink']['status'] = 'Not installed.';
        }

        // youtube-dl
        $bins['youtubedl'] = [];
        $bins['youtubedl']['path'] = TwitchHelper::path_youtubedl();
        if (TwitchHelper::path_youtubedl() && file_exists(TwitchHelper::path_youtubedl())) {
            $out = TwitchHelper::exec([TwitchHelper::path_youtubedl(), "--version"]);
            $bins['youtubedl']['status'] = trim($out);
            $bins['youtubedl']['installed'] = true;

            if (version_compare(trim($out), $pip_requirements['youtube-dl']['version'], $pip_requirements['youtube-dl']['comparator'])) {
                $bins['youtubedl']['update'] = 'Version OK';
            } else {
                $bins['youtubedl']['update'] = 'Please update to at least ' . $pip_requirements['youtube-dl']['version'];
            }
        } else {
            $bins['youtubedl']['status'] = 'Not installed.';
        }

        $bins['twitchdownloader'] = [];
        $bins['twitchdownloader']['path'] = TwitchHelper::path_twitchdownloader();
        if (TwitchHelper::path_twitchdownloader() && file_exists(TwitchHelper::path_twitchdownloader())) {
            try {
                $out = TwitchHelper::exec([TwitchHelper::path_twitchdownloader(), "--version"], true);
            } catch (\Throwable $th) {
                $out = $th->getMessage();
            }
            $bins['twitchdownloader']['status'] = trim($out);
            $bins['twitchdownloader']['installed'] = true;
        } else {
            $bins['twitchdownloader']['status'] = 'Not installed';
        }


        $bins['pipenv'] = [];
        $bins['pipenv']['path'] = TwitchHelper::path_pipenv();
        if (TwitchHelper::path_pipenv() && file_exists(TwitchHelper::path_pipenv())) {
            $out = TwitchHelper::exec([TwitchHelper::path_pipenv(), "--version"]);
            $bins['pipenv']['status'] = trim($out);
            $bins['pipenv']['installed'] = true;
        } else {
            $bins['pipenv']['status'] = 'Not installed';
        }
        $bins['pipenv']['status'] .= TwitchConfig::cfg('pipenv_enabled') ? ', <em>enabled</em>.' : ', <em>not enabled</em>.';


        $bins['python'] = [];
        $out = TwitchHelper::exec(["python", "--version"]);
        $bins['python']['version'] = trim($out);

        $bins['python3'] = [];
        $out = TwitchHelper::exec(["python3", "--version"]);
        $bins['python3']['version'] = trim($out);

        $bins['php'] = [];
        $bins['php']['version'] = phpversion();
        $bins['php']['platform'] = PHP_OS;
        $bins['php']['platform_family'] = PHP_OS_FAMILY;
        $bins['php']['sapi'] = PHP_SAPI;
        $bins['php']['user'] = get_current_user();
        $bins['php']['pid'] = getmypid();
        $bins['php']['uid'] = getmyuid();
        $bins['php']['gid'] = getmygid();

        $cron_lastrun = [];
        foreach( ['check_deleted_vods', 'check_muted_vods', 'dump_playlists', 'sub'] as $cron ){
            $fp = TwitchHelper::$cron_folder . DIRECTORY_SEPARATOR . $cron;
            if(file_exists($fp)){
                $t = (int)file_get_contents($fp);
                $cron_lastrun[$cron] = date("Y-m-d H:i:s", $t);
            }else{
                $cron_lastrun[$cron] = "Never run";
            }
        }

        $data = [
            'bins' => $bins,
            'cron_lastrun' => $cron_lastrun,
            'is_docker' => getenv('TCD_DOCKER') == 1
            // 'envs' => TwitchConfig::cfg('debug') ? getenv() : null
        ];

        $payload = json_encode([
            'data' => $data,
            'status' => 'OK'
        ]);

        $response->getBody()->write($payload);

        return $response->withHeader('Content-Type', 'application/json');

    }

    public function display_log(Request $request, Response $response, $args)
    {

        $log_lines = [];

        $current_log    = $args['filename'];
        $last_line      = isset($args['last_line']) ? $args['last_line'] : null;

        $filter = isset($_GET['filter']) ? $_GET['filter'] : null;

        $log_path = TwitchHelper::$logs_folder . DIRECTORY_SEPARATOR . $current_log . ".log.json";

        $line_num = 0;

        if (file_exists($log_path)) {

            $json = json_decode(file_get_contents($log_path), true);

            if ($json) {
                
                foreach ($json as $line) {

                    $line_num++;
                    if($last_line && $line_num <= $last_line) continue;

                    if (!TwitchConfig::cfg("debug") && $line["level"] == 'DEBUG') continue;

                    // filter
                    if (isset($filter) && isset($line['module']) && $filter != $line['module']) {
                        continue;
                    }

                    if ($line["date"]) {
                        $dt = \DateTime::createFromFormat("U.u", (string)$line["date"]);
                        if (!$dt) $dt = \DateTime::createFromFormat("U", (string)$line["date"]);
                        if ($dt) {
                            $dt->setTimezone(TwitchConfig::$timezone);
                            $line['date_string'] = $dt->format("Y-m-d H:i:s.v");
                        } else {
                            $line['date_string'] = "ERROR:" . $line["date"];
                        }
                    } else {
                        $line['date_string'] = '???';
                    }

                    $log_lines[] = $line;
                }
            }
        }

        $payload = json_encode([
            'data' => [
                'lines' => $log_lines,
                'last_line' => $line_num,
            ],
            'status' => 'OK'
        ]);

        $response->getBody()->write($payload);
        return $response->withHeader('Content-Type', 'application/json');
        
    }

    public function hook(Request $request, Response $response, $args)
    {

        set_time_limit(0);

        $source = isset($_GET['source']) ? $_GET['source'] : 'twitch';

        $data_json = json_decode(file_get_contents('php://input'), true);
        $data_headers = $request->getHeaders();
        $post_json = isset($_POST['json']) ? $_POST['json'] : null;

        TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "hook", "Hook called", ['GET' => $_GET, 'POST' => $_POST, 'HEADERS' => $data_headers]);

        if (TwitchConfig::cfg('instance_id')) {
            if (!isset($_GET['instance']) || $_GET['instance'] != TwitchConfig::cfg('instance_id')) {
                TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "hook", "Hook called with the wrong instance (" . $_GET['instance'] . ")");
                $response->getBody()->write("Invalid instance");
                return $response;
            }
        }

        // handle regular hook
        if ($source == 'twitch') {
            
            if ($post_json) {
                TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "hook", "Custom payload received...");
                $data_json = json_decode($post_json, true);
            }

            if ($data_json) {

                if($data_json["challenge"]){
                    
                    $challenge = $data_json["challenge"];
                    $subscription = $data_json["subscription"];
                    $username = TwitchHelper::getChannelUsername($subscription["condition"]["broadcaster_user_id"]);
                    // $signature = $response->getHeader("Twitch-Eventsub-Message-Signature");
                    
                    TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "hook", "Challenge received for {$subscription["condition"]["broadcaster_user_id"]}:{$subscription["type"]} ({$subscription["id"]})", ['GET' => $_GET, 'POST' => $_POST, 'HEADERS' => $data_headers]);
        
                    // calculate signature
                    /*
                        hmac_message = headers['Twitch-Eventsub-Message-Id'] + headers['Twitch-Eventsub-Message-Timestamp'] + request.body
                        signature = hmac_sha256(webhook_secret, hmac_message)
                        expected_signature_header = 'sha256=' + signature.hex()
        
                        if headers['Twitch-Eventsub-Message-Signature'] != expected_signature_header:
                            return 403
                    */

                    $twitch_message_id = $request->getHeader("Twitch-Eventsub-Message-Id")[0];
                    $twitch_message_timestamp = $request->getHeader("Twitch-Eventsub-Message-Timestamp")[0];
                    $twitch_message_signature = $request->getHeader("Twitch-Eventsub-Message-Signature")[0];

                    $hmac_message = 
                        $twitch_message_id .
                        $twitch_message_timestamp .
                        $request->getBody()->getContents();
                    
                    $signature = hash_hmac("sha256", $hmac_message, TwitchConfig::cfg("eventsub_secret"));

                    // $signature = hash_hmac("sha256", TwitchConfig::cfg("eventsub_secret"), $hmac_message);
                    $expected_signature_header = "sha256=${signature}";
                        
                    // check signature
                    if ($twitch_message_signature !== $expected_signature_header){
                        $response->getBody()->write("Invalid signature check");
                        TwitchHelper::logAdvanced(
                            TwitchHelper::LOG_ERROR,
                            "hook",
                            "Invalid signature check: {$twitch_message_signature} !== {$expected_signature_header}",
                            [
                                'GET' => $_GET,
                                'POST' => $_POST,
                                'HEADERS' => $data_headers,
                                'secret' => TwitchConfig::cfg("eventsub_secret"),
                                'hmac_message' => $hmac_message,
                                'calculated_signature' => $signature,
                                'expected_signature_header' => $expected_signature_header,
                                'twitch_signature' => $twitch_message_signature,
                        ]);
                        return $response->withStatus(400);
                    }
        
                    TwitchHelper::logAdvanced(TwitchHelper::LOG_SUCCESS, "hook", "Challenge completed, subscription active for {$subscription["condition"]["broadcaster_user_id"]}:{$subscription["type"]} ({$subscription["id"]}).", ['GET' => $_GET, 'POST' => $_POST, 'HEADERS' => $data_headers]);
        
                    // return the challenge string to twitch if signature matches
                    $response->getBody()->write($challenge);
                    return $response->withStatus(202);
        
                }

                if (TwitchConfig::cfg('debug')) {
                    TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "hook", "Dumping payload...");
                    file_put_contents(__DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . 'payloads' . DIRECTORY_SEPARATOR . date("Y-m-d.h_i_s") . '.json', json_encode($data_json));
                }

                TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "hook", "Run handle...");
                $TwitchAutomator = new TwitchAutomator();
                $TwitchAutomator->handle($data_json, $data_headers);
                return $response;
            }
        }

        TwitchHelper::logAdvanced(TwitchHelper::LOG_WARNING, "hook", "Hook called with no data ({$source})...", ['GET' => $_GET, 'POST' => $_POST, 'HEADERS' => $data_headers]);
        $response->getBody()->write("No data supplied");

        return $response;
    }

}
