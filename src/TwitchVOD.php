<?php

namespace App;

use DateTime;
use Exception;
use getID3;

class TwitchVOD {
	
	public $vod_path = 'vods';

	public $filename = '';
	public $basename = '';
	public $json = [];
	public $meta = [];

	public $streamer_name = null;
	public $streamer_id = null;

	public $segments = [];
	public $segments_raw = [];

	/**
	 * Chapters
	 *
	 * @var [ 'time', 'game_id', 'game_name', 'viewer_count', 'title', 'datetime', 'offset', 'duration' ]
	 */
	public $chapters = [];

	public $started_at = null;
	public $ended_at = null;

	// public $duration = null; // deprecated?
	public $duration_seconds = null;

	public $game_offset = null;

	public $stream_resolution = null;

	// TODO: make these into an array instead
	public $twitch_vod_id = null;
	public $twitch_vod_url = null;
	public $twitch_vod_duration = null;
	public $twitch_vod_title = null;
	public $twitch_vod_date = null;
	public $twitch_vod_exists = null;
	public $twitch_vod_attempted = null;
	public $twitch_vod_neversaved = null;
	public $twitch_vod_muted = null;

	public $is_recording = false;
	public $is_converted = false;
	public $is_capturing = false;
	public $is_converting = false;
	public $is_finalized = false;

	public $video_fail2 = false;
	public $video_metadata = [];

	public $is_chat_downloaded = false;
	public $is_vod_downloaded = false;

	public $dt_ended_at = null;
	public $dt_capture_started = null;
	public $dt_conversion_started = null;

	public $is_lossless_cut_generated = false;

	public $json_hash = null;

	public $created = false;
	public $force_record = false;

	/**
	 * Load a VOD with a JSON file
	 *
	 * @param string $filename
	 * @return bool
	 */
	public function load( $filename ){

		TwitchHelper::log( TwitchHelper::LOG_DEBUG, "Loading VOD Class for " . $filename);

		if(!file_exists($filename)){
			TwitchHelper::log( TwitchHelper::LOG_FATAL, "VOD Class for " . $filename . " not found");
			throw new \Exception('VOD not found');
			return false;
		}

		$data = file_get_contents($filename);

		if( !$data || strlen($data) == 0 || filesize($filename) == 0 ){
			TwitchHelper::log( TwitchHelper::LOG_FATAL, "Tried to load " . $filename . " but no data was returned");
			return false;
		}

		

		$this->json = json_decode($data, true);
		$this->json_hash = md5($data);

		/*
		if( !$this->json['meta']['data'][0]['user_name'] ){
			TwitchHelper::log( TwitchHelper::LOG_FATAL, "Tried to load " . $filename . " but found no streamer name");
			// throw new \Exception('Tried to load ' . $filename . ' but found no streamer name');
			return false;
		}
		*/

		if( $this->json['started_at'] && isset( $this->json['started_at']['date'] ) ){
			$this->started_at = new \DateTime( $this->json['started_at']['date'] );
		}else{
			$this->started_at = \DateTime::createFromFormat("Y-m-d\TH:i:s\Z", $this->json['started_at'] );
		}

		if( $this->json['ended_at'] && isset( $this->json['ended_at']['date'] ) ){
			$this->ended_at = new \DateTime( $this->json['ended_at']['date'] );
		}else{
			$this->ended_at = \DateTime::createFromFormat("Y-m-d\TH:i:s\Z", $this->json['ended_at'] );
		}

		if( $this->json['saved_at'] && isset( $this->json['saved_at']['date'] ) ){
			$this->saved_at = new \DateTime( $this->json['saved_at']['date'] );
		}

		$this->filename = $filename;
		$this->basename = basename($filename, '.json');
		$this->directory = dirname( $filename );

		$this->is_recording = file_exists( $this->directory . DIRECTORY_SEPARATOR . $this->basename . '.ts' );
		$this->is_converted = file_exists( $this->directory . DIRECTORY_SEPARATOR . $this->basename . '.mp4' );

		$this->is_capturing 	= isset($this->json['is_capturing']) ? $this->json['is_capturing'] : false;
		$this->is_converting 	= isset($this->json['is_converting']) ? $this->json['is_converting'] : false;
		$this->is_finalized 	= isset($this->json['is_finalized']) ? $this->json['is_finalized'] : false;

		$this->streamer_name = $this->json['meta']['data'][0]['user_name'];
		$this->streamer_id = TwitchHelper::getChannelId( $this->streamer_name );

		$this->twitch_vod_id 			= isset($this->json['twitch_vod_id']) ? $this->json['twitch_vod_id'] : null;
		$this->twitch_vod_url 			= isset($this->json['twitch_vod_url']) ? $this->json['twitch_vod_url'] : null;
		$this->twitch_vod_duration 		= isset($this->json['twitch_vod_duration']) ? $this->json['twitch_vod_duration'] : null;
		$this->twitch_vod_title 		= isset($this->json['twitch_vod_title']) ? $this->json['twitch_vod_title'] : null;
		$this->twitch_vod_date 			= isset($this->json['twitch_vod_date']) ? $this->json['twitch_vod_date'] : null;
		$this->twitch_vod_neversaved 	= isset($this->json['twitch_vod_neversaved']) ? $this->json['twitch_vod_neversaved'] : null;
		$this->twitch_vod_attempted 	= isset($this->json['twitch_vod_attempted']) ? $this->json['twitch_vod_attempted'] : null;
		$this->twitch_vod_muted 		= isset($this->json['twitch_vod_muted']) ? $this->json['twitch_vod_muted'] : null;

		$this->force_record				= isset($this->json['force_record']) ? $this->json['force_record'] : false;

		$this->stream_resolution		= isset($this->json['stream_resolution']) ? $this->json['stream_resolution'] : null;

		$this->meta = $this->json['meta'];

		if( isset($this->json['dt_capture_started']) ){
			$this->dt_capture_started 		= new \DateTime($this->json['dt_capture_started']['date']);
			$this->dt_conversion_started 	= new \DateTime($this->json['dt_conversion_started']['date']);
			$this->dt_ended_at 				= new \DateTime($this->json['dt_ended']['date']);
		}

		// $this->duration 			= $this->json['duration'];
		$this->duration_seconds 	= $this->json['duration_seconds'] ?: null;

		$this->video_fail2 			= isset($this->json['video_fail2']) ? $this->json['video_fail2'] : false;
		$this->video_metadata		= isset($this->json['video_metadata']) ? $this->json['video_metadata'] : null;

		if( isset( $this->json['chapters'] ) && count( $this->json['chapters'] ) > 0 ){
			$this->parseChapters( $this->json['chapters'] );
		}else{
			TwitchHelper::log( TwitchHelper::LOG_ERROR, "No chapters on " . $this->basename . "!");
		}

		if( $this->is_finalized ){
			$this->segments_raw = $this->json['segments_raw'];
			$this->parseSegments( $this->segments_raw );
			if( !$this->duration_seconds ){
				TwitchHelper::log(TwitchHelper::LOG_DEBUG, "VOD " . $this->basename . " finalized but no duration, trying to fix" );
				$this->getDuration(true);
			}
		}

		if( !$this->video_metadata && $this->is_finalized && count($this->segments_raw) > 0 && !$this->video_fail2 && TwitchHelper::path_mediainfo() ){
			TwitchHelper::log(TwitchHelper::LOG_DEBUG, "VOD " . $this->basename . " finalized but no metadata, trying to fix" );
			$this->getMediainfo();
			$this->saveJSON();
		}

		$this->is_chat_downloaded = file_exists( $this->directory . DIRECTORY_SEPARATOR . $this->basename . '.chat' );
		$this->is_vod_downloaded = file_exists( $this->directory . DIRECTORY_SEPARATOR . $this->basename . '.vod.ts' );
		$this->is_lossless_cut_generated = file_exists( $this->directory . DIRECTORY_SEPARATOR . $this->basename . '-llc-edl.csv' );

		return true;

	}

