<?php

namespace App;

use getID3;

class TwitchAutomator {

	public $data_cache = [];

	public $json = [];

	public $errors = [];
	public $info = [];

	public $vod;

	const NOTIFY_GENERIC = 1;
	const NOTIFY_DOWNLOAD = 2;
	const NOTIFY_ERROR = 4;
	const NOTIFY_GAMECHANGE = 8;

	public $notify_level = self::NOTIFY_GENERIC && self::NOTIFY_DOWNLOAD && self::NOTIFY_ERROR && self::NOTIFY_GAMECHANGE;

	/**
	 * Generate a basename from the VOD payload
	 *
	 * @param array $data
	 * @return string basename
	 */
	public function basename( $data ){

		$data_id = $data['data'][0]['id'];
		$data_title = $data['data'][0]['title'];
		$data_started = $data['data'][0]['started_at'];
		$data_game_id = $data['data'][0]['game_id'];
		$data_username = $data['data'][0]['user_name'];

		// return $data_username . '_' . $data_id . '_' . str_replace(':', '_', $data_started);

		return $data_username . '_' . str_replace(':', '_', $data_started) . '_' . $data_id;

	}

	

	public function getDateTime(){
		date_default_timezone_set('UTC');
		return date("Y-m-d\TH:i:s\Z");
	}

	public function jsonLoad(){

		if( !$this->data_cache ){
			$this->errors[] = 'No JSON cache when loading';
			return false;
		}

		$basename = $this->basename( $this->data_cache );

		if( !file_exists( TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . $basename . '.json') ){
			$this->errors[] = 'No JSON file when loading';
			$this->json = [];
			return;
		}

		$json = json_decode( file_get_contents( TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . $basename . '.json' ), true );

		if(!$json || $json == null) $json = [];

		$this->json = $json;

		return true;

	}

	public function jsonSave(){

		if( !$this->data_cache ){
			$this->errors[] = 'No JSON cache when saving';
			return false;
		}

		$basename = $this->basename( $this->data_cache );

		file_put_contents( TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . $basename . '.json', json_encode( $this->json ) );

		return true;

	}
	
	/**
	 * Either send email or store in logs directory
	 *
	 * @param string $body
	 * @param string $title
	 * @param int $notification_type
	 * @return void
	 */
	public function notify( $body, $title, $notification_type = self::NOTIFY_GENERIC ){

		$headers = "From: " . TwitchConfig::cfg('notify_from') . "\r\n";
		$headers .= "Content-Type: text/html; charset=UTF-8\r\n";

		$body = '<h1>' . $title . '</h1>' . $body;

		if($this->data_cache){
			$body .= '<pre>' . print_r( $this->data_cache, true ) . '</pre>';
		}

		if( sizeof($this->errors) > 0 ){

			$body .= '<h3>Errors</h3>';

			$body .= '<ul class="errors">';
			foreach ($this->errors as $k => $v) {
				$body .= '<li>' . $v . '</li>';
			}
			$body .= '</ul>';

		}

		if( sizeof($this->info) > 0 ){

			$body .= '<h3>Info</h3>';

			$body .= '<ul class="info">';
			foreach ($this->info as $k => $v) {
				$body .= '<li>' . $v . '</li>';
			}
			$body .= '</ul>';

		}

		if( TwitchConfig::cfg('notify_to') ){
			mail(TwitchConfig::cfg('notify_to'), TwitchConfig::cfg('app_name') . ' - ' . $title, $body, $headers);
		}else{
			file_put_contents( __DIR__ . "/../logs/" . date("Y-m-d.H_i_s") . ".html", $body);
		}

	}

