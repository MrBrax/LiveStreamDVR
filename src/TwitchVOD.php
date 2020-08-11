<?php

namespace App;

use Exception;
use getID3;

class TwitchVOD {
	
	public $vod_path = 'vods';

	public $filename = '';
	public $basename = '';
	public $json = [];

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

	public $duration = null; // deprecated?
	public $duration_seconds = null;

	public $game_offset = null;

	// TODO: make these into an array instead
	public $twitch_vod_id = null;
	public $twitch_vod_url = null;
	public $twitch_vod_duration = null;
	public $twitch_vod_title = null;
	public $twitch_vod_date = null;
	public $twitch_vod_exists = null;

	public $is_recording = false;
	public $is_converted = false;

	public $video_width = null;
	public $video_height = null;

	/**
	 * Load a VOD with a JSON file
	 *
	 * @param string $filename
	 * @return bool
	 */
	public function load( $filename ){

		TwitchHelper::log( TwitchHelper::LOG_DEBUG, "Loading VOD Class for " . $filename);

		if(!file_exists($filename)){
			TwitchHelper::log( TwitchHelper::LOG_ERROR, "VOD Class for " . $filename . " not found");
			throw new \Exception('VOD not found');
			return false;
		}

		$data = file_get_contents($filename);
		$this->json = json_decode($data, true);

		if( !$this->json['meta']['data'][0]['user_name'] ){
			TwitchHelper::log( TwitchHelper::LOG_ERROR, "Tried to load " . $filename . " but found no streamer name");
			throw new \Exception('Tried to load ' . $filename . ' but found no streamer name');
			return false;
		}

		if( $this->json['started_at'] ){
			$this->started_at = \DateTime::createFromFormat("Y-m-d\TH:i:s\Z", $this->json['started_at'] );
		}

		if( $this->json['ended_at'] ){
			$this->ended_at = \DateTime::createFromFormat("Y-m-d\TH:i:s\Z", $this->json['ended_at'] );
		}

		$this->filename = $filename;
		$this->basename = basename($filename, '.json');

		$this->is_recording = file_exists( TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . $this->basename . '.ts' );
		$this->is_converted = file_exists( TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . $this->basename . '.mp4' );

		if( !$this->is_recording ){
			$this->segments_raw = $this->json['segments_raw'];
			$this->parseSegments( $this->segments_raw );
		}

		if( isset( $this->json['chapters'] ) && count( $this->json['chapters'] ) > 0 ){
			$this->parseChapters( $this->json['chapters'] );
		}else if( isset( $this->json['games'] ) && count( $this->json['games'] ) > 0 ){
			$this->parseChapters( $this->json['games'] );
		}else{
			TwitchHelper::log( TwitchHelper::LOG_ERROR, "Neither chapters nor games on " . $filename . "!");
		}

		$this->streamer_name = $this->json['meta']['data'][0]['user_name'];
		$this->streamer_id = TwitchHelper::getChannelId( $this->streamer_name );

		$this->twitch_vod_id 		= $this->json['twitch_vod_id'];
		$this->twitch_vod_url 		= $this->json['twitch_vod_url'];
		$this->twitch_vod_duration 	= $this->json['twitch_vod_duration'];
		$this->twitch_vod_title 	= $this->json['twitch_vod_title'];
		$this->twitch_vod_date 		= $this->json['twitch_vod_date'];
		
		$this->duration 			= $this->json['duration'];
		$this->duration_seconds		= $this->json['duration_seconds'];

		$this->video_width 		= $this->json['video_width'];
		$this->video_height 	= $this->json['video_height'];
		$this->video_bitrate 	= $this->json['video_bitrate'];
		$this->video_fps 		= $this->json['video_fps'];
		$this->video_fail 		= $this->json['video_fail'];

		if( !$this->video_width && !$this->is_recording && count($this->segments_raw) > 0 && !$this->video_fail ){
			$this->saveVideoMetadata();
		}

		$this->is_chat_downloaded = file_exists( TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . $this->basename . '.chat' );
		$this->is_vod_downloaded = file_exists( TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . $this->basename . '.vod.ts' );

		return true;

	}

	// test
	public function create( $filename ){
		$this->filename = $filename;
		$this->basename = basename($filename, '.json');
		$this->saveJSON();
		return true;
	}