	// test
	public function create( $filename ){
		$this->created = true;
		$this->filename = $filename;
		$this->basename = basename($filename, '.json');
		$this->saveJSON();
		return true;
	}

	public function refreshJSON(){
		if(!$this->filename){
			TwitchHelper::log( TwitchHelper::LOG_ERROR, "Can't refresh vod, not found!");
			return false;
		}
		TwitchHelper::log( TwitchHelper::LOG_INFO, "Refreshing JSON on " . $this->basename . "!");
		$this->load( $this->filename );
	}

	/**
	 * Get duration of the mp4 file.
	 *
	 * @param boolean $save Save the duration to the JSON file
	 * @return string Duration in seconds
	 */
	public function getDuration( $save = false ){

		if( isset($this->duration_seconds) && $this->duration_seconds !== null ){
			// TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Returning saved duration for " . $this->basename . ": " . $this->duration_seconds );
			return $this->duration_seconds;
		}

		if( $this->video_metadata ){
			if( isset($this->video_metadata['general']['Duration']) ){
				TwitchHelper::log(TwitchHelper::LOG_DEBUG, "No duration_seconds but metadata exists for " . $this->basename . ": " . $this->video_metadata['general']['Duration'] );
				$this->duration_seconds = $this->video_metadata['general']['Duration'];
				return $this->video_metadata['general']['Duration'];
			}
			TwitchHelper::log(TwitchHelper::LOG_ERROR, "Video metadata for " . $this->basename . " does not include duration!" );
			return null;
		}

		if( $this->is_capturing || $this->is_recording ){
			TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Can't request duration because " . $this->basename . " is still recording!" );
			return null;
		}

		if( !$this->is_converted || $this->is_converting ){
			TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Can't request duration because " . $this->basename . " is converting!" );
			return null;
		}

		if( !$this->is_finalized ){
			TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Can't request duration because " . $this->basename . " is not finalized!" );
			return null;
		}

		if( !isset($this->segments_raw) || count($this->segments_raw) == 0 ){
			TwitchHelper::log(TwitchHelper::LOG_ERROR, "No video file available for duration of " . $this->basename);
			return null;
		}
		
		TwitchHelper::log(TwitchHelper::LOG_DEBUG, "No mediainfo for getDuration of " . $this->basename );	
		$file = $this->getMediainfo();

		if( !$file ){
			TwitchHelper::log(TwitchHelper::LOG_ERROR, "Could not find duration of " . $this->basename );			
			return null;
		}else{
		
			// $this->duration 			= $file['playtime_string'];
			$this->duration_seconds 	= $file['general']['Duration'];

			if( $save ){
				TwitchHelper::log(TwitchHelper::LOG_SUCCESS, "Saved duration for " . $this->basename);
				$this->saveJSON();
			}

			TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Duration fetched for " . $this->basename . ": " . $this->duration_seconds );

			return $this->duration_seconds;

		}
		
		TwitchHelper::log(TwitchHelper::LOG_ERROR, "Reached end of getDuration for " . $this->basename . ", this shouldn't happen!" );

	}

