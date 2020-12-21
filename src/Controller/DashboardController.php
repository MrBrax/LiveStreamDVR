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

class DashboardController
{
    /**
     * @var Twig
     */
    private $twig;

    public function __construct(Twig $twig)
    {
        $this->twig = $twig;
    }

    public function dashboard(Request $request, Response $response, array $args)
    {
        $total_size = 0;

        $streamerListStatic = TwitchConfig::getStreamers();
        $streamerList = [];

        $is_a_vod_deleted = false;

        $checkvod = isset($_GET['checkvod']);
        $match_vod = isset($_GET['match_vod']);
        $rebuild_segments = isset($_GET['rebuild_segments']);

        /*
        usort( $streamerListStatic, function($a, $b){
            return $a->display_name <=> $b->display_name;
        });
        */

        foreach ($streamerListStatic as $streamer) {

            $data = new TwitchChannel();
            $data->load($streamer['username']);

            if ($match_vod) {
                $data->matchVods();
            }

            if ($checkvod) {
                if ($data->checkValidVods()) $is_a_vod_deleted = true;
            }

            $total_size += $data->vods_size;

            $streamerList[] = $data;
        }

        $log_lines = [];

        $current_log = date("Y-m-d");
        if (isset($_GET['log'])) $current_log = $_GET['log'];

        $log_path = TwitchHelper::$logs_folder . DIRECTORY_SEPARATOR . $current_log . ".log.json";

        $log_files_raw = glob(TwitchHelper::$logs_folder . DIRECTORY_SEPARATOR . "*.log.json");
        if ($log_files_raw) $log_files = array_map('basename', $log_files_raw);

        if (file_exists($log_path)) {

            $json = json_decode(file_get_contents($log_path), true);

            foreach ($json as $line) {

                if (!TwitchConfig::cfg("debug") && $line["level"] == 'DEBUG') continue;

                /*
                $escaped_text = htmlentities($line["text"], ENT_QUOTES | ENT_HTML401 | ENT_SUBSTITUTE | ENT_DISALLOWED, 'UTF-8', true);

                $text_line = "";
                $date = \DateTime::createFromFormat("U.u", $line["date"]);
                if($date) $text_line .= $date->format("Y-m-d H:i:s.v");
                $text_line .= ' &lt;' . $line["level"] . '&gt; ';
                $text_line .= $escaped_text;
                echo '<div class="log_' . strtolower( $line["level"] ) . '">' . $text_line . '</div>';'
                */

                if ($line["date"]) {
                    $dt = \DateTime::createFromFormat("U.u", (string)$line["date"]);
                    if (!$dt) $dt = \DateTime::createFromFormat("U", $line["date"]);
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

        $errors = [];

        $history_data = file_exists(TwitchConfig::$historyPath) ? json_decode(file_get_contents(TwitchConfig::$historyPath), true) : [];
        while (count($history_data) > 20) {
            array_shift($history_data);
        }

        if (!TwitchConfig::cfg('app_url')) $errors[] = 'No app url set, please visit settings.';
        if (!TwitchConfig::cfg('api_client_id')) $errors[] = 'No API client id set, please visit settings.';
        if (!TwitchConfig::cfg('api_secret')) $errors[] = 'No API secret set, please visit settings.';
        if (!TwitchConfig::cfg('bin_dir')) $errors[] = 'No Python bin directory set, please visit settings.';
        if (!TwitchHelper::path_ffmpeg()) $errors[] = 'No FFmpeg path set, please visit settings.';
        if (!TwitchHelper::path_mediainfo()) $errors[] = 'No MediaInfo path set, please visit settings.';
        if (!getenv('PATH')) $errors[] = 'Environment variables not available, this could cause issues with the process library. Check the php.ini file for this.';

        if (TwitchConfig::cfg('bin_dir')) {
            if (!TwitchHelper::path_streamlink()) $errors[] = 'Streamlink not found. Please install it.';
            if (!TwitchHelper::path_youtubedl()) $errors[] = 'youtube-dl not found. Please install it.';
            // if(!TwitchHelper::path_tcd()) $errors[] = 'tcd not found. Please install it.';
        }

        return $this->twig->render($response, 'dashboard.twig', [
            'streamerList' => $streamerList,
            'clips' => glob(TwitchHelper::vodFolder() . DIRECTORY_SEPARATOR . "clips" . DIRECTORY_SEPARATOR . "*.mp4"),
            'total_size' => $total_size,
            'is_a_vod_deleted' => $is_a_vod_deleted,
            'checkvod' => $checkvod,
            'log_lines' => $log_lines,
            'log_files' => $log_files,
            'free_size' => disk_free_space(TwitchHelper::vodFolder()),
            'errors' => $errors,
            'history_data' => $history_data
        ]);
    }
}