	/**
	 * Remove old VODs by streamer name, this has to be properly rewritten
	 */
	public function cleanup( $streamer_name, $source_basename = null ){

		$vods = glob( TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . $streamer_name . "_*.json");

		$total_size = 0;

		$vod_list = [];

		foreach ($vods as $v) {
			
			$vodclass = new TwitchVOD();
			$vodclass->load($v);

			$vod_list[] = $vodclass;

			foreach($vodclass->segments as $s){
				$total_size += filesize( TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . basename($s) );
			}
			
		}

		$gb = $total_size / 1024 / 1024 / 1024;

		$this->info[] = 'Total filesize for ' . $streamer_name . ': ' . $gb;
		TwitchHelper::log( TwitchHelper::LOG_INFO, 'Total filesize for ' . $streamer_name . ': ' . round($gb, 2));

		TwitchHelper::log( TwitchHelper::LOG_INFO, 'Amount for ' . $streamer_name . ': ' . sizeof($vod_list) . '/' . ( TwitchConfig::cfg('vods_to_keep') + 1 ) );

		// don't include the current vod
		if( sizeof($vod_list) > ( TwitchConfig::cfg('vods_to_keep') + 1 ) || $gb > TwitchConfig::cfg('storage_per_streamer') ){

			TwitchHelper::log( TwitchHelper::LOG_INFO, 'Total filesize for ' . $streamer_name . ' exceeds either vod amount or storage per streamer');

			// don't delete the newest vod, hopefully
			if( $source_basename != null && $vod_list[0]->basename == $source_basename ){
				TwitchHelper::log( TwitchHelper::LOG_ERROR, "Trying to cleanup latest VOD " . $vod_list[0]->basename);
				return false;
			}

			TwitchHelper::log( TwitchHelper::LOG_INFO, "Cleanup " . $vod_list[0]->basename);
			$vod_list[0]->delete();

		}

	}

	/**
	 * Entrypoint for stream capture
	 *
	 * @param array $data
	 * @return void
	 */
	public function handle( $data ){

		TwitchHelper::log( TwitchHelper::LOG_DEBUG, "Handle called");

		if( !$data['data'] ){
			TwitchHelper::log( TwitchHelper::LOG_ERROR, "No data supplied for handle");
			return false;
		}

		$data_id = $data['data'][0]['id'];
		// $data_title = $data['data'][0]['title'];
		// $data_started = $data['data'][0]['started_at'];
		// $data_game_id = $data['data'][0]['game_id'];
		// $data_username = $data['data'][0]['user_name'];

		$this->data_cache = $data;

		if( !$data_id ){

			$this->end( $data );

		}else{

			$basename = $this->basename( $data );
			
			if( file_exists( TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . $basename . '.json') ){

				if( !file_exists( TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . $basename . '.ts') ){

					$this->notify($basename, 'VOD JSON EXISTS BUT NOT VIDEO', self::NOTIFY_ERROR);

					$this->download( $data );

				}else{

					$this->updateGame( $data );

				}

			}else{

				$this->download( $data );

			}

		}

	}

	/**
	 * TODO: move this to helper?
	 */
	public function getGameName( $id ){

		if( $id == 0 ){
			$this->errors[] = 'Game ID is 0';
			return false;
		}

		$data = TwitchHelper::getGameData( $id );

		if($data){
			return $data['name'];
		}

		TwitchHelper::log( TwitchHelper::LOG_ERROR, "Couldn't match game for " . $id );

		return false;

		// print_r($server_output);
		// print_r($info);

	}

	/**
	 * Add game/chapter to stream
	 *
	 * @param array $data
	 * @return void
	 */
	public function updateGame( $data ){

		$data_id 			= $data['data'][0]['id'];
		$data_started 		= $data['data'][0]['started_at'];
		$data_game_id 		= $data['data'][0]['game_id'];
		$data_username 		= $data['data'][0]['user_name'];
		$data_viewer_count 	= $data['data'][0]['viewer_count'];
		$data_title 		= $data['data'][0]['title'];

		$basename = $this->basename( $data );

		$this->jsonLoad();

		// json format
	
		// full json data
		$this->json['meta'] = $data;
		
		// full datetime-stamp of stream start
		$this->json['started_at'] = $data_started;
		
		if(!$this->json['chapters']){
			$this->json['chapters'] = [];
		}

		// fetch game name from either cache or twitch
		$game_name = $this->getGameName( $data_game_id );

		// game structure
		$this->json['chapters'][] = [
			'time' 			=> $this->getDateTime(),
			'game_id' 		=> $data_game_id,
			'game_name'		=> $game_name,
			'viewer_count' 	=> $data_viewer_count,
			'title'			=> $data_title
		];

		$this->jsonSave();
		
		//$game_name = $this->games[$data_game_id] ?: $data_game_id;

		$this->notify('', '[' . $data_username . '] [game update: ' . $game_name . ']', self::NOTIFY_GAMECHANGE);

		TwitchHelper::log( TwitchHelper::LOG_INFO, "Game updated on " . $data_username . " to " . $game_name);

	}