	public function getMediainfo( $segment_num = 0 ){

		TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Fetching mediainfo of " . $this->basename);

		if( !isset($this->segments_raw) || count($this->segments_raw) == 0 ){
			TwitchHelper::log(TwitchHelper::LOG_ERROR, "No segments available for mediainfo of " . $this->basename);
			return false;
		}

		$filename = $this->directory . DIRECTORY_SEPARATOR . basename( $this->segments_raw[ $segment_num ] );

		$output = shell_exec( TwitchHelper::path_mediainfo() . ' --Full --Output=JSON ' . escapeshellarg($filename) );

		if( $output ){
			
			$json = json_decode( $output, true );
			
			$data = [];

			foreach( $json['media']['track'] as $track ){
				if( $track["@type"] == "General"){
					$data['general'] = $track;
				}else if( $track["@type"] == "Video"){
					$data['video'] = $track;
				}else if( $track["@type"] == "Audio"){
					$data['audio'] = $track;
				}
			}

			$this->video_metadata = $data;

			return $this->video_metadata;

		}else{
			$this->video_fail2 = true;
			return false;
		}

	}

	public function getDurationLive(){
		if(!$this->started_at) return false;
		$diff = $this->started_at->diff( new \DateTime() );
        return $diff->format('%H:%I:%S');
	}

	/**
	 * Download chat with tcd
	 * @param  int 		$video_id [description]
	 * @param  string 	$basename [description]
	 * @return array    filename, cmd output, cmd
	 */
	public function downloadChat(){

		if(!file_exists( TwitchHelper::path_tcd() )){
			throw new \Exception('tcd not found');
			return false;
		}

		if(!$this->twitch_vod_id){
			throw new \Exception('no twitch vod id');
			return false;
		}

		$chat_filename = $this->directory . DIRECTORY_SEPARATOR . $this->basename . '.chat';

		$compressed_filename = $this->directory . DIRECTORY_SEPARATOR . $this->basename . '.chat.gz';

		$tcd_filename = $this->directory . DIRECTORY_SEPARATOR . $this->twitch_vod_id . '.json';

		if( TwitchConfig::cfg('chat_compress', false) ){

			if( file_exists( $compressed_filename ) ){
				TwitchHelper::log(TwitchHelper::LOG_ERROR, "Chat compressed already exists for " . $this->basename);
				return;
			}

			if( file_exists( $chat_filename ) ){
				TwitchHelper::log(TwitchHelper::LOG_WARNING, "Chat already exists for " . $this->basename);
				shell_exec( "gzip " . $chat_filename );
				return;
			}

		}else{
		
			if( file_exists( $chat_filename ) ){
				TwitchHelper::log(TwitchHelper::LOG_ERROR, "Chat already exists for " . $this->basename);
				return;
			}

		}		

		// if tcd generated file exists, rename it
		if( file_exists( $tcd_filename ) ){
			TwitchHelper::log(TwitchHelper::LOG_WARNING, "Renamed chat file for " . $this->basename);
			rename( $tcd_filename, $chat_filename );
			return;
		}

		if( TwitchConfig::cfg('pipenv') ){
			$cmd = 'pipenv run tcd';
		}else{
			$cmd = TwitchHelper::path_tcd();
		}
		
		$cmd .= ' --video ' . escapeshellarg($this->twitch_vod_id);
		$cmd .= ' --client-id ' . escapeshellarg( TwitchConfig::cfg('api_client_id') );
		$cmd .= ' --client-secret ' . escapeshellarg( TwitchConfig::cfg('api_secret') );
		$cmd .= ' --format json';
		if( TwitchConfig::cfg('debug', false) || TwitchConfig::cfg('app_verbose', false) ) $cmd .= ' --verbose --debug';
		$cmd .= ' --output ' . $this->directory;

		$capture_output = shell_exec( $cmd );

		file_put_contents( __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "logs" . DIRECTORY_SEPARATOR . "tcd_" . $this->basename . "_" . time() . ".log", "$ " . $cmd . "\n" . $capture_output);

		if( file_exists( $tcd_filename ) ){
			
			rename( $tcd_filename, $chat_filename );

			if( TwitchConfig::cfg('chat_compress', false) ){
				shell_exec( "gzip " . $chat_filename );
			}

		}else{
			
			TwitchHelper::log(TwitchHelper::LOG_ERROR, "No chat file for " . $this->basename . " created, output: " . $capture_output);
			
			return false;

		}

		return [$chat_filename, $capture_output, $cmd];

	}