	/**
	 * Get duration of the mp4 file.
	 *
	 * @param boolean $save Save the duration to the JSON file
	 * @return string Duration in seconds
	 */
	public function getDuration( $save = false ){

		if( $this->duration_seconds ) return $this->duration_seconds;

		if( !isset($this->segments_raw) || count($this->segments_raw) == 0 ){
			TwitchHelper::log(TwitchHelper::LOG_ERROR, "No video file available for duration of " . $this->basename);
			return false;
		}

		
		// $getID3 = new getID3;

		$file = $this->getVideoMetadata();

		if( !$file ){

			TwitchHelper::log(TwitchHelper::LOG_ERROR, "Could not find duration of " . $this->basename . ": " . join(", ", $file['error']) );			

			return false;

		}else{
		
			$this->duration 			= $file['playtime_string'];
			$this->duration_seconds 	= $file['playtime_seconds'];

			if( $save ){
				TwitchHelper::log(TwitchHelper::LOG_INFO, "Saved duration for " . $this->basename);
				$this->saveJSON();
			}

			return $file['playtime_seconds'];

		}
		

	}

	public function getVideoMetadata( $save = false ){

		if( !isset($this->segments_raw) || count($this->segments_raw) == 0 ){
			TwitchHelper::log(TwitchHelper::LOG_ERROR, "No video file available for metadata of " . $this->basename);
			return false;
		}

		$filename = TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . basename( $this->segments_raw[0] );

		if( !file_exists($filename) ){
			TwitchHelper::log(TwitchHelper::LOG_ERROR, "No video file found for metadata fetching of " . $this->basename);
			return false;
		}

		$getID3 = new getID3;

		$file = $getID3->analyze( $filename );

		if( !$file['playtime_string'] ){
			TwitchHelper::log(TwitchHelper::LOG_ERROR, "Invalid metadata of " . $this->basename);
			return false;
		}else{
			return $file;
		}

	}

	public function saveVideoMetadata(){

		if( $this->is_recording ) return false;

		TwitchHelper::log(TwitchHelper::LOG_INFO, "Getting and saving metadata of " . $this->basename);

		$this->getDuration();
		
		$file = $this->getVideoMetadata();
		if(!$file){
			TwitchHelper::log(TwitchHelper::LOG_ERROR, "No metadata returned for " . $this->basename);
			$this->video_fail = true;
			$this->saveJSON();
			return false;
		}
		if(!$file['video']){
			TwitchHelper::log(TwitchHelper::LOG_ERROR, "No video array in metadata of " . $this->basename);
			$this->video_fail = true;
			$this->saveJSON();
			return false;
		}

		$this->video_width 		= $file['video']['resolution_x'];
		$this->video_height 	= $file['video']['resolution_y'];
		$this->video_bitrate 	= $file['video']['bitrate'] ?: $file['bitrate'];;
		$this->video_fps 		= $file['video']['frame_rate'];
		$this->saveJSON();
	}