	public function end(){

		$this->notify('', '[stream end]', self::NOTIFY_DOWNLOAD);

	}

	/**
	 * Start the download/capture process of a live stream
	 *
	 * @param array $data
	 * @param integer $tries
	 * @return void
	 */
	public function download( $data, $tries = 0 ){

		$data_id = $data['data'][0]['id'];
		$data_title = $data['data'][0]['title'];
		$data_started = $data['data'][0]['started_at'];
		$data_game_id = $data['data'][0]['game_id'];
		$data_username = $data['data'][0]['user_name'];

		if( !$data_id ){
			$this->errors[] = 'No data id for download';
			$this->notify($data, 'NO DATA SUPPLIED FOR DOWNLOAD, TRY #' . $tries, self::NOTIFY_ERROR);
			throw new \Exception('No data supplied');
			return;
		}

		// $this->notify('', '[' . $data_username . '] [prepare download]');

		$stream_url = 'twitch.tv/' . $data_username;

		$basename = $this->basename( $data );

		// TODO: migrate to this in the future
		// $this->vod = new TwitchVOD();
		// $this->vod->create($basename);
        
        $streamer = TwitchConfig::getStreamer( $data_username );

		// check matched title
		if( $streamer && $streamer['match'] ){

			$match = false;

			$this->notify($basename, 'Check keyword matches for user ' . json_encode( $streamer ), self::NOTIFY_GENERIC);
			TwitchHelper::log( TwitchHelper::LOG_INFO, "Check keyword matches for " . $basename);

			foreach( $streamer['match'] as $m ){
				if( strpos( strtolower($data_title), $m ) !== false ){
					$match = true;
					break;
				}
			}

			if(!$match){
				$this->notify($basename, 'Cancel download because stream title does not contain keywords', self::NOTIFY_GENERIC);
				TwitchHelper::log( TwitchHelper::LOG_WARNING, "Cancel download of " . $basename . " due to missing keywords");
				return;
			}

		}

		// in progress
		TwitchHelper::log( TwitchHelper::LOG_INFO, "Update game for " . $basename);
		$this->updateGame( $data );

		// download notification
		$this->notify($basename, '[' . $data_username . '] [download]', self::NOTIFY_DOWNLOAD);
	
		// capture with streamlink
		$capture_filename = $this->capture( $data );

		// error handling if nothing got downloaded
		if( !file_exists( $capture_filename ) ){

			TwitchHelper::log( TwitchHelper::LOG_WARNING, "Panic handler for " . $basename);

			if( $tries >= TwitchConfig::cfg('download_retries') ){
				$this->errors[] = 'Giving up on downloading, too many tries';
				$this->notify($basename, 'GIVING UP, TOO MANY TRIES', self::NOTIFY_ERROR);
				// unlink( 'vods/' . $basename . '.json' );
				rename( TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . $basename . '.json', TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . $basename . '.json.broken' );
				throw new \Exception('Too many tries');
				return;
			}

			$this->errors[] = 'Error when downloading, retrying';

			$this->info[] = 'Capture name: ' . $capture_filename;

			// $this->errors[] = $cmd;

			$this->notify($basename, 'MISSING DOWNLOAD, TRYING AGAIN (#' . $tries . ')', self::NOTIFY_ERROR);

			sleep(15);

			$this->download( $data, $tries + 1 );

			return;

		}

		// timestamp
		TwitchHelper::log( TwitchHelper::LOG_INFO, "Add end timestamp for " . $basename);
		$this->jsonLoad();
		$this->json['ended_at'] = $this->getDateTime();
		$this->jsonSave();

		sleep(60);



		// convert notify
		$this->notify($basename, '[' . $data_username . '] [convert]', self::NOTIFY_DOWNLOAD);
		
		// convert with ffmpeg
		$converted_filename = $this->convert( $basename );

		sleep(10);

		

		// $id3_data = $getID3->analyze($converted_filename);

		// remove ts if both files exist
		if( file_exists( $capture_filename ) && file_exists( $converted_filename ) ){

			$getID3 = new getID3;

			$id3_data = null;

			try {
				$id3_data = $getID3->analyze($converted_filename);
			} catch (\Exception $e) {
				$this->notify($basename, 'Error with id3 analyzer' . $e, self::NOTIFY_ERROR);
			}

			if( !$id3_data || !$id3_data['playtime_string'] ){

				$this->errors[] = 'Missing mp4 length';

				$this->notify($basename, 'MISSING MP4 LENGTH', self::NOTIFY_ERROR);

			}else{

				unlink( $capture_filename );

			}

		}else{

			$this->errors[] = 'Video files are missing';

			$this->notify($basename, 'MISSING FILES', self::NOTIFY_ERROR);

		}

		TwitchHelper::log( TwitchHelper::LOG_INFO, "Add segments to " . $basename);
		$this->jsonLoad();
		if(!$this->json['segments_raw']) $this->json['segments_raw'] = [];
		$this->json['segments_raw'][] = basename($converted_filename);
		$this->jsonSave();

		TwitchHelper::log( TwitchHelper::LOG_INFO, "Cleanup old VODs for " . $data_username);
		$this->cleanup( $data_username, $basename );

		$this->notify($basename, '[' . $data_username . '] [end]', self::NOTIFY_DOWNLOAD);

		// finalize

		// metadata stuff
		TwitchHelper::log( TwitchHelper::LOG_INFO, "Sleep 5 minutes for " . $basename);
		sleep(60 * 5);

		TwitchHelper::log( TwitchHelper::LOG_INFO, "Do metadata on " . $basename);

		$vodclass = new TwitchVOD();
		$vodclass->load( TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . $basename . '.json');

		// $vodclass->getDuration();
		$vodclass->saveVideoMetadata();
		$vodclass->saveLosslessCut();
		$vodclass->matchTwitchVod();
		$vodclass->saveJSON();
		
		if( ( TwitchConfig::cfg('download_chat') || TwitchConfig::getStreamer($data_username)['download_chat'] == 1 ) && $vodclass->twitch_vod_id ){
			TwitchHelper::log( TwitchHelper::LOG_INFO, "Auto download chat on " . $basename);
			$vodclass->downloadChat();
		}

		TwitchHelper::log( TwitchHelper::LOG_INFO, "All done for " . $basename);

	}