	public function renderChat(){

		if(!$this->is_chat_downloaded){
			throw new \Exception('no chat downloaded');
			return false;
		}

		$chat_filename = $this->directory . DIRECTORY_SEPARATOR . $this->basename . '.chat';

		$video_filename = $this->directory . DIRECTORY_SEPARATOR . $this->basename . '_chat.mp4';

		// TwitchDownloaderCLI -m ChatRender -i KrustingKevin_2020-09-25T11_27_57Z_39847598366.chat -h 720 -w 300 --framerate 60 --update-rate 0 --font-size 18 -o chat.mp4

		$cmd = TwitchHelper::path_twitchdownloader();

		if( !$cmd ){
			throw new \Exception('twitchdownloader not installed');
			return false;
		}
		
		$cmd .= ' --mode ChatRender';
		$cmd .= ' --input ' . escapeshellarg( realpath( $chat_filename ) );
		$cmd .= ' --chat-height ' . escapeshellarg( $this->video_metadata['video']['Height'] );
		$cmd .= ' --chat-width 300';
		$cmd .= ' --framerate 60';
		$cmd .= ' --update-rate 0';
		$cmd .= ' --font-size 12';
		$cmd .= ' --background-color "#FF00FF"';
		$cmd .= ' --output ' . escapeshellarg($video_filename);
		$cmd .= ' 2>&1'; // console output

		$capture_output = shell_exec( $cmd );

		file_put_contents( __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "logs" . DIRECTORY_SEPARATOR . "tdrender_" . $this->basename . "_" . time() . ".log", "$ " . $cmd . "\n" . $capture_output);

		return [$video_filename, $capture_output, $cmd];

	}

	/**
	 * Fetch streamer's videos and try to match this VOD with an archived one.
	 *
	 * @return string
	 */
	public function matchTwitchVod(){

		TwitchHelper::log( TwitchHelper::LOG_INFO, "Try to match twitch vod for " . $this->basename);

		if( $this->twitch_vod_id ){
			TwitchHelper::log( TwitchHelper::LOG_WARNING, "Twitch vod already matched for " . $this->basename);
			return $this->twitch_vod_id;
		}

		if( $this->is_capturing || $this->is_converting ){
			TwitchHelper::log( TwitchHelper::LOG_WARNING, "Twitch vod can't match, recording in progress of " . $this->basename);
			return false;
		}

		$channel_videos = TwitchHelper::getVideos( $this->streamer_id );

		if( !$channel_videos ){
			TwitchHelper::log( TwitchHelper::LOG_ERROR, "No videos returned from streamer of " . $this->basename);
			$this->twitch_vod_neversaved = true;
			return false;
		}

		$vod_id = null;

		foreach ($channel_videos as $vid) {
			
			$video_time = \DateTime::createFromFormat( TwitchConfig::cfg('date_format'), $vid['created_at'] );

			// if within 5 minutes difference
			if( abs( $this->started_at->getTimestamp() - $video_time->getTimestamp() ) < 300 ){
				
				$this->twitch_vod_id 		= $vid['id'];
				$this->twitch_vod_url 		= $vid['url'];
				$this->twitch_vod_duration 	= TwitchHelper::parseTwitchDuration($vid['duration']);
				$this->twitch_vod_title 	= $vid['title'];
				$this->twitch_vod_date 		= $vid['created_at'];

				TwitchHelper::log( TwitchHelper::LOG_INFO, "Matched twitch vod for " . $this->basename);

				return $this->twitch_vod_id;

			}

		}

		$this->twitch_vod_attempted = true;
		$this->twitch_vod_neversaved = true;

		TwitchHelper::log( TwitchHelper::LOG_ERROR, "Couldn't match vod for " . $this->basename);

	}

	/**
	 * Check if VOD has been deleted from Twitch
	 *
	 * @return void
	 */
	public function checkValidVod(){

		if( !$this->twitch_vod_id ){
			TwitchHelper::log( TwitchHelper::LOG_ERROR, "No twitch VOD id for valid checking on " . $this->basename);
			return false;
			// throw new \Exception("No twitch vod id for valid checking on " . $this->basename);
			// return null;
		}

		TwitchHelper::log( TwitchHelper::LOG_INFO, "Check valid VOD for " . $this->basename);

		$video = TwitchHelper::getVideo( $this->twitch_vod_id );

		if( $video ){
			TwitchHelper::log( TwitchHelper::LOG_SUCCESS, "VOD exists for " . $this->basename);
			$this->twitch_vod_exists = true;
			return true;
		}

		TwitchHelper::log( TwitchHelper::LOG_WARNING, "No VOD for " . $this->basename);

		$this->twitch_vod_exists = false;

		return false;

	}

