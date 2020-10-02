<?php

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

            /*
            $data = $streamer;

            $data['channel_data'] = TwitchHelper::getChannelData( $streamer['username'] );

            $data['vods_raw'] = glob(TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . $streamer['username'] . "_*.json");

            $data['vods_list'] = [];

            $data['vods_size'] = 0;

            foreach ($data['vods_raw'] as $k => $v) {

                $vodclass = new TwitchVOD();
                if(!$vodclass->load($v)) continue;

                if( $rebuild_segments ){
                    $vodclass->rebuildSegmentList();
                }

                if( $match_vod ){
                    if( $vodclass->matchTwitchVod() ){
                        $vodclass->saveJSON();
                    }
                }

                if ($vodclass->is_recording){
                    $data['is_live'] = true;
                    $data['current_vod'] = $vodclass;
                    $data['current_game'] = $vodclass->getCurrentGame();
                }

                if ($checkvod && !$vodclass->is_recording) {
                    $isvalid = $vodclass->checkValidVod();
                    if (!$isvalid) {
                        $is_a_vod_deleted = true;
                        echo '<!-- deleted: ' . $vodclass->basename . ' -->';
                    }
                }

                if ($vodclass->segments) {
                    foreach ($vodclass->segments as $s) {
                        $data['vods_size'] += filesize(TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . $s['basename'] );
                    }
                }

                $data['vods_list'][] = $vodclass;

            }

            $total_size += $data['vods_size'];
            */

            $data = new TwitchChannel();
            $data->load( $streamer['username'] );

            if( $match_vod ){
                $data->matchVods();
            }

            if( $checkvod ){
                if( $data->checkValidVods() ) $is_a_vod_deleted = true;
            }

            $total_size += $data->vods_size;

            $streamerList[] = $data;

        }

        $log_lines = [];

        $current_log = date("Y-m-d");
        if( isset($_GET['log']) ) $current_log = $_GET['log'];

        $log_path = __DIR__ . "/../../logs/" . $current_log . ".log.json";

        $log_files = array_map( 'basename', glob( __DIR__ . "/../../logs/*.log.json", GLOB_BRACE ) );

        if( file_exists( $log_path ) ){
            
            $json = json_decode( file_get_contents( $log_path ), true );
            
            foreach( $json as $line ){

                if( !TwitchConfig::cfg("debug") && $line["level"] == 'DEBUG' ) continue;

                /*
                $escaped_text = htmlentities($line["text"], ENT_QUOTES | ENT_HTML401 | ENT_SUBSTITUTE | ENT_DISALLOWED, 'UTF-8', true);

                $text_line = "";
                $date = \DateTime::createFromFormat("U.u", $line["date"]);
                if($date) $text_line .= $date->format("Y-m-d H:i:s.v");
                $text_line .= ' &lt;' . $line["level"] . '&gt; ';
                $text_line .= $escaped_text;
                echo '<div class="log_' . strtolower( $line["level"] ) . '">' . $text_line . '</div>';'
                */
                
                if( $line["date"] ){
                    $dt = \DateTime::createFromFormat( "U.u", $line["date"] );
                    if(!$dt) $dt = \DateTime::createFromFormat( "U", $line["date"] );
                    if($dt){
                        $dt->setTimezone( TwitchConfig::$timezone );
                        $line['date_string'] = $dt->format("Y-m-d H:i:s.v");
                    }else{
                        $line['date_string'] = "ERROR:" . $line["date"];
                    }
                }else{
                    $line['date_string'] = '???';
                }

                $log_lines[] = $line;

            }
        }

        $errors = [];

        if(!TwitchConfig::cfg('app_url')) $errors[] = 'No app url set, please visit settings.';
        if(!TwitchConfig::cfg('api_client_id')) $errors[] = 'No API client id set, please visit settings.';
        if(!TwitchConfig::cfg('api_secret')) $errors[] = 'No API secret set, please visit settings.';
        if(!TwitchConfig::cfg('bin_dir')) $errors[] = 'No Python bin directory set, please visit settings.';
        if(!TwitchHelper::path_ffmpeg()) $errors[] = 'No FFmpeg path set, please visit settings.';
        if(!TwitchHelper::path_mediainfo()) $errors[] = 'No MediaInfo path set, please visit settings.';

        return $this->twig->render($response, 'dashboard.twig', [
            'streamerList' => $streamerList,
            'clips' => glob(TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . "clips" . DIRECTORY_SEPARATOR . "*.mp4"),
            'total_size' => $total_size,
            'is_a_vod_deleted' => $is_a_vod_deleted,
            'checkvod' => $checkvod,
            'log_lines' => $log_lines,
            'log_files' => $log_files,
            'free_size' => disk_free_space( TwitchHelper::vod_folder() ),
            'errors' => $errors
        ]);

    }

}