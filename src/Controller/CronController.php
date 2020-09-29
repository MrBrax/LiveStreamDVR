<?php

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
    private function generateStreamerList(){

        $streamerListStatic = TwitchConfig::getStreamers();
        $streamerList = [];

        foreach ($streamerListStatic as $streamer) {

            $data = new TwitchChannel();
            $data->load( $streamer['username'] );

            $streamerList[] = $data;

        }
        return $streamerList;
    }

    public function check_deleted_vods( Request $request, Response $response, $args ) {

        $streamerList = $this->generateStreamerList();

        $data = [];

        foreach( $streamerList as $streamer ){

            foreach( $streamer->vods_list as $vod ){

                $check = $vod->checkValidVod();

                if( $vod->twitch_vod_id && !$check ){
                    // notify
                    $response->getBody()->write( $vod->basename . " deleted<br>\n" );
                }

            }

        }

        return $response;

    }

    public function check_muted_vods( Request $request, Response $response, $args ) {

        $streamerList = $this->generateStreamerList();

        $data = [];

        foreach( $streamerList as $streamer ){

            foreach( $streamer->vods_list as $vod ){

                $old = $vod->twitch_vod_muted;

                $check = $vod->checkMutedVod();

                if( $check === true ){
                    // notify
                    $response->getBody()->write( $vod->basename . " muted<br>\n" );
                }elseif( $check === false ){
                    // $response->getBody()->write( $vod->basename . " not muted<br>\n" );
                }

            }

        }

        return $response;

    }

}