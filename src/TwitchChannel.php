<?php

namespace App;

use DateTime;
use Exception;
use getID3;

class TwitchChannel {
    
    public $username = null;          
    public $login = null;             
    public $display_name = null;      
    public $description = null;       
    public $profile_image_url = null; 
    public $is_live = false;
    public $current_vod = null;
    public $current_game = null;
    public $current_duration = null;
    public $quality = [];

    public $vods_list = [];
    public $vods_raw = [];
    public $vods_size = 0;

    /**
	 * Load
	 *
	 * @param string $username
	 * @return bool
	 */
	public function load( $username ){

        $this->channel_data = TwitchHelper::getChannelData( $username );

        $config = TwitchConfig::getStreamer( $username );

        $this->username             = $this->channel_data['login'];
        $this->login                = $this->channel_data['login'];
        $this->display_name         = $this->channel_data['display_name'];
        $this->description          = $this->channel_data['description'];
        $this->profile_image_url    = $this->channel_data['profile_image_url'];
        $this->quality              = isset($config['quality']) ? $config['quality'] : "best";
        $this->match                = isset($config['match']) ? $config['match'] : [];

        $this->parseVODs();

    }

    private function parseVODs(){

        $this->vods_raw = glob( TwitchHelper::vod_folder( $this->display_name ) . DIRECTORY_SEPARATOR . $this->display_name . "_*.json" );

        foreach ($this->vods_raw as $k => $v) {

            $vodclass = new TwitchVOD();
            if(!$vodclass->load($v)) continue;

            if ($vodclass->is_recording){
                $this->is_live = true;
                $this->current_vod = $vodclass;
                $this->current_game = $vodclass->getCurrentGame();
                $this->current_duration = $vodclass->getDurationLive();
            }
            if ($vodclass->segments) {
                foreach ($vodclass->segments as $s) {
                    $this->vods_size += $s['filesize'];
                }
            }

            $this->vods_list[] = $vodclass;

        }

    }

    public function matchVods(){
        foreach( $this->vods_list as $vod ){
            if( $vod->matchTwitchVod() ){
                $vod->saveJSON();
            }
        }
    }

    public function checkValidVods(){

        $list = [];

        $is_a_vod_deleted = false;

        foreach( $this->vods_list as $vod ){
            $isvalid = $vod->checkValidVod();

            $list[ $vod->basename ] = $isvalid;

            if (!$isvalid) {
                $is_a_vod_deleted = true;
                // echo '<!-- deleted: ' . $vod->basename . ' -->';
            }
            
        }

        return $is_a_vod_deleted;

    }

}