	public function getDurationLive(){
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

		$chat_filename = TwitchHelper::vod_folder() . '/' . $this->basename . '.chat';

		$tcd_filename = TwitchHelper::vod_folder() . '/' . $this->twitch_vod_id . '.json';

		if( file_exists( $chat_filename ) ){
			TwitchHelper::log(TwitchHelper::LOG_ERROR, "Chat already exists for " . $this->basename);
			return;
		}

		// if tcd generated file exists, rename it
		if( file_exists( $tcd_filename ) ){
			TwitchHelper::log(TwitchHelper::LOG_ERROR, "Renamed chat file for " . $this->basename);
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
		$cmd .= ' --output ' . TwitchHelper::vod_folder();
		// $cmd .= ' --output ' . escapeshellarg($chat_filename);

		$capture_output = shell_exec( $cmd );

		rename( $tcd_filename, $chat_filename );

		return [$chat_filename, $capture_output, $cmd];

	}

	/**
	 * Fetch streamer's videos and try to match this VOD with an archived one.
	 *
	 * @return string
	 */
	public function matchTwitchVod(){

		TwitchHelper::log( TwitchHelper::LOG_INFO, "Try to match twitch vod for " . $this->basename);

		$channel_videos = TwitchHelper::getVideos( $this->streamer_id );

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

		TwitchHelper::log( TwitchHelper::LOG_ERROR, "Couldn't match vod for " . $this->basename);

	}

	/**
	 * Check if VOD has been deleted from Twitch
	 *
	 * @return void
	 */
	public function checkValidVod(){

		if( !$this->twitch_vod_id ){
			TwitchHelper::log( TwitchHelper::LOG_ERROR, "No twitch vod id for valid checking on " . $this->basename);
			return false;
			// throw new \Exception("No twitch vod id for valid checking on " . $this->basename);
			// return null;
		}

		TwitchHelper::log( TwitchHelper::LOG_INFO, "Check valid vod for " . $this->basename);

		$video = TwitchHelper::getVideo( $this->twitch_vod_id );

		if( $video ){
			$this->twitch_vod_exists = true;
			return true;
		}

		$this->twitch_vod_exists = false;

		return false;

	}

	/**
	 * Save JSON to file, be sure to load it first!
	 */
	public function saveJSON(){

		$generated = $this->json;

		if( $this->twitch_vod_id && $this->twitch_vod_url){
			$generated['twitch_vod_id'] 		= $this->twitch_vod_id;
			$generated['twitch_vod_url'] 		= $this->twitch_vod_url;
			$generated['twitch_vod_duration'] 	= $this->twitch_vod_duration;
			$generated['twitch_vod_title'] 		= $this->twitch_vod_title;
			$generated['twitch_vod_date'] 		= $this->twitch_vod_date;
		}

		$generated['streamer_name'] 	= $this->streamer_name;
		$generated['streamer_id'] 		= $this->streamer_id;

		$generated['chapters'] 			= $this->chapters;
		$generated['segments_raw'] 		= $this->segments_raw;
		$generated['segments'] 			= $this->segments;

		$generated['duration'] 			= $this->duration;
		$generated['duration_seconds'] 	= $this->duration_seconds;

		$generated['video_width'] 		= $this->video_width;
		$generated['video_height'] 		= $this->video_height;
		$generated['video_bitrate'] 	= $this->video_bitrate;
		$generated['video_fps'] 		= $this->video_fps;
		$generated['video_fail'] 		= $this->video_fail;

		TwitchHelper::log(TwitchHelper::LOG_INFO, "Saving JSON of " . $this->basename);

		file_put_contents($this->filename, json_encode($generated));

		return $generated;

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


			// offset
			if($this->started_at){
				$entry['offset'] = $entry['datetime']->getTimestamp() - $this->started_at->getTimestamp();
			}

			if( !$this->is_recording && $this->getDuration() !== false ){
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
			if( $game_data['box_art_url'] ){
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

			$segment['filename'] = realpath( TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . basename($v) );
			$segment['basename'] = basename($v);
			$segment['filesize'] = filesize( $segment['filename'] );
			
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

	public function getCurrentGame(){
		return $this->chapters[ count($this->chapters) - 1 ];
	}

	public function getRecordingSize(){
		$filename = TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . $this->basename . '.ts';
		if(!$filename) return false;
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

		file_put_contents( $this->vod_path . DIRECTORY_SEPARATOR . $this->basename . '-llc-edl.csv', $data );

	}

	public function rebuildSegmentList(){

		if( $this->is_recording || $this->no_files() ){
			TwitchHelper::log( TwitchHelper::LOG_ERROR, "Won't rebuild segment list on " . $this->basename . ", it's still recording.");
			return false;
		}

		TwitchHelper::log( TwitchHelper::LOG_INFO, "Rebuild segment list for " . $this->basename );

		$videos = glob( TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . $this->basename . "*.mp4");

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

		$capture_filename = TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . $this->basename . '.vod.ts';

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

	public function no_files(){
		return ( !file_exists( TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . $this->basename . '.ts') && !file_exists( TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . $this->basename . '.mp4') );
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
			unlink( TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . basename($s) );
		}

		unlink( TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . $this->basename . '.json'); // data file
		unlink( TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . $this->basename . '-llc-edl.csv'); // losslesscut
		unlink( TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . $this->basename . '.chat'); // chat download

	}

	/**
	 * Save vod to saved folder, not really that functional
	 *
	 * @return void
	 */
	public function save(){
		TwitchHelper::log( TwitchHelper::LOG_INFO, "Save " . $this->basename);
		rename( TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . $this->basename . '.mp4', TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . 'saved' . DIRECTORY_SEPARATOR . $this->basename . '.mp4');
		rename( TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . $this->basename . '.json', TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . 'saved' . DIRECTORY_SEPARATOR . $this->basename . '.json');
		rename( TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . $this->basename . '-llc-edl.csv', TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . 'saved' . DIRECTORY_SEPARATOR . $this->basename . '-llc-edl.csv'); // losslesscut
		rename( TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . $this->basename . '.chat', TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . 'saved' . DIRECTORY_SEPARATOR . $this->basename . '.chat'); // chat
	}

	public function convert(){

		set_time_limit(0);

		$captured_filename = TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . $this->basename . '.ts';

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
