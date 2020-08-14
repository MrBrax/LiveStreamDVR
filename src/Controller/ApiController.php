<?php

namespace App\Controller;

use Slim\Psr7\Request;
use Slim\Psr7\Response;
use Slim\Views\Twig;

use App\TwitchAutomator;
use App\TwitchConfig;
use App\TwitchHelper;
use App\TwitchVOD;

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

            $data = $streamer;

            $data['channel_data'] = TwitchHelper::getChannelData( $streamer['username'] );

            $data['vods_raw'] = glob(TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . $streamer['username'] . "_*.json");

            $data['vods_list'] = [];

            $data['vods_size'] = 0;

            foreach ($data['vods_raw'] as $k => $v) {

                $vodclass = new TwitchVOD();
                $vodclass->load($v);

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

            $total_size += $data['vods_size'];

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

        $vodclass = new TwitchVOD();
        $vodclass->load( TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . $vod . '.json');

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

    public function render_streamer( Request $request, Response $response, $args ) {

        $username = $args['username'];

        $data = TwitchConfig::getStreamer($username);

        $data['channel_data'] = TwitchHelper::getChannelData( $data['username'] );

        $data['vods_raw'] = glob(TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . $data['username'] . "_*.json");

        $data['vods_list'] = [];

        $data['vods_size'] = 0;

        foreach ($data['vods_raw'] as $k => $v) {

            $vodclass = new TwitchVOD();
            $vodclass->load($v);

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

        return $this->twig->render($response, 'components/streamer.twig', [
            'streamer' => $data
        ]);

    }

}