	/**
	 * Save JSON to file, be sure to load it first!
	 */
	public function saveJSON(){

		if( file_exists($this->filename) ){
			$tmp = file_get_contents($this->filename);
			if( md5($tmp) !== $this->json_hash){
				TwitchHelper::log(TwitchHelper::LOG_WARNING, "JSON has been changed since loading of " . $this->basename);
			}
		}

		if( $this->is_capturing || $this->is_converting || !$this->is_finalized ){
			TwitchHelper::log(TwitchHelper::LOG_WARNING, "Saving JSON of " . $this->basename . " while not finalized!");
		}

		if( !$this->chapters || count($this->chapters) == 0 ){
			TwitchHelper::log(TwitchHelper::LOG_WARNING, "Saving JSON of " . $this->basename . " with no chapters!!");
		}

		if( !$this->streamer_name && !$this->created ){
			TwitchHelper::log(TwitchHelper::LOG_FATAL, "Found no streamer name in class of " . $this->basename . ", not saving!");
			return false;
		}

		$generated = $this->json;

		if( $this->twitch_vod_id && $this->twitch_vod_url){
			$generated['twitch_vod_id'] 		= $this->twitch_vod_id;
			$generated['twitch_vod_url'] 		= $this->twitch_vod_url;
			$generated['twitch_vod_duration'] 	= $this->twitch_vod_duration;
			$generated['twitch_vod_title'] 		= $this->twitch_vod_title;
			$generated['twitch_vod_date'] 		= $this->twitch_vod_date;
		}

		$generated['twitch_vod_attempted'] 		= $this->twitch_vod_attempted;
		$generated['twitch_vod_neversaved'] 	= $this->twitch_vod_neversaved;
		$generated['twitch_vod_muted'] 			= $this->twitch_vod_muted;

		$generated['stream_resolution'] = $this->stream_resolution;

		$generated['streamer_name'] 	= $this->streamer_name;
		$generated['streamer_id'] 		= $this->streamer_id;

		$generated['started_at'] 		= $this->started_at;
		$generated['ended_at'] 			= $this->ended_at;

		$generated['chapters'] 			= $this->chapters;
		$generated['segments_raw'] 		= $this->segments_raw;
		$generated['segments'] 			= $this->segments;

		$generated['is_capturing']		= $this->is_capturing;
		$generated['is_converting']		= $this->is_converting;
		$generated['is_finalized']		= $this->is_finalized;

		// $generated['duration'] 			= $this->duration;
		$generated['duration_seconds'] 	= $this->duration_seconds ?: null;

		$generated['video_metadata'] 	= $this->video_metadata;
		$generated['video_fail2'] 		= $this->video_fail2;

		$generated['force_record'] 		= $this->force_record;

		$generated['meta']				= $this->meta;

		$generated['saved_at']			= new DateTime();
		
		if( !is_writable( $this->filename ) ){ // this is not the function i want
			// TwitchHelper::log(TwitchHelper::LOG_FATAL, "Saving JSON of " . $this->basename . " failed, permissions issue?");
			// return false;
		}
		

		TwitchHelper::log(TwitchHelper::LOG_SUCCESS, "Saving JSON of " . $this->basename);

		file_put_contents($this->filename, json_encode($generated));

		return $generated;

	}

	public function addSegment( $data ){
		TwitchHelper::log( TwitchHelper::LOG_DEBUG, "Adding segment to " . $this->basename . ": " . basename($data) );
		$this->segments_raw[] = basename($data);
	}

	public function addChapter( $data ){
		TwitchHelper::log( TwitchHelper::LOG_DEBUG, "Adding chapter to " . $this->basename);
		$this->chapters[] = $data;
	}

