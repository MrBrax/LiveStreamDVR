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

    private $notify_cache = [];
    private $notify_cache_file = __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "cache" . DIRECTORY_SEPARATOR . "notify.json";

    public function __construct(){
        $this->notify_cache = file_exists($this->notify_cache_file) ? json_decode( file_get_contents( $this->notify_cache_file ), true ) : [];
    }

    private function saveNotifyCache(){
        file_put_contents( $this->notify_cache_file, json_encode( $this->notify_cache ) );
    }

    private function addToNotifyCache( $string ){
        array_push( $this->notify_cache, $string );
        $this->saveNotifyCache();
    }

    private function isInNotifyCache( $string ){
        return in_array( $string, $this->notify_cache );
    }

    private function sendNotify( $string ){
        TwitchHelper::log( TwitchHelper::LOG_INFO, "Notification: " . $string);
        // this is where it would notify if i had a solution
    }

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

                if( $this->isInNotifyCache( 'deleted_' . $vod->basename ) ) continue;

                $check = $vod->checkValidVod( true );

                if( $vod->twitch_vod_id && !$check ){
                    // notify
                    $this->sendNotify( $vod->basename . " deleted" );
                    $response->getBody()->write( $vod->basename . " deleted<br>\n" );
                    $this->addToNotifyCache( 'deleted_' . $vod->basename );
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

                if( $this->isInNotifyCache( 'mute_' . $vod->basename ) ) continue;

                $old = $vod->twitch_vod_muted;

                $check = $vod->checkMutedVod();

                if( $check === true ){
                    // notify
                    $this->sendNotify( $vod->basename . " muted" );
                    $response->getBody()->write( $vod->basename . " muted<br>\n" );
                    $this->addToNotifyCache( 'mute_' . $vod->basename );
                }elseif( $check === false ){
                    // $response->getBody()->write( $vod->basename . " not muted<br>\n" );
                }

            }

        }

        return $response;

    }

}