	/**
	 * Actually capture the stream with streamlink or youtube-dl
	 * Blocking function
	 *
	 * @param array $data
	 * @return string Captured filename
	 */
	public function capture( $data ){

		$data_id = $data['data'][0]['id'];
		$data_title = $data['data'][0]['title'];
		$data_started = $data['data'][0]['started_at'];
		$data_game_id = $data['data'][0]['game_id'];
		$data_username = $data['data'][0]['user_name'];

		if(!$data_id){
			$this->errors[] = 'ID not supplied for capture';
			return false;
		}
		
		$stream_url = 'twitch.tv/' . $data_username;

		$basename = $this->basename( $data );

		$capture_filename = TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . $basename . '.ts';

		// use python pipenv or regular executable
		if( TwitchConfig::cfg('pipenv') ){
			$cmd = 'pipenv run streamlink';
		}else{
			$cmd = TwitchHelper::path_streamlink();
		}

		$cmd .= ' --hls-live-restart'; // start recording from start of stream, though twitch doesn't support this
		$cmd .= ' --hls-live-edge 99999'; // How many segments from the end to start live HLS streams on.
		$cmd .= ' --hls-segment-threads 5'; // The size of the thread pool used to download HLS segments.
		$cmd .= ' --twitch-disable-hosting'; // disable channel hosting
		// $cmd .= ' --twitch-low-latency'; // enable low latency mode, probably not a good idea without testing
		$cmd .= ' --twitch-disable-ads'; // Skip embedded advertisement segments at the beginning or during a stream
		// $cmd .= ' --json'; // json stdout, trying this out
		$cmd .= ' --retry-streams 10'; // Retry fetching the list of available streams until streams are found 
		$cmd .= ' --retry-max 5'; //  stop retrying the fetch after COUNT retry attempt(s).
		$cmd .= ' -o ' . escapeshellarg($capture_filename); // output file
		$cmd .= ' ' . escapeshellarg($stream_url) . ' ' . escapeshellarg( TwitchConfig::cfg('stream_quality') ); // twitch url and quality

		$this->info[] = 'Streamlink cmd: ' . $cmd;

		TwitchHelper::log( TwitchHelper::LOG_INFO, "Starting capture with filename " . $basename);
		
		$capture_output = shell_exec( $cmd );

		$this->info[] = 'Streamlink output: ' . $capture_output;

		file_put_contents( __DIR__ . "/../logs/streamlink_" . $basename . ".log", $capture_output);

		// download with youtube-dl if streamlink fails
		if( strpos($capture_output, '410 Client Error') !== false ){
			
			$this->notify($basename, '410 Error', self::NOTIFY_ERROR);
			// return false;
			
			if( TwitchConfig::cfg('pipenv') ){
				$cmd = 'pipenv run youtube-dl';
			}else{
				$cmd = TwitchHelper::path_youtubedl();
			}
			
			$cmd .= ' --hls-use-mpegts'; // use ts instead of mp4
			$cmd .= ' --no-part';
			$cmd .= ' -o ' . escapeshellarg($capture_filename); // output file
			$cmd .= ' -f ' . escapeshellarg( implode('/', explode(',', TwitchConfig::cfg('stream_quality') ) ) ); // format
			$cmd .= ' ' . escapeshellarg($stream_url);

			$this->info[] = 'Youtube-dl cmd: ' . $cmd;

			$capture_output = shell_exec( $cmd );

			$this->info[] = 'Youtube-dl output: ' . $capture_output;

			file_put_contents( __DIR__ . "/../logs/youtubedl_" . $basename . ".log", $capture_output);
			

			// exit(500);
		} 

		return $capture_filename;

	}