	/**
	 * Parse chapters from array and add it to the $this->chapters list
	 *
	 * @param array $array
	 * @return void
	 */
	private function parseChapters( $array ){

		if( !$array || count($array) == 0 ){
			TwitchHelper::log( TwitchHelper::LOG_ERROR, "No chapter data found for " . $this->basename);
			return false;
		}

		$chapters = [];

		// $data = isset($this->json['chapters']) ? $this->json['chapters'] : $this->json['games']; // why

		foreach($array as $chapter) {
			
			$entry = $chapter;

			$game_data = TwitchHelper::getGameData( $entry['game_id'] );

			// $entry = array_merge($game_data, $entry); // is this a good idea?

			$entry['datetime'] = \DateTime::createFromFormat( TwitchConfig::cfg("date_format"), $entry['time'] );

			if( TwitchConfig::$config['favourites'] ){
				$entry['favourite'] = TwitchConfig::$config['favourites'][ $entry['game_id'] ];
			}

			// offset
			if($this->started_at){
				$entry['offset'] = $entry['datetime']->getTimestamp() - $this->started_at->getTimestamp();
			}

			if( $this->is_finalized && $this->getDuration() !== false && $this->getDuration() > 0 ){
				$entry['width'] = ( $entry['duration'] / $this->getDuration() ) * 100; // temp
			}

			// strings for templates
			$entry['strings'] = [];
			if( $this->started_at ){
				$diff = $entry['datetime']->diff($this->started_at);
				$entry['strings']['started_at'] = $diff->format('%H:%I:%S');
			}else{
				$entry['strings']['started_at'] = $entry['datetime']->format("Y-m-d H:i:s");
			}

			$entry['strings']['duration'] = TwitchHelper::getNiceDuration( $entry['duration'] );

			// box art
			if( $game_data && $game_data['box_art_url'] ){
				$img_url = $game_data['box_art_url'];
				$img_url = str_replace("{width}", 14, $img_url);
				$img_url = str_replace("{height}", 19, $img_url);
				$entry['box_art_url'] = $img_url;
			}

			$chapters[] = $entry;

		}

		$i = 0;

		foreach ($chapters as $chapter) {
			
			if( isset( $chapters[$i+1] ) && $chapters[$i+1] ){
				$chapters[$i]['duration'] = $chapters[$i+1]['datetime']->getTimestamp() - $chapter['datetime']->getTimestamp();
			}

			if($i == 0){
				$this->game_offset = $chapter['offset'];
			}

			if($i == sizeof($chapters)-1 && $this->ended_at){
				$chapters[$i]['duration'] = $this->ended_at->getTimestamp() - $chapter['datetime']->getTimestamp();
			}

			$i++;

		}

		$this->chapters = $chapters;

	}

	public function parseSegments( $array ){

		if( !$array ){
			TwitchHelper::log( TwitchHelper::LOG_ERROR, "No segment data supplied on " . $this->basename);

			if( !$this->segments_raw ){
				TwitchHelper::log( TwitchHelper::LOG_ERROR, "No segment_raw data on " . $this->basename . ", calling rebuild...");
				$this->rebuildSegmentList();
			}

			return false;
		}

		$segments = [];

		foreach( $array as $k => $v ){

			if( gettype($v) != 'string' ){
				TwitchHelper::log( TwitchHelper::LOG_ERROR, "Segment list containing invalid data for " . $this->basename . ", rebuilding...");
				$this->rebuildSegmentList();
				return;
			}

			$segment = [];

			$segment['filename'] = realpath( $this->directory . DIRECTORY_SEPARATOR . basename($v) );
			$segment['basename'] = basename($v);
			if( file_exists( $segment['filename'] ) ){
				$segment['filesize'] = filesize( $segment['filename'] );
			}else{
				$segment['deleted'] = true;
			}
			
			$segment['strings'] = [];
			// $diff = $this->started_at->diff($this->ended_at);
			// $segment['strings']['webhook_duration'] = $diff->format('%H:%I:%S') . '</li>';

			$segments[] = $segment;

		}

		$this->segments = $segments;

	}

	public function getWebhookDuration(){
		if($this->started_at && $this->ended_at){
			$diff = $this->started_at->diff($this->ended_at);
			return $diff->format('%H:%I:%S');
		}else{
			return null;
		}
	}

	public function getUniqueGames(){

		$unique_games = [];
                                        
		foreach($this->chapters as $g){
			$unique_games[ (int)$g['game_id'] ] = true;
		}
		
		$data = [];

		foreach($unique_games as $id => $n){
			$gd = TwitchHelper::getGameData($id);
			if(!$gd) continue;
			$img_url = $gd['box_art_url'];
			$img_url = str_replace("{width}", 140, $img_url);
			$img_url = str_replace("{height}", 190, $img_url);
			$data[] = [
				'name' => $gd['name'],
				'image_url' => $img_url
			];
			// echo '<img class="boxart-big" title="' . $gd['name'] . '" src="' . $img_url . '" />';
		}

		return $data;

	}

	/**
	 * Return the current game/chapter in an array
	 *
	 * @return array
	 */
	public function getCurrentGame(){
		return $this->chapters[ count($this->chapters) - 1 ];
	}

	public function getRecordingSize(){
		$filename = $this->directory . DIRECTORY_SEPARATOR . $this->basename . '.ts';
		if(!file_exists($filename)) return false;
		return filesize($filename);
	}

	/**
	 * Save file for lossless cut editing
	 * https://github.com/mifi/lossless-cut
	 *
	 * @return void
	 */
	public function saveLosslessCut(){

		TwitchHelper::log( TwitchHelper::LOG_INFO, "Saving lossless cut csv for " . $this->basename);

		$data = "";

		foreach( $this->chapters as $k => $chapter ){

			$offset = $chapter['offset'];

			$offset -= $this->chapters[0]['offset'];
			
			$data .= $offset . ',';
			
			if( $k < sizeof($this->chapters)-1 ){
				$data .= ( $offset + $chapter['duration'] ) . ',';
			}else{
				$data .= ',';
			}

			$data .= $chapter['game_name'] ?: $chapter['game_id'];
			$data .= "\n";
		}

		file_put_contents( TwitchHelper::vod_folder( $this->streamer_name ) . DIRECTORY_SEPARATOR . $this->basename . '-llc-edl.csv', $data );

	}

