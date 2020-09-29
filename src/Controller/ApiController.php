<?php

namespace App\Controller;

use Slim\Psr7\Request;
use Slim\Psr7\Response;
use Slim\Views\Twig;

use App\TwitchAutomator;
use App\TwitchConfig;
use App\TwitchHelper;
use App\TwitchVOD;
use App\TwitchChannel;

class ApiController
{

    /**
     * @var Twig
     */
    private $twig;

    public function __construct(Twig $twig)
    {
        $this->twig = $twig;
    }

    private function generateStreamerList(){

        $total_size = 0;

        $streamerListStatic = TwitchConfig::getStreamers();
        $streamerList = [];

        foreach ($streamerListStatic as $streamer) {

            $data = new TwitchChannel();
            $data->load( $streamer['username'] );

            $total_size += $data->vods_size;

            $streamerList[] = $data;

        }
        return [ $streamerList, $total_size ];
    }

    public function list( Request $request, Response $response, $args ) {
        
        list($streamerList, $total_size) = $this->generateStreamerList();

        $data = [
            'streamerList' => $streamerList,
            // 'clips' => glob(TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . "clips" . DIRECTORY_SEPARATOR . "*.mp4"),
            'total_size' => $total_size,
            'free_size' => disk_free_space( TwitchHelper::vod_folder() )
        ];
        
        $payload = json_encode([
            'data' => $data,
            'status' => 'OK'
        ]);
        $response->getBody()->write($payload);
        
        return $response->withHeader('Content-Type', 'application/json')->withHeader('Access-Control-Allow-Origin', '*');

    }

    public function vod( Request $request, Response $response, $args ) {

        $vod = $args['vod'];

        $username = explode("_", $vod)[0];

        $vodclass = new TwitchVOD();
        $vodclass->load( TwitchHelper::vod_folder($username) . DIRECTORY_SEPARATOR . $vod . '.json');

        $data = $vodclass;

        $payload = json_encode([
            'data' => $data,
            'status' => 'OK'
        ]);
        $response->getBody()->write($payload);
        return $response->withHeader('Content-Type', 'application/json');

    }

    public function render_menu( Request $request, Response $response, $args ) {
        
        list($streamerList, $total_size) = $this->generateStreamerList();
        
        return $this->twig->render($response, 'components/menu.twig', [
            'streamerList' => $streamerList
        ]);

    }

    public function render_log( Request $request, Response $response, $args ) {
        
        $log_lines = [];

        $current_log = date("Y-m-d");
        if( isset($args['filename']) ) $current_log = $args['filename'];

        $log_path = __DIR__ . "/../../logs/" . $current_log . ".log.json";

        if( file_exists( $log_path ) ){
            
            $json = json_decode( file_get_contents( $log_path ), true );
            
            foreach( $json as $line ){

                if( !TwitchConfig::cfg("debug") && $line["level"] == 'DEBUG' ) continue;

                if( $line["date"] ){
                    $dt = \DateTime::createFromFormat("U.u", $line["date"]);
                    if($dt){
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
        
        return $this->twig->render($response, 'components/logviewer.twig', [
            'log_lines' => $log_lines
        ]);

    }

    public function render_streamer( Request $request, Response $response, $args ) {

        $username = $args['username'];

        /*
        $data = TwitchConfig::getStreamer($username);

        $data['channel_data'] = TwitchHelper::getChannelData( $data['username'] );

        $data['vods_raw'] = glob(TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . $data['username'] . "_*.json");

        $data['vods_list'] = [];

        $data['vods_size'] = 0;

        foreach ($data['vods_raw'] as $k => $v) {

            $vodclass = new TwitchVOD();
            if(!$vodclass->load($v)) continue;

            if ($vodclass->is_recording){
                $data['is_live'] = true;
                $data['current_vod'] = $vodclass;
                $data['current_game'] = $vodclass->getCurrentGame();
            }

            if ($vodclass->segments) {
                foreach ($vodclass->segments_raw as $s) {
                    $data['vods_size'] += filesize(TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . $s );
                }
            }

            $data['vods_list'][] = $vodclass;

        }
        */

        $data = new TwitchChannel();
        $data->load( $username );

        return $this->twig->render($response, 'components/streamer.twig', [
            'streamer' => $data
        ]);

    }

    public function check_vods( Request $request, Response $response, $args ) {

        list($streamerList, $total_size) = $this->generateStreamerList();

        $data = [];

        foreach( $streamerList as $streamer ){

            foreach( $streamer->vods_list as $vod ){

                $check = $vod->checkValidVod();

                if( $vod->twitch_vod_id && !$check ){
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

}