	/**
	 * Mux .ts to .mp4, for better compatibility
	 *
	 * @param string $basename Basename of input file
	 * @return string Converted filename
	 */
	public function convert( $basename ){

		$container_ext = TwitchConfig::cfg('vod_container', 'mp4');

		$capture_filename 	= TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . $basename . '.ts';

		$converted_filename = TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . $basename . '.' . $container_ext;

		$int = 1;

		while( file_exists( $converted_filename ) ){
			$this->errors[] = 'File exists while converting, making a new name';
			TwitchHelper::log( TwitchHelper::LOG_ERROR, "File exists while converting, making a new name for " . $basename);
			$converted_filename = TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . $basename . '-' . $int . '.' . $container_ext;
			$int++;
		}

		$cmd = TwitchHelper::path_ffmpeg();
		$cmd .= ' -i ' . escapeshellarg($capture_filename); // input filename
		$cmd .= ' -codec copy'; // use same codec
		$cmd .= ' -bsf:a aac_adtstoasc'; // fix audio sync in ts
		$cmd .= ' ' . escapeshellarg($converted_filename); // output filename
		
		$this->info[] = 'ffmpeg cmd: ' . $cmd;

		TwitchHelper::log( TwitchHelper::LOG_INFO, "Starting conversion of " . $capture_filename . " to " . $converted_filename);

		$output_convert = shell_exec( $cmd ); // do it

		TwitchHelper::log( TwitchHelper::LOG_INFO, "Finished conversion of " . $capture_filename . " to " . $converted_filename);

		$this->info[] = 'ffmpeg output: ' . $output_convert;

		file_put_contents( __DIR__ . "/../logs/convert_" . $basename . ".log", $output_convert);
		
		return $converted_filename;

	}

}