	public function rebuildSegmentList(){

		if( $this->is_capturing || $this->is_converting || $this->no_files() ){
			TwitchHelper::log( TwitchHelper::LOG_ERROR, "Won't rebuild segment list on " . $this->basename . ", it's still recording.");
			return false;
		}

		TwitchHelper::log( TwitchHelper::LOG_INFO, "Rebuild segment list for " . $this->basename );

		$videos = glob( $this->directory . DIRECTORY_SEPARATOR . $this->basename . "*.mp4");

		if( !$videos ){
			TwitchHelper::log( TwitchHelper::LOG_WARNING, "No segments found for " . $this->basename );
			return false;
		}

		$this->segments = [];
		$this->segments_raw = [];

		foreach( $videos as $v ){
			$this->segments_raw[] = basename($v);
		}

		$this->parseSegments( $this->segments_raw );

		$this->saveJSON();

	}

	public function downloadVod(){

		if( !$this->twitch_vod_id ){
			throw new \Exception("No twitch vod id for download");
			return false;
		}

		$capture_filename = $this->directory . DIRECTORY_SEPARATOR . $this->basename . '.vod.ts';

		$video_url = 'https://www.twitch.tv/videos/' . $this->twitch_vod_id;

		// use python pipenv or regular executable
		if( TwitchConfig::cfg('pipenv') ){
			$cmd = 'pipenv run streamlink';
		}else{
			$cmd = TwitchHelper::path_streamlink();
		}

		$cmd .= ' -o ' . escapeshellarg($capture_filename); // output file
		$cmd .= ' ' . escapeshellarg($video_url) . ' best'; // twitch url and quality

		TwitchHelper::log( TwitchHelper::LOG_INFO, "Starting vod download of " . $this->basename );
		
		$capture_output = shell_exec( $cmd );

		file_put_contents( __DIR__ . "/../logs/streamlink_vod_" . $this->basename . ".log", $capture_output);

		return $capture_filename;

	}

	public function checkMutedVod(){

		if( TwitchConfig::cfg('pipenv') ){
			$cmd = 'pipenv run streamlink';
		}else{
			$cmd = TwitchHelper::path_streamlink();
		}

		$cmd .= " --stream-url";
		$cmd .= " https://www.twitch.tv/videos/" . $this->twitch_vod_id;
		$cmd .= " best";

		$output = shell_exec( $cmd );

		$stream_url = $output;

		if(!$output){
			return null;
		}

		/*
		$client = new \GuzzleHttp\Client();
		$response = $client->get($stream_url);

		$server_output = $response->getBody()->getContents();
		*/

		if( strpos($output, "index-muted-") !== false ){
			return true;
		}else{
			return false;
		}

	}

	public function hasFavouriteGame(){
		if(!$this->chapters) return false;
		foreach( $this->chapters as $chapter ){
			if( $chapter['favourite'] ) return true;
		}
		return false;
	}

	// TODO: finish this
	public function getCapturingStatus(){
		TwitchHelper::log( TwitchHelper::LOG_DEBUG, "Fetch capture process status of " . $this->basename );
		$output = shell_exec("ps aux | grep -i " . escapeshellarg("twitch.tv/" . $this->streamer_name) . " | grep -v grep");
		preg_match("/^([a-z0-9]+)\s+([0-9]+)/i", trim($output), $matches);
		return isset($matches[2]) ? $matches[2] : false;
	}

	public function getConvertingStatus(){
		TwitchHelper::log( TwitchHelper::LOG_DEBUG, "Fetch converting process status of " . $this->basename );
		$output = shell_exec("ps aux | grep -i " . escapeshellarg( $this->basename . ".mp4" ) . " | grep -v grep");
		preg_match("/^([a-z0-9]+)\s+([0-9]+)/i", trim($output), $matches);
		return isset($matches[2]) ? $matches[2] : false;
	}

	public function getChatDownloadStatus(){
		TwitchHelper::log( TwitchHelper::LOG_DEBUG, "Fetch chat download process status of " . $this->basename );
		$output = shell_exec("ps aux | grep -i " . escapeshellarg( "tcd --video " . $this->twitch_vod_id ) . " | grep -v grep");
		preg_match("/^([a-z0-9]+)\s+([0-9]+)/i", trim($output), $matches);
		return isset($matches[2]) ? $matches[2] : false;
	}

	public function finalize(){
		TwitchHelper::log( TwitchHelper::LOG_INFO, "Finalize " . $this->basename);
		$this->getMediainfo();
		$this->saveLosslessCut();
		$this->matchTwitchVod();
		$this->is_finalized = true;
	}

	public function repair(){

		$username = explode( "_", $this->basename )[0];
		$user_id = TwitchHelper::getChannelId($username);

	}

