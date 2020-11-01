<?php

namespace App;

use DateTime;

use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\Process;

class TwitchAutomator {

	public $data_cache = [];

	public $json = [];

	public $errors = [];
	public $info = [];

	public $force_record;

	/**
	 * Working VOD
	 *
	 * @var TwitchVOD
	 */
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
	
	/**
	 * Either send email or store in logs directory
	 * TODO: remove this, obsolete
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
			file_put_contents( TwitchHelper::$logs_folder . DIRECTORY_SEPARATOR . "html" . DIRECTORY_SEPARATOR . date("Y-m-d.H_i_s") . ".html", $body);
		}

	}

	/**
	 * Remove old VODs by streamer name, this has to be properly rewritten
	 */
	public function cleanup( $streamer_name, $source_basename = null ){

		$vods = glob( TwitchHelper::vod_folder( $streamer_name ) . DIRECTORY_SEPARATOR . $streamer_name . "_*.json");

		$total_size = 0;

		$vod_list = [];

		foreach ($vods as $v) {
			
			$vodclass = new TwitchVOD();
			$vodclass->load($v);

			$vod_list[] = $vodclass;

			foreach($vodclass->segments_raw as $s){
				$total_size += filesize( TwitchHelper::vod_folder( $streamer_name ) . DIRECTORY_SEPARATOR . basename($s) );
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
		$data_username = $data['data'][0]['user_name'];

		$this->data_cache = $data;

		if( !$data_id ){

			$this->end( $data );

		}else{

			$basename = $this->basename( $data );

			$folder_base = TwitchHelper::vod_folder( $data_username );
			
			if( file_exists( $folder_base . DIRECTORY_SEPARATOR . $basename . '.json') ){

				if( !file_exists( $folder_base. DIRECTORY_SEPARATOR . $basename . '.ts') ){

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

		$folder_base = TwitchHelper::vod_folder( $data_username );

		if( $this->vod ){
			$this->vod->refreshJSON();
		}else{
			$this->vod = new TwitchVOD();
			if( $this->vod->load( $folder_base . DIRECTORY_SEPARATOR . $basename . '.json' ) ){
				// ok
			}else{
				$this->vod->create( $folder_base . DIRECTORY_SEPARATOR . $basename . '.json' );
			}
		}
		
		// $this->jsonLoad();

		// json format
	
		// full json data
		$this->vod->meta = $data;
		$this->vod->json['meta'] = $data;

		if( $this->force_record ) $this->vod->force_record = true;
		
		// full datetime-stamp of stream start
		// $this->json['started_at'] = $data_started;
		$this->vod->started_at = \DateTime::createFromFormat("Y-m-d\TH:i:s\Z", $data_started );

		// fetch game name from either cache or twitch
		$game_name = TwitchHelper::getGameName( $data_game_id );

		$chapter = [
			'time' 			=> $this->getDateTime(),
			'datetime'		=> new \DateTime(),
			'game_id' 		=> $data_game_id,
			'game_name'		=> $game_name,
			'viewer_count' 	=> $data_viewer_count,
			'title'			=> $data_title
		];
		
		$this->vod->addChapter($chapter);
		$this->vod->saveJSON('game update');

		$this->notify('', '[' . $data_username . '] [game update: ' . $game_name . ']', self::NOTIFY_GAMECHANGE);

		TwitchHelper::log( TwitchHelper::LOG_SUCCESS, "Game updated on " . $data_username . " to " . $game_name);

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

		$folder_base = TwitchHelper::vod_folder( $data_username );
		
		$this->vod = new TwitchVOD();
		$this->vod->create( $folder_base . DIRECTORY_SEPARATOR . $basename . '.json' );

		$this->vod->meta = $data;
		$this->vod->json['meta'] = $data;
		$this->vod->streamer_name = $data_username;
		$this->vod->streamer_id = TwitchHelper::getChannelId( $data_username );
		$this->vod->started_at = \DateTime::createFromFormat("Y-m-d\TH:i:s\Z", $data_started );

		if( $this->force_record ) $this->vod->force_record = true;

		$this->vod->saveJSON('stream download');
		$this->vod->refreshJSON();
		
        
        $streamer = TwitchConfig::getStreamer( $data_username );

		// check matched title, broken?
		if( $streamer && isset( $streamer['match'] ) ){

			$match = false;

			$this->notify($basename, 'Check keyword matches for user ' . json_encode( $streamer ), self::NOTIFY_GENERIC);
			TwitchHelper::log( TwitchHelper::LOG_INFO, "Check keyword matches for " . $basename, ['download' => $data_username] );

			foreach( $streamer['match'] as $m ){
				if( strpos( strtolower($data_title), $m ) !== false ){
					$match = true;
					break;
				}
			}

			if(!$match){
				$this->notify($basename, 'Cancel download because stream title does not contain keywords', self::NOTIFY_GENERIC);
				TwitchHelper::log( TwitchHelper::LOG_WARNING, "Cancel download of " . $basename . " due to missing keywords", ['download' => $data_username] );
				return;
			}

		}

		$this->vod->is_capturing = true;
		$this->vod->saveJSON('is_capturing set');

		// in progress
		TwitchHelper::log( TwitchHelper::LOG_INFO, "Update game for " . $basename, ['download' => $data_username]);
		$this->updateGame( $data );

		// download notification
		$this->notify($basename, '[' . $data_username . '] [download]', self::NOTIFY_DOWNLOAD);
	
		// capture with streamlink
		$capture_filename = $this->capture( $data );

		// error handling if nothing got downloaded
		if( !file_exists( $capture_filename ) ){

			TwitchHelper::log( TwitchHelper::LOG_WARNING, "Panic handler for " . $basename . ", no captured file!");

			if( $tries >= TwitchConfig::cfg('download_retries') ){
				$this->errors[] = 'Giving up on downloading, too many tries';
				$this->notify($basename, 'GIVING UP, TOO MANY TRIES', self::NOTIFY_ERROR);
				TwitchHelper::log( TwitchHelper::LOG_ERROR, "Giving up on downloading, too many tries for " . $basename, ['download' => $data_username] );
				rename( $folder_base . DIRECTORY_SEPARATOR . $basename . '.json', $folder_base . DIRECTORY_SEPARATOR . $basename . '.json.broken' );
				throw new \Exception('Too many tries');
				return;
			}

			$this->errors[] = 'Error when downloading, retrying';

			$this->info[] = 'Capture name: ' . $capture_filename;

			$this->notify($basename, 'MISSING DOWNLOAD, TRYING AGAIN (#' . $tries . ')', self::NOTIFY_ERROR);
			
			TwitchHelper::log( TwitchHelper::LOG_ERROR, "Error when downloading, retrying " . $basename, ['download' => $data_username] );

			sleep(15);

			$this->download( $data, $tries + 1 );

			return;

		}

		// timestamp
		TwitchHelper::log( TwitchHelper::LOG_INFO, "Add end timestamp for " . $basename, ['download' => $data_username] );

		$this->vod->refreshJSON();
		$this->vod->ended_at = $this->getDateTime();
		$this->vod->dt_ended_at = new \DateTime();
		$this->vod->is_capturing = false;
		if( $this->stream_resolution ) $this->vod->stream_resolution = $this->stream_resolution;
		$this->vod->saveJSON('stream capture end');

		sleep(60);


		// convert notify
		$this->notify($basename, '[' . $data_username . '] [convert]', self::NOTIFY_DOWNLOAD);

		$this->vod->refreshJSON();
		$this->vod->is_converting = true;
		$this->vod->saveJSON('is_converting set');
		
		// convert with ffmpeg
		$converted_filename = $this->convert( $basename );

		sleep(10);
		
		// remove ts if both files exist
		if( file_exists( $capture_filename ) && file_exists( $converted_filename ) ){

			unlink( $capture_filename );

		}else{

			$this->errors[] = 'Video files are missing';

			$this->notify($basename, 'MISSING FILES', self::NOTIFY_ERROR);

		}

		TwitchHelper::log( TwitchHelper::LOG_INFO, "Add segments to " . $basename, ['download' => $data_username] );
		$this->vod->refreshJSON();
		$this->vod->is_converting = false;
		// if(!$this->json['segments_raw']) $this->json['segments_raw'] = [];
		$this->vod->addSegment( $converted_filename );
		$this->vod->saveJSON('add segment');

		TwitchHelper::log( TwitchHelper::LOG_INFO, "Cleanup old VODs for " . $data_username, ['download' => $data_username] );
		$this->cleanup( $data_username, $basename );

		$this->notify($basename, '[' . $data_username . '] [end]', self::NOTIFY_DOWNLOAD);

		// finalize

		// metadata stuff
		TwitchHelper::log( TwitchHelper::LOG_INFO, "Sleep 5 minutes for " . $basename, ['download' => $data_username] );
		sleep(60 * 5);

		TwitchHelper::log( TwitchHelper::LOG_INFO, "Do metadata on " . $basename, ['download' => $data_username] );

		$vodclass = new TwitchVOD();
		$vodclass->load( $folder_base . DIRECTORY_SEPARATOR . $basename . '.json');

		// $vodclass->getDuration();
		// $vodclass->saveVideoMetadata();
		/*
		$vodclass->getMediainfo();
		$vodclass->saveLosslessCut();
		$vodclass->matchTwitchVod();
		$vodclass->is_finalized = true;
		*/
		$vodclass->finalize();
		$vodclass->saveJSON('finalized');
		
		if( ( TwitchConfig::cfg('download_chat') || ( TwitchConfig::getStreamer($data_username)['download_chat'] ) && $vodclass->twitch_vod_id ) ){
			TwitchHelper::log( TwitchHelper::LOG_INFO, "Auto download chat on " . $basename, ['download' => $data_username] );
			$vodclass->downloadChat();

			if( TwitchConfig::getStreamer($data_username)['burn_chat'] ){
				if( $vodclass->renderChat() ){
					$vodclass->burnChat();
				}
			}

		}

		// add to history, testing
		$history = file_exists( TwitchConfig::$historyPath ) ? json_decode( file_get_contents( TwitchConfig::$historyPath ), true ) : [];
		$history[] = [ 'streamer_name' => $this->vod->streamer_name, 'started_at' => $this->vod->started_at, 'ended_at' => $this->vod->ended_at, 'title' => $data_title ];
		file_put_contents( TwitchConfig::$historyPath, json_encode($history) );

		TwitchHelper::log( TwitchHelper::LOG_SUCCESS, "All done for " . $basename, ['download' => $data_username] );

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

		$folder_base = TwitchHelper::vod_folder( $data_username );

		$capture_filename = $folder_base . DIRECTORY_SEPARATOR . $basename . '.ts';
		
		$chat_filename = $folder_base . DIRECTORY_SEPARATOR . $basename . '.chatdump';

		// failure
		$int = 1;
		while( file_exists( $capture_filename ) ){
			$this->errors[] = 'File exists while capturing, making a new name';
			TwitchHelper::log( TwitchHelper::LOG_ERROR, "File exists while capturing, making a new name for " . $basename . ", attempt #" . $int, ['download-capture' => $data_username] );
			$capture_filename = $folder_base . DIRECTORY_SEPARATOR . $basename . '-' . $int . '.ts';
			$int++;
		}
		
		$cmd = [];

		// use python pipenv or regular executable
		if( TwitchConfig::cfg('pipenv') ){
			$cmd[] = 'pipenv run streamlink';
		}else{
			$cmd[] = TwitchHelper::path_streamlink();
		}

		$cmd[] = '--hls-live-restart'; // start recording from start of stream, though twitch doesn't support this
		
		$cmd[] = '--hls-live-edge';
		$cmd[] = '99999'; // How many segments from the end to start live HLS streams on.
		
		$cmd[] = '--hls-timeout';
		$cmd[] = TwitchConfig::cfg('hls_timeout', 120); // timeout due to ads

		$cmd[] = '--hls-segment-threads';
		$cmd[] = '5'; // The size of the thread pool used to download HLS segments.

		$cmd[] = '--twitch-disable-hosting'; // disable channel hosting
		
		if( TwitchConfig::cfg('low_latency', false) ){
			$cmd[] = '--twitch-low-latency'; // enable low latency mode, probably not a good idea without testing
		}
		if( TwitchConfig::cfg('disable_ads', false) ){
			$cmd[] = '--twitch-disable-ads'; // Skip embedded advertisement segments at the beginning or during a stream
		}
		
		$cmd[] = '--retry-streams';
		$cmd[] = '10'; // Retry fetching the list of available streams until streams are found 
		
		$cmd[] = '--retry-max';
		$cmd[] = '5'; //  stop retrying the fetch after COUNT retry attempt(s).
		
		if( TwitchConfig::cfg('debug', false) || TwitchConfig::cfg('app_verbose', false) ){
			$cmd[] = '--loglevel';
			$cmd[] = 'debug';
		}

		$cmd[] = '-o';
		$cmd[] = $capture_filename; // output file
		
		$cmd[] = '--url';
		$cmd[] = $stream_url; // twitch url
		
		$cmd[] = '--default-stream';
		$cmd[] = implode(",", TwitchConfig::getStreamer( $data_username )['quality'] ); // quality

		$this->info[] = 'Streamlink cmd: ' . implode(" ", $cmd);

		$this->vod->refreshJSON();
		$this->vod->dt_capture_started = new \DateTime();
		$this->vod->saveJSON('dt_capture_started set');

		TwitchHelper::log( TwitchHelper::LOG_INFO, "Starting capture with filename " . basename($capture_filename), ['download-capture' => $data_username, 'cmd' => implode(' ', $cmd)  ] );
		
		// start process in async mode
		$process = new Process( $cmd, dirname($capture_filename), null, null, null );
		$process->start();

		// output command line
		TwitchHelper::append_log("streamlink_capture_" . $basename . "_stdout." . $int, "$ " . implode(" ", $cmd) );
		TwitchHelper::append_log("streamlink_capture_" . $basename . "_stderr." . $int, "$ " . implode(" ", $cmd) );

		// save pid to file
		$pidfile = TwitchHelper::$pids_folder . DIRECTORY_SEPARATOR . 'capture_' . $data_username . '.pid';
		TwitchHelper::log( TwitchHelper::LOG_DEBUG, "Capture " . basename($capture_filename) . " has PID " . $process->getPid(), ['download-capture' => $data_username] );
		file_put_contents( $pidfile, $process->getPid() );

		// chat capture
		if( TwitchConfig::cfg('chat_dump') ){

			$chat_cmd = [];

			// test
			// $chat_cmd[] = 'screen';
			// $chat_cmd[] = '-S';
			// $chat_cmd[] = $basename;

			$chat_cmd[] = 'python';
			$chat_cmd[] = __DIR__ . '/Utilities/twitch-chat.py';
			$chat_cmd[] = $this->vod->streamer_name;
			$chat_cmd[] = $this->vod->streamer_id;
			$chat_cmd[] = $chat_filename;

			TwitchHelper::log( TwitchHelper::LOG_INFO, "Starting chat dump with filename " . basename($chat_filename), ['download-capture' => $data_username, 'cmd' => implode(' ', $chat_cmd) ] );
			
			$chat_process = new Process($chat_cmd, null, null, null, null );
			$chat_process->setTimeout(null);
			$chat_process->setIdleTimeout(null);
			$chat_process->start();
			
			$chat_pidfile = TwitchHelper::$pids_folder . DIRECTORY_SEPARATOR . 'chatdump_' . $data_username . '.pid';
			file_put_contents( $chat_pidfile, $chat_process->getPid() );

			TwitchHelper::append_log("chatdump_" . $basename . "_stdout." . $int, implode(" ", $chat_cmd) );
			TwitchHelper::append_log("chatdump_" . $basename . "_stderr." . $int, implode(" ", $chat_cmd) );

		}

		// wait loop until it's done
		$process->wait(function($type, $buffer) use($basename, $int, $data_username, $chat_process) {
			
			if (Process::ERR === $type) {
				// echo 'ERR > '.$buffer;
			} else {
				// echo 'OUT > '.$buffer;
			}

			if( isset($chat_process) && $chat_process->isRunning() ){
				if( !$chat_process->getIncrementalOutput() ){
					TwitchHelper::log( TwitchHelper::LOG_WARNING, "No chat output in chat dump", ['download-capture' => $data_username] );
				}
			}
			
			// get stream resolution
			preg_match("/stream:\s([0-9_a-z]+)\s/", $buffer, $matches);
			if($matches){
				$this->stream_resolution = $matches[1];
				TwitchHelper::log( TwitchHelper::LOG_INFO, "Stream resolution for " . $basename . ": " . $this->stream_resolution, ['download-capture' => $data_username] );
			}

			// stream stop
			if( strpos($buffer, "404 Client Error") !== false ){
				TwitchHelper::log( TwitchHelper::LOG_WARNING, "Chunk removed for " . $basename . "!", ['download-capture' => $data_username] );
			}

			// log output
			if( Process::ERR === $type ){
				TwitchHelper::append_log("streamlink_" . $basename . "_stderr." . $int, $buffer );
			}else{
				TwitchHelper::append_log("streamlink_" . $basename . "_stdout." . $int, $buffer );
			}
			
		});
		TwitchHelper::log( TwitchHelper::LOG_INFO, "Finished capture with filename " . basename($capture_filename), ['download-capture' => $data_username] );

		if( TwitchConfig::cfg('chat_dump') ){
			// gracefully kill chat dump
			TwitchHelper::log( TwitchHelper::LOG_INFO, "Ending chat dump with filename " . basename($chat_filename), ['download-capture' => $data_username] );
			
			// $chat_process->setTimeout(90);
			
			/*
			$chat_process->signal( defined('SIGTERM') ? SIGTERM : 15 ); // SIGTERM

			
			sleep(10);
			if( $chat_process->isRunning() ){
				$chat_process->stop(0);
			}
			*/

			$chat_process->stop(15);

			/*
			try {
				$chat_process->wait();
			} catch (\Throwable $th) {
				TwitchHelper::log( TwitchHelper::LOG_ERROR, "Chat dump SIGTERM wait error: " . $th->getMessage(), ['download-capture' => $data_username] );
			}
			*/
			
			if( file_exists( $chat_pidfile ) ) unlink( $chat_pidfile );
			TwitchHelper::append_log("chatdump_" . $basename . "_stdout." . $int, $chat_process->getOutput() );
			TwitchHelper::append_log("chatdump_" . $basename . "_stderr." . $int, $chat_process->getErrorOutput() );
			TwitchHelper::log( TwitchHelper::LOG_INFO, "Ended chat dump with filename " . basename($chat_filename), ['download-capture' => $data_username] );
		}

		// $this->info[] = 'Streamlink output: ' . $process->getOutput();
		// $this->info[] = 'Streamlink error: ' . $process->getErrorOutput();

		// download with youtube-dl if streamlink fails, shouldn't be required anymore
		if( strpos($process->getOutput(), '410 Client Error') !== false ){
			
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
			$cmd .= ' -f ' . escapeshellarg( implode('/', TwitchConfig::getStreamer( $data_username )['quality'] ) ); // format, does this work?
			if( TwitchConfig::cfg('debug', false) || TwitchConfig::cfg('app_verbose', false) ) $cmd .= ' -v';
			$cmd .= ' ' . escapeshellarg($stream_url);

			$this->info[] = 'Youtube-dl cmd: ' . $cmd;

			$capture_output = shell_exec( $cmd );

			$this->info[] = 'Youtube-dl output: ' . $capture_output;

			// file_put_contents( __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "logs" . DIRECTORY_SEPARATOR . "youtubedl_" . $basename . "_" . time() . ".log", "$ " . $cmd . "\n" . $capture_output);
			TwitchHelper::append_log( "youtubedl_" . $basename . "_" . time(), "$ " . $cmd . "\n" . $capture_output );

			// exit(500);
		}

		if( strpos($capture_output, 'already exists, use') !== false ){
			TwitchHelper::log( TwitchHelper::LOG_FATAL, "Unexplainable, " . basename($capture_filename) . " could not be captured due to existing file already.", ['download-capture' => $data_username] );
		}

		// get stream resolution
		preg_match("/stream:\s([0-9_a-z]+)\s/", $capture_output, $matches);
		if($matches){
			$this->stream_resolution = $matches[1];
		}

		// delete pid file
		if( file_exists( $pidfile ) ) unlink( $pidfile );

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

		$folder_base = TwitchHelper::vod_folder( $this->vod->streamer_name );

		$capture_filename 	= $folder_base . DIRECTORY_SEPARATOR . $basename . '.ts';

		$converted_filename = $folder_base . DIRECTORY_SEPARATOR . $basename . '.' . $container_ext;

		$data_username = $this->vod->streamer_name;

		$int = 1;

		while( file_exists( $converted_filename ) ){
			$this->errors[] = 'File exists while converting, making a new name';
			TwitchHelper::log( TwitchHelper::LOG_ERROR, "File exists while converting, making a new name for " . $basename . ", attempt #" . $int, ['download-convert' => $data_username]);
			$converted_filename = $folder_base . DIRECTORY_SEPARATOR . $basename . '-' . $int . '.' . $container_ext;
			$int++;
		}

		$cmd = [];

		$cmd[] = TwitchHelper::path_ffmpeg();
		
		$cmd[] = '-i';
		$cmd[] = $capture_filename; // input filename

		$cmd[] = '-codec';
		$cmd[] = 'copy'; // use same codec

		$cmd[] = '-bsf:a';
		$cmd[] = 'aac_adtstoasc'; // fix audio sync in ts

		if( TwitchConfig::cfg('debug', false) || TwitchConfig::cfg('app_verbose', false) ){
			$cmd[] = '-loglevel';
			$cmd[] = 'repeat+level+verbose';
		}
		
		$cmd[] = $converted_filename; // output filename

		$this->vod->refreshJSON();
		$this->vod->dt_conversion_started = new \DateTime();
		$this->vod->saveJSON('dt_conversion_started set');

		TwitchHelper::log( TwitchHelper::LOG_INFO, "Starting conversion of " . basename($capture_filename) . " to " . basename($converted_filename), ['download-convert' => $data_username] );

		$process = new Process( $cmd, dirname($capture_filename), null, null, null );
		$process->start();

		// create pidfile
		$pidfile = TwitchHelper::$pids_folder . DIRECTORY_SEPARATOR . 'convert_' . $data_username . '.pid';
		file_put_contents( $pidfile, $process->getPid() );
		
		// wait until process is done
		$process->wait();

		// remove pidfile
		if( file_exists( $pidfile ) ) unlink( $pidfile );

		TwitchHelper::append_log( "ffmpeg_convert_" . $basename . "_" . time() . "_stdout", "$ " . implode(" ", $cmd) . "\n" . $process->getOutput() );
		TwitchHelper::append_log( "ffmpeg_convert_" . $basename . "_" . time() . "_stderr", "$ " . implode(" ", $cmd) . "\n" . $process->getErrorOutput() );

		if( file_exists( $converted_filename ) ){
			TwitchHelper::log( TwitchHelper::LOG_SUCCESS, "Finished conversion of " . basename($capture_filename) . " to " . basename($converted_filename), ['download-convert' => $data_username] );
		}else{
			TwitchHelper::log( TwitchHelper::LOG_ERROR, "Failed conversion of " . basename($capture_filename) . " to " . basename($converted_filename), ['download-convert' => $data_username] );
		}

		return $converted_filename;

	}

}