	public function troubleshoot( $fix = false ){

		$base = $this->directory . DIRECTORY_SEPARATOR . $this->basename;

		if( $this->is_finalized ){
			if( !file_exists( $base . '.mp4' ) ){
				return ["fixable" => false, "text" => "reached finalize step, but the .mp4 file never got created."];
			}
			if( !$this->twitch_vod_id ){
				if($fix){
					if( $this->matchTwitchVod() ){
						$this->saveJSON();
						return ["fixed" => true, "text" => "twitch vod matched successfully"];
					}else{
						return ["fixed" => false, "text" => "tried to match, but couldn't. maybe it's deleted?"];
					}
				}
				return ["fixable" => true, "text" => "reached finalize step, but does not have a matched twitch vod."];
			}
		}

		if( $this->is_capturing && !$this->getCapturingStatus() ){
			return ["fixable" => false, "text" => "streamlink exited but capturing didn't complete"];
		}

		if( $this->is_converting && !$this->getConvertingStatus() ){
			if( file_exists( $base . '.mp4' ) && file_exists( $base . '.ts' ) ){
				return ["fixable" => false, "text" => "reached conversion step, ffmpeg exited but conversion didn't complete, both .ts and .mp4 still exist."];
			}elseif( file_exists( $base . '.mp4' ) && !file_exists( $base . '.ts' ) ){
				if($fix){
					$this->is_recording = false;
					$this->is_capturing = false;
					$this->is_converting = false;
					$this->is_converted = true;
					$this->finalize();
					$this->saveJSON();
				}
				return ["fixable" => true, "text" => "reached conversion step, ffmpeg exited and conversion probably completed, but the .ts file got removed."];
			}elseif( !file_exists( $base . '.mp4' ) && file_exists( $base . '.ts' ) ){
				return ["fixable" => false, "text" => "reached conversion step, ffmpeg exited and conversion didn't complete - the .mp4 file never got created."];
			}
		}

		return false;

	}

	public function no_files(){
		return ( !file_exists( $this->directory . DIRECTORY_SEPARATOR . $this->basename . '.ts') && !file_exists( $this->directory . DIRECTORY_SEPARATOR . $this->basename . '.mp4') );
	}

	/**
	 * Delete everything about the VOD, trying to rewrite this
	 *
	 * @return void
	 */
	public function delete(){
		
		TwitchHelper::log( TwitchHelper::LOG_INFO, "Delete " . $this->basename);
		
		// segments
		foreach($this->segments_raw as $s){
			unlink( $this->directory . DIRECTORY_SEPARATOR . basename($s) );
		}

		unlink( $this->directory . DIRECTORY_SEPARATOR . $this->basename . '.json'); // data file
		if( $this->is_lossless_cut_generated ) unlink( $this->directory . DIRECTORY_SEPARATOR . $this->basename . '-llc-edl.csv'); // losslesscut
		if( $this->is_chat_downloaded ) unlink( $this->directory . DIRECTORY_SEPARATOR . $this->basename . '.chat'); // chat download

	}

	/**
	 * Save vod to saved folder, not really that functional
	 *
	 * @return void
	 */
	public function save(){
		TwitchHelper::log( TwitchHelper::LOG_INFO, "Save " . $this->basename);
		rename( TwitchHelper::vod_folder( $this->streamer_name ) . DIRECTORY_SEPARATOR . $this->basename . '.mp4', TwitchHelper::$public_folder . DIRECTORY_SEPARATOR . "saved_vods" . $this->basename . '.mp4');
		rename( TwitchHelper::vod_folder( $this->streamer_name ) . DIRECTORY_SEPARATOR . $this->basename . '.json', TwitchHelper::$public_folder . DIRECTORY_SEPARATOR . "saved_vods" . $this->basename . '.json');
		rename( TwitchHelper::vod_folder( $this->streamer_name ) . DIRECTORY_SEPARATOR . $this->basename . '-llc-edl.csv', TwitchHelper::$public_folder . DIRECTORY_SEPARATOR . "saved_vods" . $this->basename . '-llc-edl.csv'); // losslesscut
		rename( TwitchHelper::vod_folder( $this->streamer_name ) . DIRECTORY_SEPARATOR . $this->basename . '.chat', TwitchHelper::$public_folder . DIRECTORY_SEPARATOR . "saved_vods" . $this->basename . '.chat'); // chat
	}

	public function convert(){

		set_time_limit(0);

		$captured_filename = TwitchHelper::vod_folder( $this->streamer_name ) . DIRECTORY_SEPARATOR . $this->basename . '.ts';

		if( !file_exists( $captured_filename ) ){
			throw new \Exception("No TS file found");
			return false;
		}

		$TwitchAutomator = new TwitchAutomator();

		$converted_filename = $TwitchAutomator->convert( $this->basename );

		// delete captured file
		if( file_exists( $converted_filename ) && file_exists( $captured_filename ) ){
			unlink( $captured_filename );
		}

		return true;

	}

}
