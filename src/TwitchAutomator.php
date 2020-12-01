<?php

namespace App;

use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\Process;

// declare(ticks=1); // test

class TwitchAutomator
{

	public $data_cache = [];

	public $json = [];

	// public $errors = [];
	// public $info = [];

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
	public function basename($data)
	{

		$data_id = $data['data'][0]['id'];
		$data_title = $data['data'][0]['title'];
		$data_started = $data['data'][0]['started_at'];
		$data_game_id = $data['data'][0]['game_id'];
		$data_username = $data['data'][0]['user_name'];

		// return $data_username . '_' . $data_id . '_' . str_replace(':', '_', $data_started);

		return $data_username . '_' . str_replace(':', '_', $data_started) . '_' . $data_id;
	}

	public function getDateTime()
	{
		date_default_timezone_set('UTC');
		return date(TwitchHelper::DATE_FORMAT);
	}

	/**
	 * Remove old VODs by streamer name, this has to be properly rewritten
	 */
	public function cleanup($streamer_name, $source_basename = null)
	{

		$vods = glob(TwitchHelper::vodFolder($streamer_name) . DIRECTORY_SEPARATOR . $streamer_name . "_*.json");

		$total_size = 0;

		$vod_list = [];

		foreach ($vods as $v) {

			$vodclass = new TwitchVOD();
			$vodclass->load($v);

			$vod_list[] = $vodclass;

			foreach ($vodclass->segments_raw as $s) {
				$total_size += filesize(TwitchHelper::vodFolder($streamer_name) . DIRECTORY_SEPARATOR . basename($s));
			}
		}

		$gb = $total_size / 1024 / 1024 / 1024;

		// $this->info[] = 'Total filesize for ' . $streamer_name . ': ' . $gb;
		TwitchHelper::log(TwitchHelper::LOG_INFO, "Total filesize for {$streamer_name}: " . TwitchHelper::formatBytes($total_size));

		TwitchHelper::log(TwitchHelper::LOG_INFO, "Amount for {$streamer_name}: " . sizeof($vod_list) . "/" . (TwitchConfig::cfg("vods_to_keep") + 1));

		// don't include the current vod
		if (sizeof($vod_list) > (TwitchConfig::cfg('vods_to_keep') + 1) || $gb > TwitchConfig::cfg('storage_per_streamer')) {

			TwitchHelper::log(TwitchHelper::LOG_INFO, "Total filesize for {$streamer_name} exceeds either vod amount or storage per streamer");

			// don't delete the newest vod, hopefully
			if ($source_basename != null && $vod_list[0]->basename == $source_basename) {
				TwitchHelper::log(TwitchHelper::LOG_ERROR, "Trying to cleanup latest VOD {$vod_list[0]->basename}");
				return false;
			}

			TwitchHelper::log(TwitchHelper::LOG_INFO, "Cleanup {$vod_list[0]->basename}");
			$vod_list[0]->delete();
		}
	}

	/**
	 * Entrypoint for stream capture
	 *
	 * @param array $data
	 * @return void
	 */
	public function handle($data)
	{

		TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Handle called");

		if (!$data['data']) {
			TwitchHelper::log(TwitchHelper::LOG_ERROR, "No data supplied for handle");
			return false;
		}

		$data_id = $data['data'][0]['id'];
		// $data_title = $data['data'][0]['title'];
		// $data_started = $data['data'][0]['started_at'];
		// $data_game_id = $data['data'][0]['game_id'];
		$data_username = $data['data'][0]['user_name'];

		$this->data_cache = $data;

		if (!$data_id) {

			$this->end($data);
		} else {

			$basename = $this->basename($data);

			$folder_base = TwitchHelper::vodFolder($data_username);

			if (file_exists($folder_base . DIRECTORY_SEPARATOR . $basename . '.json')) {

				$vodclass = new TwitchVOD();
				if ($vodclass->load($folder_base . DIRECTORY_SEPARATOR . $basename . '.json')) {

					if ($vodclass->is_finalized) {
						TwitchHelper::log(TwitchHelper::LOG_ERROR, "VOD is finalized, but wanted more info on " . $basename);
					} elseif ($vodclass->is_capturing) {
						$this->updateGame($data);
					} else {
						TwitchHelper::log(TwitchHelper::LOG_ERROR, "VOD exists but isn't capturing anymore on " . $basename);
					}
				} else {
					TwitchHelper::log(TwitchHelper::LOG_ERROR, "Could not load VOD in handle for " . $basename);
				}
				/*
				if (!file_exists($folder_base . DIRECTORY_SEPARATOR . $basename . '.ts')) {

					// $this->notify($basename, 'VOD JSON EXISTS BUT NOT VIDEO', self::NOTIFY_ERROR);
					TwitchHelper::log(TwitchHelper::LOG_ERROR, "VOD JSON exists but not video on " . $basename);

					$this->download($data);
				} else {

					$this->updateGame($data);
				}
				*/
			} else {

				$this->download($data);
			}
		}
	}

	/**
	 * Add game/chapter to stream
	 *
	 * @param array $data
	 * @return void
	 */
	public function updateGame($data)
	{

		$data_id 			= $data['data'][0]['id'];
		$data_started 		= $data['data'][0]['started_at'];
		$data_game_id 		= $data['data'][0]['game_id'];
		$data_username 		= $data['data'][0]['user_name'];
		$data_viewer_count 	= $data['data'][0]['viewer_count'];
		$data_title 		= $data['data'][0]['title'];

		$basename = $this->basename($data);

		$folder_base = TwitchHelper::vodFolder($data_username);

		if ($this->vod) {
			$this->vod->refreshJSON();
		} else {
			$this->vod = new TwitchVOD();
			if ($this->vod->load($folder_base . DIRECTORY_SEPARATOR . $basename . '.json')) {
				// ok
			} else {
				$this->vod->create($folder_base . DIRECTORY_SEPARATOR . $basename . '.json');
			}
		}

		// $this->jsonLoad();

		// json format

		// full json data
		$this->vod->meta = $data;
		$this->vod->json['meta'] = $data;

		if ($this->force_record) $this->vod->force_record = true;

		// full datetime-stamp of stream start
		// $this->json['started_at'] = $data_started;
		$this->vod->dt_started_at = \DateTime::createFromFormat(TwitchHelper::DATE_FORMAT, $data_started);

		// fetch game name from either cache or twitch
		$game_name = TwitchHelper::getGameName((int)$data_game_id);

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

		// $this->notify('', '[' . $data_username . '] [game update: ' . $game_name . ']', self::NOTIFY_GAMECHANGE);

		TwitchHelper::webhook([
			'action' => 'chapter_update',
			'chapter' => $chapter,
			'vod' => $this->vod
		]);

		TwitchHelper::log(TwitchHelper::LOG_SUCCESS, "Game updated on {$data_username} to {$game_name} ({$data_title})");
	}

	public function end()
	{

		// $this->notify('', '[stream end]', self::NOTIFY_DOWNLOAD);
		TwitchHelper::log(TwitchHelper::LOG_INFO, "Stream end");
	}

	/**
	 * Start the download/capture process of a live stream
	 *
	 * @param array $data
	 * @param integer $tries
	 * @return void
	 */
	public function download($data, $tries = 0)
	{

		$data_id = $data['data'][0]['id'];
		$data_title = $data['data'][0]['title'];
		$data_started = $data['data'][0]['started_at'];
		$data_game_id = $data['data'][0]['game_id'];
		$data_username = $data['data'][0]['user_name'];

		if (!$data_id) {
			// $this->errors[] = 'No data id for download';
			// $this->notify($data, 'NO DATA SUPPLIED FOR DOWNLOAD, TRY #' . $tries, self::NOTIFY_ERROR);
			TwitchHelper::log(TwitchHelper::LOG_ERROR, "No data supplied for download, try #{$tries}");
			throw new \Exception('No data supplied');
			return;
		}

		$stream_url = 'twitch.tv/' . $data_username;

		$basename = $this->basename($data);

		$folder_base = TwitchHelper::vodFolder($data_username);

		// if running
		$job = new TwitchAutomatorJob("capture_{$data_username}");
		if ( $job->getStatus() ) {
			TwitchHelper::log(TwitchHelper::LOG_FATAL, "Stream already capturing to {$job->metadata['basename']} from {$data_username}, but reached download function regardless!", ['download' => $data_username]);
			return false;
		}

		$this->vod = new TwitchVOD();
		$this->vod->create($folder_base . DIRECTORY_SEPARATOR . $basename . '.json');

		$this->vod->meta = $data;
		$this->vod->json['meta'] = $data;
		$this->vod->streamer_name = $data_username;
		$this->vod->streamer_id = TwitchHelper::getChannelId($data_username);
		$this->vod->dt_started_at = \DateTime::createFromFormat(TwitchHelper::DATE_FORMAT, $data_started);

		if ($this->force_record) $this->vod->force_record = true;

		$this->vod->saveJSON('stream download');
		$this->vod->refreshJSON();


		$streamer = TwitchConfig::getStreamer($data_username);

		// check matched title, broken?
		if ($streamer && isset($streamer['match'])) {

			$match = false;

			// $this->notify($basename, 'Check keyword matches for user ' . json_encode($streamer), self::NOTIFY_GENERIC);
			TwitchHelper::log(TwitchHelper::LOG_INFO, "Check keyword matches for {$basename}", ['download' => $data_username]);

			foreach ($streamer['match'] as $m) {
				if (mb_strpos(strtolower($data_title), $m) !== false) {
					$match = true;
					break;
				}
			}

			if (!$match) {
				// $this->notify($basename, 'Cancel download because stream title does not contain keywords', self::NOTIFY_GENERIC);
				TwitchHelper::log(TwitchHelper::LOG_WARNING, "Cancel download of {$basename} due to missing keywords", ['download' => $data_username]);
				return;
			}
		}

		$this->vod->is_capturing = true;
		$this->vod->saveJSON('is_capturing set');

		TwitchHelper::webhook([
			'action' => 'start_capture',
			'vod' => $this->vod
		]);

		// in progress
		TwitchHelper::log(TwitchHelper::LOG_INFO, "Update game for {$basename}", ['download' => $data_username]);
		$this->updateGame($data);

		// download notification
		// $this->notify($basename, '[' . $data_username . '] [download]', self::NOTIFY_DOWNLOAD);

		/** @todo: non-blocking, how */
		if( TwitchConfig::cfg('playlist_dump') ){
			/*
			$client = new \GuzzleHttp\Client();
			$client->request("GET", "http://localhost:8080/hook", []);
			*/
			// $this->playlistDump($data);
		}

		// capture with streamlink
		$capture_filename = $this->capture($data);

		// error handling if nothing got downloaded
		if (!$capture_filename || (isset($capture_filename) && !file_exists($capture_filename))) {

			TwitchHelper::log(TwitchHelper::LOG_WARNING, "Panic handler for {$basename}, no captured file!");

			if ($tries >= TwitchConfig::cfg('download_retries')) {
				// $this->errors[] = 'Giving up on downloading, too many tries';
				// $this->notify($basename, 'GIVING UP, TOO MANY TRIES', self::NOTIFY_ERROR);
				TwitchHelper::log(TwitchHelper::LOG_ERROR, "Giving up on downloading, too many tries for {$basename}", ['download' => $data_username]);
				rename($folder_base . DIRECTORY_SEPARATOR . $basename . '.json', $folder_base . DIRECTORY_SEPARATOR . $basename . '.json.broken');
				throw new \Exception('Too many tries');
				return;
				// @TODO: fatal error
			}

			TwitchHelper::log(TwitchHelper::LOG_ERROR, "Error when downloading, retrying {$basename}", ['download' => $data_username]);

			sleep(15);

			$this->download($data, $tries + 1);

			return;
		}

		// timestamp
		TwitchHelper::log(TwitchHelper::LOG_INFO, "Add end timestamp for {$basename}", ['download' => $data_username]);

		$this->vod->refreshJSON();
		// $this->vod->ended_at = $this->getDateTime();
		$this->vod->dt_ended_at = new \DateTime();
		$this->vod->is_capturing = false;
		if ($this->stream_resolution) $this->vod->stream_resolution = $this->stream_resolution;
		$this->vod->saveJSON('stream capture end');

		sleep(60);


		// convert notify
		// $this->notify($basename, '[' . $data_username . '] [convert]', self::NOTIFY_DOWNLOAD);

		$this->vod->refreshJSON();
		$this->vod->is_converting = true;
		$this->vod->saveJSON('is_converting set');

		// convert with ffmpeg
		$converted_filename = $this->convert($basename);

		sleep(10);

		// remove ts if both files exist
		if (file_exists($capture_filename) && $converted_filename && file_exists($converted_filename)) {
			unlink($capture_filename);
		} else {
			TwitchHelper::log(TwitchHelper::LOG_FATAL, "Missing conversion files for {$basename}");
			$this->vod->automator_fail = true;
			$this->vod->is_converting = false;
			$this->vod->saveJSON('automator fail');
			return false;
			// return @TODO: fatal error
		}

		TwitchHelper::log(TwitchHelper::LOG_INFO, "Add segments to {$basename}", ['download' => $data_username]);
		$this->vod->refreshJSON();
		$this->vod->is_converting = false;
		// if(!$this->json['segments_raw']) $this->json['segments_raw'] = [];
		$this->vod->addSegment($converted_filename);
		$this->vod->saveJSON('add segment');

		TwitchHelper::log(TwitchHelper::LOG_INFO, "Cleanup old VODs for {$data_username}", ['download' => $data_username]);
		$this->cleanup($data_username, $basename);

		// finalize

		// metadata stuff
		TwitchHelper::log(TwitchHelper::LOG_INFO, "Sleep 2 minutes for {$basename}", ['download' => $data_username]);
		sleep(60 * 2);

		TwitchHelper::log(TwitchHelper::LOG_INFO, "Do metadata on {$basename}", ['download' => $data_username]);

		$vodclass = new TwitchVOD();
		$vodclass->load($folder_base . DIRECTORY_SEPARATOR . $basename . '.json');

		$vodclass->finalize();
		$vodclass->saveJSON('finalized');

		if ($streamer['download_chat'] && $vodclass->twitch_vod_id) {
			TwitchHelper::log(TwitchHelper::LOG_INFO, "Auto download chat on {$basename}", ['download' => $data_username]);
			$vodclass->downloadChat();

			if ($streamer['burn_chat']) {
				if ($vodclass->renderChat()) {
					$vodclass->burnChat();
				}
			}
		}

		// add to history, testing
		$history = file_exists(TwitchConfig::$historyPath) ? json_decode(file_get_contents(TwitchConfig::$historyPath), true) : [];
		$history[] = [
			'streamer_name' => $this->vod->streamer_name,
			'started_at' => $this->vod->dt_started_at,
			'ended_at' => $this->vod->dt_ended_at,
			'title' => $data_title
		];
		file_put_contents(TwitchConfig::$historyPath, json_encode($history));

		TwitchHelper::log(TwitchHelper::LOG_SUCCESS, "All done for {$basename}", ['download' => $data_username]);

		TwitchHelper::webhook([
			'action' => 'finish_capture',
			'vod' => $vodclass
		]);
	}

	/**
	 * Actually capture the stream with streamlink or youtube-dl
	 * Blocking function
	 *
	 * @param array $data
	 * @return string Captured filename
	 */
	public function capture($data)
	{

		$data_id = $data['data'][0]['id'];
		$data_title = $data['data'][0]['title'];
		$data_started = $data['data'][0]['started_at'];
		$data_game_id = $data['data'][0]['game_id'];
		$data_username = $data['data'][0]['user_name'];

		if (!$data_id) {
			TwitchHelper::log(TwitchHelper::LOG_ERROR, "No ID supplied for capture");
			// $this->errors[] = 'ID not supplied for capture';
			return false;
		}

		$stream_url = 'twitch.tv/' . $data_username;

		$basename = $this->basename($data);

		$folder_base = TwitchHelper::vodFolder($data_username);

		$capture_filename = $folder_base . DIRECTORY_SEPARATOR . $basename . '.ts';

		$chat_filename = $folder_base . DIRECTORY_SEPARATOR . $basename . '.chatdump';

		// failure
		$int = 1;
		while (file_exists($capture_filename)) {
			// $this->errors[] = 'File exists while capturing, making a new name';
			TwitchHelper::log(TwitchHelper::LOG_ERROR, "File exists while capturing, making a new name for {$basename}, attempt #{$int}", ['download-capture' => $data_username]);
			$capture_filename = $folder_base . DIRECTORY_SEPARATOR . $basename . '-' . $int . '.ts';
			$int++;
		}

		$cmd = [];

		// use python pipenv or regular executable
		if (TwitchConfig::cfg('pipenv_enabled')) {
			$cmd[] = 'pipenv run streamlink';
		} else {
			$cmd[] = TwitchHelper::path_streamlink();
		}

		// start recording from start of stream, though twitch doesn't support this
		$cmd[] = '--hls-live-restart';

		// How many segments from the end to start live HLS streams on.
		$cmd[] = '--hls-live-edge';
		$cmd[] = '99999';

		// timeout due to ads
		$cmd[] = '--hls-timeout';
		$cmd[] = TwitchConfig::cfg('hls_timeout', 120);

		// timeout due to ads
		$cmd[] = '--hls-segment-timeout';
		$cmd[] = TwitchConfig::cfg('hls_timeout', 120);

		// The size of the thread pool used to download HLS segments.
		$cmd[] = '--hls-segment-threads';
		$cmd[] = '5';

		// disable channel hosting
		$cmd[] = '--twitch-disable-hosting';

		// enable low latency mode, probably not a good idea without testing
		if (TwitchConfig::cfg('low_latency', false)) {
			$cmd[] = '--twitch-low-latency';
		}

		// Skip embedded advertisement segments at the beginning or during a stream
		if (TwitchConfig::cfg('disable_ads', false)) {
			$cmd[] = '--twitch-disable-ads';
		}

		// Retry fetching the list of available streams until streams are found 
		$cmd[] = '--retry-streams';
		$cmd[] = '10';

		// stop retrying the fetch after COUNT retry attempt(s).
		$cmd[] = '--retry-max';
		$cmd[] = '5';

		// logging level
		if (TwitchConfig::cfg('debug', false)) {
			$cmd[] = '--loglevel';
			$cmd[] = 'debug';
		} elseif (TwitchConfig::cfg('app_verbose', false)) {
			$cmd[] = '--loglevel';
			$cmd[] = 'info';
		}

		// output file
		$cmd[] = '-o';
		$cmd[] = $capture_filename;

		// twitch url
		$cmd[] = '--url';
		$cmd[] = $stream_url;

		// twitch quality
		$cmd[] = '--default-stream';
		$cmd[] = implode(",", TwitchConfig::getStreamer($data_username)['quality']); // quality

		// $this->info[] = 'Streamlink cmd: ' . implode(" ", $cmd);

		$this->vod->refreshJSON();
		$this->vod->dt_capture_started = new \DateTime();
		$this->vod->saveJSON('dt_capture_started set');

		TwitchHelper::log(TwitchHelper::LOG_INFO, "Starting capture with filename " . basename($capture_filename), ['download-capture' => $data_username, 'cmd' => implode(' ', $cmd)]);

		// start process in async mode
		$process = new Process($cmd, dirname($capture_filename), null, null, null);
		$process->start();

		// output command line
		TwitchHelper::clearLog("streamlink_" . $basename . "_stdout." . $int);
		TwitchHelper::clearLog("streamlink_" . $basename . "_stderr." . $int);
		TwitchHelper::appendLog("streamlink_" . $basename . "_stdout." . $int, "$ " . implode(" ", $cmd));
		TwitchHelper::appendLog("streamlink_" . $basename . "_stderr." . $int, "$ " . implode(" ", $cmd));

		// save pid to file
		// $pidfile = TwitchHelper::$pids_folder . DIRECTORY_SEPARATOR . 'capture_' . $data_username . '.pid';
		TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Capture " . basename($capture_filename) . " has PID " . $process->getPid(), ['download-capture' => $data_username]);
		// file_put_contents($pidfile, $process->getPid());
		$captureJob = new TwitchAutomatorJob("capture_{$data_username}");
		$captureJob->setPid($process->getPid());
		$captureJob->setProcess($process);
		$captureJob->setMetadata([
			'username' => $data_username,
			'basename' => $basename,
			'capture_filename' => $capture_filename,
			'stream_id' => $data_id
		]);
		$captureJob->save();

		// chat capture
		if (TwitchConfig::cfg('chat_dump')) {

			$chat_cmd = [];

			// test
			// $chat_cmd[] = 'screen';
			// $chat_cmd[] = '-S';
			// $chat_cmd[] = $basename;

			$chat_cmd[] = 'python';
			$chat_cmd[] = __DIR__ . '/Utilities/twitch-chat.py';

			$chat_cmd[] = '--channel';
			$chat_cmd[] = $this->vod->streamer_name;

			$chat_cmd[] = '--userid';
			$chat_cmd[] = $this->vod->streamer_id;

			$chat_cmd[] = '--date';
			$chat_cmd[] = $data_started;

			$chat_cmd[] = '--output';
			$chat_cmd[] = $chat_filename;

			TwitchHelper::log(TwitchHelper::LOG_INFO, "Starting chat dump with filename " . basename($chat_filename), ['download-capture' => $data_username, 'cmd' => implode(' ', $chat_cmd)]);

			// $chat_process = Process::fromShellCommandline( implode(" ", $cmd) );
			$chat_process = new Process($chat_cmd, null, null, null, null);
			$chat_process->setTimeout(null);
			$chat_process->setIdleTimeout(null);

			try {
				$chat_process->setTty(true);
			} catch (\Throwable $th) {
				TwitchHelper::log(TwitchHelper::LOG_ERROR, "TTY not supported", ['download-capture' => $data_username]);
			}

			if ($chat_process->isTty()) {
				TwitchHelper::log(TwitchHelper::LOG_SUCCESS, "TTY enabled", ['download-capture' => $data_username]);
			}

			if ($chat_process->isPtySupported()) {
				$chat_process->setPty(true);
				TwitchHelper::log(TwitchHelper::LOG_SUCCESS, "PTY enabled", ['download-capture' => $data_username]);
			} else {
				TwitchHelper::log(TwitchHelper::LOG_ERROR, "PTY not supported", ['download-capture' => $data_username]);
			}

			$chat_process->start();

			// $chat_pidfile = TwitchHelper::$pids_folder . DIRECTORY_SEPARATOR . 'chatdump_' . $data_username . '.pid';
			// file_put_contents($chat_pidfile, $chat_process->getPid());
			$chatJob = new TwitchAutomatorJob("chatdump_{$data_username}");
			$chatJob->setPid($chat_process->getPid());
			$chatJob->setProcess($chat_process);
			$chatJob->setMetadata([
				'username' => $data_username,
				'basename' => $basename,
				'chat_filename' => $chat_filename
			]);
			$chatJob->save();

			TwitchHelper::clearLog("chatdump_" . $basename . "_stdout." . $int);
			TwitchHelper::clearLog("chatdump_" . $basename . "_stderr." . $int);
			TwitchHelper::appendLog("chatdump_" . $basename . "_stdout." . $int, implode(" ", $chat_cmd));
			TwitchHelper::appendLog("chatdump_" . $basename . "_stderr." . $int, implode(" ", $chat_cmd));
		} else {
			$chat_process = null;
		}

		// $time_start = time();
		// $current_ad_start = null;
		// $vod = $this->vod;

		// wait loop until it's done
		$process->wait(function ($type, $buffer) use ($basename, $int, $data_username, $chat_process) {

			if (Process::ERR === $type) {
				// echo 'ERR > '.$buffer;
			} else {
				// echo 'OUT > '.$buffer;
			}

			if (TwitchConfig::cfg('chat_dump') && isset($chat_process)) {
				if ($chat_process->isRunning()) {
					$chat_process->checkTimeout();
					// if( !$chat_process->getIncrementalOutput() ){
					// 	TwitchHelper::log( TwitchHelper::LOG_DEBUG, "No chat output in chat dump", ['download-capture' => $data_username] );
					// }
				} else {
					TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Chat dump enabled but not running", ['download-capture' => $data_username]);
				}
			}

			// get stream resolution
			preg_match("/stream:\s([0-9_a-z]+)\s/", $buffer, $matches);
			if ($matches) {
				$this->stream_resolution = $matches[1];
				TwitchHelper::log(TwitchHelper::LOG_INFO, "Stream resolution for " . $basename . ": " . $this->stream_resolution, ['download-capture' => $data_username]);
			}

			// stream stop
			if (strpos($buffer, "404 Client Error") !== false) {
				TwitchHelper::log(TwitchHelper::LOG_WARNING, "Chunk 404'd for " . $basename . "!", ['download-capture' => $data_username]);
			}

			// ad removal
			if (strpos($buffer, "Will skip ad segments") !== false) {
				TwitchHelper::log(TwitchHelper::LOG_INFO, "Capturing of " . $basename . " will try to remove ads!", ['download-capture' => $data_username]);
				// $current_ad_start = time();
			}

			if (strpos($buffer, "Filtering out segments and pausing stream output") !== false) {
				TwitchHelper::log(TwitchHelper::LOG_INFO, "Pausing capture for " . $basename . " due to ad segment!", ['download-capture' => $data_username]);
				// $current_ad_start = time();
			}

			if (strpos($buffer, "Resuming stream output") !== false) {
				TwitchHelper::log(TwitchHelper::LOG_INFO, "Resuming capture for " . $basename . " due to ad segment!", ['download-capture' => $data_username]);
				/*
				if( isset($current_ad_start) ){
					$vod->addAdvertisement([
						'start' => $current_ad_start,
						'end' => $current_ad_start - time()
					]);
				}
				*/
			}

			// log output
			if (Process::ERR === $type) {
				TwitchHelper::appendLog("streamlink_" . $basename . "_stderr." . $int, $buffer);
			} else {
				TwitchHelper::appendLog("streamlink_" . $basename . "_stdout." . $int, $buffer);
			}
		});

		/*
		while (true) {

			// check if capture is running, and quit if it isn't
			if (!$process->isRunning()) {
				TwitchHelper::log(TwitchHelper::LOG_INFO, "Streamlink exited, breaking loop", ['download-capture' => $data_username]);
				break;
			}

			// check timeout of capture
			try {
				$process->checkTimeout();
			} catch (\Throwable $th) {
				TwitchHelper::log(TwitchHelper::LOG_ERROR, "Process timeout: " . $th->getMessage(), ['download-capture' => $data_username]);
			}

			$process->addOutput("pad (" . date("Y-m-d H:i:s") . ")");

			// check timeout of chat dump
			if (TwitchConfig::cfg('chat_dump') && isset($chat_process)) {

				try {
					$chat_process->checkTimeout();
				} catch (\Throwable $th) {
					TwitchHelper::log(TwitchHelper::LOG_ERROR, "Process timeout: " . $th->getMessage(), ['download-capture' => $data_username]);
				}

				$chat_process->addOutput("pad (" . date("Y-m-d H:i:s") . ")");

				$cmd_chatdump_stdout_buffer = $chat_process->getIncrementalOutput();
				$cmd_chatdump_stderr_buffer = $chat_process->getIncrementalErrorOutput();
				if ($cmd_chatdump_stdout_buffer) TwitchHelper::appendLog("chatdump_" . $basename . "_stdout." . $int, $cmd_chatdump_stdout_buffer);
				if ($cmd_chatdump_stdout_buffer) TwitchHelper::appendLog("chatdump_" . $basename . "_stderr." . $int, $cmd_chatdump_stderr_buffer);
			}

			$cmd_stdout_buffer = $process->getIncrementalOutput();
			$cmd_stderr_buffer = $process->getIncrementalErrorOutput();
			if ($cmd_stdout_buffer) TwitchHelper::appendLog("streamlink_" . $basename . "_stdout." . $int, $cmd_stdout_buffer);
			if ($cmd_stdout_buffer) TwitchHelper::appendLog("streamlink_" . $basename . "_stderr." . $int, $cmd_stderr_buffer);

			sleep(10);
		}
		*/

		TwitchHelper::log(TwitchHelper::LOG_INFO, "Finished capture with filename " . basename($capture_filename), ['download-capture' => $data_username]);

		if (TwitchConfig::cfg('chat_dump')) {
			// gracefully kill chat dump
			TwitchHelper::log(TwitchHelper::LOG_INFO, "Ending chat dump with filename " . basename($chat_filename), ['download-capture' => $data_username]);

			// $chat_process->setTimeout(90);

			/*
			$chat_process->signal( defined('SIGTERM') ? SIGTERM : 15 ); // SIGTERM

			
			sleep(10);
			if( $chat_process->isRunning() ){
				$chat_process->stop(0);
			}
			*/

			$chat_process->stop(60);

			/*
			try {
				$chat_process->wait();
			} catch (\Throwable $th) {
				TwitchHelper::log( TwitchHelper::LOG_ERROR, "Chat dump SIGTERM wait error: " . $th->getMessage(), ['download-capture' => $data_username] );
			}
			*/

			// if (file_exists($chat_pidfile)) unlink($chat_pidfile);
			if($chatJob){
				$chatJob->clear();
			}
			// TwitchHelper::appendLog("chatdump_" . $basename . "_stdout." . $int, $chat_process->getOutput() );
			// TwitchHelper::appendLog("chatdump_" . $basename . "_stderr." . $int, $chat_process->getErrorOutput() );
			TwitchHelper::log(TwitchHelper::LOG_INFO, "Ended chat dump with filename " . basename($chat_filename), ['download-capture' => $data_username]);
		}

		// download with youtube-dl if streamlink fails, shouldn't be required anymore
		if (mb_strpos($process->getOutput(), '410 Client Error') !== false) {

			TwitchHelper::log(TwitchHelper::LOG_ERROR, "410 error for {$basename}");

			$yt_cmd = [];

			if (TwitchConfig::cfg('pipenv_enabled')) {
				$yt_cmd[] = 'pipenv';
				$yt_cmd[] = 'run';
				$yt_cmd[] = 'youtube-dl';
			} else {
				$yt_cmd[] = TwitchHelper::path_youtubedl();
			}

			// use ts instead of mp4
			$yt_cmd[] = '--hls-use-mpegts';

			$yt_cmd[] = '--no-part';

			// output file
			$yt_cmd[] = '-o';
			$yt_cmd[] = $capture_filename;

			// format, does this work?
			$yt_cmd[] = '-f';
			$yt_cmd[] = implode('/', TwitchConfig::getStreamer($data_username)['quality']);

			// verbose
			if (TwitchConfig::cfg('debug', false) || TwitchConfig::cfg('app_verbose', false)) {
				$yt_cmd[] = '-v';
			}

			// stream url
			$yt_cmd[] = $stream_url;

			$yt_process = new Process($yt_cmd, null, null, null, null);
			$yt_process->run();

			TwitchHelper::appendLog("youtubedl_" . $basename . "_" . time() . "_stdout", "$ " . implode(" ", $yt_cmd) . "\n" . $yt_process->getOutput());
			TwitchHelper::appendLog("youtubedl_" . $basename . "_" . time() . "_stderr", "$ " . implode(" ", $yt_cmd) . "\n" . $yt_process->getErrorOutput());
		}

		if (mb_strpos($process->getOutput(), 'already exists, use') !== false) {
			TwitchHelper::log(TwitchHelper::LOG_FATAL, "Unexplainable, " . basename($capture_filename) . " could not be captured due to existing file already.", ['download-capture' => $data_username]);
		}

		// get stream resolution
		preg_match("/stream:\s([0-9_a-z]+)\s/", $process->getOutput(), $matches);
		if ($matches) {
			$this->stream_resolution = $matches[1];
		}

		// delete pid file
		// if (file_exists($pidfile)) unlink($pidfile);
		if($captureJob) $captureJob->clear();

		if (!file_exists($capture_filename)) {
			TwitchHelper::log(TwitchHelper::LOG_ERROR, "File " . basename($capture_filename) . " never got created.", ['download-capture' => $data_username]);
			return false;
		}

		if (filesize($capture_filename) == 0) {
			TwitchHelper::log(TwitchHelper::LOG_ERROR, "File " . basename($capture_filename) . " never got any data.", ['download-capture' => $data_username]);
			return false;
		}

		return $capture_filename;
	}

	public function playlistDump($data)
	{

		$data_id = $data['data'][0]['id'];
		$data_title = $data['data'][0]['title'];
		$data_started = $data['data'][0]['started_at'];
		$data_game_id = $data['data'][0]['game_id'];
		$data_username = $data['data'][0]['user_name'];

		$userid = TwitchHelper::getChannelId($data_username);

		$videos = TwitchHelper::getVideos($userid);

		if (!$videos) {
			throw new \Exception("No videos");
		}

		TwitchHelper::log(TwitchHelper::LOG_INFO, "Start playlist download for {$data_username}");

		$video = $videos[0];

		if (isset($video['thumbnail_url']) && $video['thumbnail_url'] != '') {
			TwitchHelper::log(TwitchHelper::LOG_ERROR, "Newest vod is finalized");
			return false;
			//throw new \Exception("Newest vod is finalized");
		}

		$video_id = $video['id'];

		$unique_id = $data_username . '-' . $video_id;

		$quality = isset($_GET['quality']) ? $_GET['quality'] : 'best';
		$new_chunks_timeout = 300;
		$amount_of_tries = 3;

		$concat_filename = $video_id . '.ts';

		// fetch stream m3u8 urls with streamlink
		$stream_urls_raw = TwitchHelper::exec([TwitchHelper::path_streamlink(), '--json', '--url', $video['url'], '--default-stream', $quality, '--stream-url']);
		$stream_urls = json_decode($stream_urls_raw, true);

		$download_path = TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . 'playlist' . DIRECTORY_SEPARATOR . $unique_id;

		$run_file = $download_path . DIRECTORY_SEPARATOR . 'running';

		/*
		if (isset($_GET['force'])) {
			if (file_exists($run_file)) unlink($run_file);
		}
		*/

		if (file_exists($run_file)) {
			TwitchHelper::log(TwitchHelper::LOG_ERROR, "Job is already running for this user, probably.");
			return false;
			// throw new \Exception("Job is already running for this user, probably. Use ?force=1 to force.");
		}

		// last added chunk
		$last_chunk_appended_file = $download_path . DIRECTORY_SEPARATOR . 'lastchunk';
		$last_chunk_appended = -1;
		if (file_exists($last_chunk_appended_file)) {
			$last_chunk_appended = file_get_contents($last_chunk_appended_file);
		}

		if (!file_exists($download_path)) {
			if (!mkdir($download_path)) {
				TwitchHelper::log(TwitchHelper::LOG_ERROR, "Could not make download dir for {$unique_id}");
				return false;
				// throw new \Exception("Could not make download dir for {$unique_id}");
			}
		}

		TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Download path: {$download_path}");

		if (!$stream_urls || !$stream_urls['streams'][$quality]) {
			TwitchHelper::log(TwitchHelper::LOG_ERROR, "No stream urls with quality {$quality} for {$unique_id}");
			return false;
			// throw new \Exception("No stream urls with quality {$quality} for {$unique_id}");
		}

		$stream_playlist_url = $stream_urls['streams'][$quality]['url'];

		TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Playlist URL: {$stream_playlist_url}");

		// save streams to file
		file_put_contents($download_path . DIRECTORY_SEPARATOR . 'stream_urls.json', json_encode($stream_urls['streams']));

		// save progress
		file_put_contents($run_file, 1);

		$basepath = dirname($stream_playlist_url);

		$num_new_chunks = 0;

		$last_deleted_chunk = -1;

		$first_run = true;

		$tries = 0;

		do {

			$num_new_chunks = 0;

			// download playlist every loop
			$playlist = file_get_contents($stream_playlist_url);

			file_put_contents($download_path . DIRECTORY_SEPARATOR . 'playlist.m3u8', $playlist);

			// extract all chunks
			$playlist_lines = explode("\n", $playlist);
			$chunks = [];
			// $chunks_obj = [];
			foreach ($playlist_lines as $i => $line) {

				/*
                if(substr($line, 0, 1) == '#'){
                    $kv = explode( ":", substr($line, 1) );
                    if($kv[0] ==)
                    continue;
                }
                */

				if (substr($line, -3) == '.ts') {
					// $chunks[] = $line;

					$chunk_obj = new Chunk();
					$chunk_obj->chunk_num = substr($line, 0, -3);
					$chunk_obj->filename = $line;
					$chunk_obj->full_path = $download_path . DIRECTORY_SEPARATOR . $chunk_obj->filename;
					$chunk_obj->full_url = $basepath . '/' . $chunk_obj->filename;
					$chunk_obj->duration = substr(substr($playlist_lines[$i - 1], 8), 0, -1);

					$chunks[] = $chunk_obj;
				}
			}

			file_put_contents($download_path . DIRECTORY_SEPARATOR . 'chunks.json', json_encode($chunks));

			TwitchHelper::log(TwitchHelper::LOG_DEBUG, count($chunks) . " chunks read for {$unique_id}");

			$new_chunks = [];

			// download chunks
			foreach ($chunks as $chunk) {

				/** @var Chunk $chunk */

				// $full_url = $basepath . '/' . $chunk;
				// $chunk_path = $download_path . DIRECTORY_SEPARATOR . $chunk;
				// $chunk_num = (int)str_replace(".ts", "", $chunk);

				// if (file_exists($chunk_path) || $chunk_num < $last_chunk_appended) { // hm
				if (file_exists($chunk->full_path) || $chunk->chunk_num <= $last_chunk_appended) { // hm
					continue;
				}

				$last_chunk_num = $chunk->chunk_num;

				TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Download chunk {$chunk->filename} for {$unique_id}");
				$chunk_data = file_get_contents($chunk->full_url);
				if (strlen($chunk_data) == 0) {
					TwitchHelper::log(TwitchHelper::LOG_ERROR, "Empty chunk {$chunk->filename} for {$unique_id}");
					break;
				}
				file_put_contents($chunk->full_path, $chunk_data);
				$num_new_chunks++;
				$new_chunks[] = $chunk;
				$chunk_data = null;
			}

			// $last_chunk_num = (int)str_replace(".ts", "", $chunks[count($chunks) - 1]);

			// exit out if no new files, test
			TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Compare for first run: {$last_chunk_num} == {$last_chunk_appended}");
			if ($last_chunk_num == $last_chunk_appended) {
				if ($first_run) {
					TwitchHelper::log(TwitchHelper::LOG_WARNING, "No new chunks found for {$unique_id}");
					return false;
					// throw new \Exception("First run, no new chunks for {$unique_id}");
				}
			}

			// concat into massive file
			if ($num_new_chunks > 0) {

				TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Concat new chunks for {$unique_id} ({$num_new_chunks})");

				$concat_file = $download_path . DIRECTORY_SEPARATOR . $concat_filename;

				// build concat list
				$chunks_to_append = [];
				$concat_list = '';
				foreach ($chunks as $chunk) {
					/** @var Chunk $chunk */
					// $chunk_path = $download_path . DIRECTORY_SEPARATOR . $chunk;
					// $chunk_num = (int)str_replace(".ts", "", $chunk);
					if ($chunk->chunk_num > $last_chunk_appended) { // duplicate last err
						if (!file_exists($chunk->full_path)) {
							TwitchHelper::log(TwitchHelper::LOG_ERROR, "Chunk {$chunk} does not exist for {$unique_id}");
							return false;
							// throw new \Exception("Chunk {$chunk} does not exist for {$unique_id}");
						}
						$chunks_to_append[] = $chunk;
						// $concat_list .= "file '" . realpath($chunk_path) . "'\n"; // unsafe
						$concat_list .= "file '" . $chunk->filename . "'\n";
						// TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Append chunk {$chunk->filename} to all.ts for {$unique_id}");
					}
				}

				TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Append " . count($chunks_to_append) . " chunks to {$concat_filename} for {$unique_id}");

				// prepend all.ts
				if (file_exists($concat_file)) {
					TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Include all.ts (not first run) for {$unique_id}");
					$concat_list = "file 'all.ts'\n" . $concat_list;
				}

				$concat_list_file = $download_path . DIRECTORY_SEPARATOR . 'list.txt';
				file_put_contents($concat_list_file, $concat_list);

				/*
                $cmd = [
                    TwitchHelper::path_ffmpeg(),

                    // concat format
                    '-f',
                    'concat',

                    '-safe',
                    '0',

                    // input concat file
                    '-i',
                    realpath($concat_list_file),

                    // force overwrite
                    '-y',

                    // copy coded
                    '-codec',
                    'copy',

                    $concat_file
                ];

                // run concat
                $process = new Process($cmd, $download_path, null, null, null);
                $process->run();

                TwitchHelper::appendLog("ffmpeg_concat_" . $video['id'] . "_stdout", "$ " . implode(" ", $cmd) . "\n" . $process->getOutput());
                TwitchHelper::appendLog("ffmpeg_concat_" . $video['id'] . "_stderr", "$ " . implode(" ", $cmd) . "\n" . $process->getErrorOutput());
                */

				// write every ts file to the big one, flush after every write to keep memory down
				$handle = fopen($concat_file, 'a');
				foreach ($chunks_to_append as $chunk) {
					/** @var Chunk $chunk */
					// $chunk_path = $download_path . DIRECTORY_SEPARATOR . $chunk;
					$chunk_data = file_get_contents($chunk->full_path);
					fwrite($handle, $chunk_data);
					fflush($handle);
					$chunk_data = null;
				}
				fclose($handle);

				if (!file_exists($concat_file) || filesize($concat_file) == 0) {
					TwitchHelper::log(TwitchHelper::LOG_ERROR, "File could not be concat for {$unique_id}");
					return false;
					// throw new \Exception("File could not be concat for {$unique_id}");
				}

				// remove old chunks
				$removed_chunks = 0;
				foreach ($chunks as $chunk) {
					/** @var Chunk $chunk */
					// $chunk_path = $download_path . DIRECTORY_SEPARATOR . $chunk;
					// $chunk_num = (int)str_replace(".ts", "", $chunk);
					if ($chunk->chunk_num >= $last_deleted_chunk && $chunk->chunk_num <= $last_chunk_num && file_exists($chunk->full_path)) {
						unlink($chunk->full_path);
						// TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Remove chunk {$chunk->filename} for {$unique_id}");
						$last_deleted_chunk = $chunk->chunk_num;
						$removed_chunks++;
					}
				}

				TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Removed {$removed_chunks} chunks for {$unique_id}");

				// save last chunk name to file
				$last_chunk_appended = $last_chunk_num;
				file_put_contents($last_chunk_appended_file, $last_chunk_appended);
				// unlink($concat_list_file);
			}

			TwitchHelper::log(TwitchHelper::LOG_DEBUG, "{$num_new_chunks} new chunks downloaded, sleep for {$new_chunks_timeout} seconds for {$unique_id}");

			if ($num_new_chunks == 0) {
				TwitchHelper::log(TwitchHelper::LOG_DEBUG, "No new chunks downloaded, try #{$num_new_chunks}");
				$tries++;
			}

			sleep($new_chunks_timeout);

			$first_run = false;
		} while ($num_new_chunks > 0 && $tries < $amount_of_tries);

		TwitchHelper::log(TwitchHelper::LOG_INFO, "No more playlist chunks to download for {$unique_id}");

		if (file_exists($run_file)) unlink($run_file);

		return isset($concat_file) ? $concat_file : false;
	}

	/**
	 * Mux .ts to .mp4, for better compatibility
	 *
	 * @param string $basename Basename of input file
	 * @return string Converted filename
	 */
	public function convert($basename)
	{

		$container_ext = TwitchConfig::cfg('vod_container', 'mp4');

		$folder_base = TwitchHelper::vodFolder($this->vod->streamer_name);

		$capture_filename 	= $folder_base . DIRECTORY_SEPARATOR . $basename . '.ts';

		$converted_filename = $folder_base . DIRECTORY_SEPARATOR . $basename . '.' . $container_ext;

		$data_username = $this->vod->streamer_name;

		$int = 1;

		while (file_exists($converted_filename)) {
			// $this->errors[] = 'File exists while converting, making a new name';
			TwitchHelper::log(TwitchHelper::LOG_ERROR, "File exists while converting, making a new name for {$basename}, attempt #{$int}", ['download-convert' => $data_username]);
			$converted_filename = $folder_base . DIRECTORY_SEPARATOR . $basename . '-' . $int . '.' . $container_ext;
			$int++;
		}

		$cmd = [];

		$cmd[] = TwitchHelper::path_ffmpeg();

		$cmd[] = '-i';
		$cmd[] = $capture_filename; // input filename

		// https://github.com/stoyanovgeorge/ffmpeg/wiki/How-to-Find-and-Fix-Corruptions-in-FFMPEG
		if (TwitchConfig::cfg('fix_corruption')) {

			// @todo: these error out
			// $cmd[] = '-map';
			// $cmd[] = '0';
			// $cmd[] = '-ignore_unknown';
			// $cmd[] = '-copy_unknown';

			// @todo: test these
			// $cmd[] = '-fflags';
			// $cmd[] = '+genpts+igndts';

			$cmd[] = '-use_wallclock_as_timestamps';
			$cmd[] = '1';

			// @todo: needs encoding
			// $cmd[] = '-filter:a';
			// $cmd[] = 'async=1';

		}

		// use same video codec
		$cmd[] = '-c:v';
		$cmd[] = 'copy';

		if (TwitchConfig::cfg('encode_audio')) {
			// re-encode audio
			$cmd[] = '-c:a';
			$cmd[] = 'aac';

			// use same audio bitrate
			$cmd[] = '-b:a';
			$cmd[] = '160k';
		} else {
			// use same audio codec
			$cmd[] = '-c:a';
			$cmd[] = 'copy';
		}

		// fix audio sync in ts
		$cmd[] = '-bsf:a';
		$cmd[] = 'aac_adtstoasc';

		if (TwitchConfig::cfg('ts_sync')) {

			$cmd[] = '-async';
			$cmd[] = '1';

			// $cmd[] = '-use_wallclock_as_timestamps';
			// $cmd[] = '1';

			// $cmd[] = '-filter_complex';
			// $cmd[] = 'aresample';

			// $cmd[] = '-af';
			// $cmd[] = 'aresample=async=1:first_pts=0';
			// $cmd[] = 'aresample=async=1';

			// $cmd[] = '-fflags';
			// $cmd[] = '+genpts';
			// $cmd[] = '+igndts';

		}

		// logging level
		if (TwitchConfig::cfg('debug', false) || TwitchConfig::cfg('app_verbose', false)) {
			$cmd[] = '-loglevel';
			$cmd[] = 'repeat+level+verbose';
		}

		$cmd[] = $converted_filename; // output filename

		$this->vod->refreshJSON();
		$this->vod->dt_conversion_started = new \DateTime();
		$this->vod->saveJSON('dt_conversion_started set');

		TwitchHelper::log(TwitchHelper::LOG_INFO, "Starting conversion of " . basename($capture_filename) . " to " . basename($converted_filename), ['download-convert' => $data_username]);

		$process = new Process($cmd, dirname($capture_filename), null, null, null);
		$process->start();

		// create pidfile
		$convertJob = new TwitchAutomatorJob("convert_{$data_username}");
		$convertJob->setPid($process->getPid());
		$convertJob->setProcess($process);
		$convertJob->setMetadata([
			'capture_filename' => $capture_filename,
			'converted_filename' => $converted_filename,
		]);
		$convertJob->save();
		//$pidfile = TwitchHelper::$pids_folder . DIRECTORY_SEPARATOR . 'convert_' . $data_username . '.pid';
		//file_put_contents($pidfile, $process->getPid());

		// wait until process is done
		$process->wait();

		// remove pidfile
		$convertJob->clear();
		//if (file_exists($pidfile)) unlink($pidfile);

		TwitchHelper::appendLog("ffmpeg_convert_" . $basename . "_" . time() . "_stdout", "$ " . implode(" ", $cmd) . "\n" . $process->getOutput());
		TwitchHelper::appendLog("ffmpeg_convert_" . $basename . "_" . time() . "_stderr", "$ " . implode(" ", $cmd) . "\n" . $process->getErrorOutput());

		if (strpos($process->getErrorOutput(), "Packet corrupt") !== false || strpos($process->getErrorOutput(), "Non-monotonous DTS in output stream") !== false) {
			TwitchHelper::log(TwitchHelper::LOG_ERROR, "Found corrupt packets when converting " . basename($capture_filename) . " to " . basename($converted_filename), ['download-convert' => $data_username]);
		}

		if (file_exists($converted_filename) && filesize($converted_filename) > 0) {
			TwitchHelper::log(TwitchHelper::LOG_SUCCESS, "Finished conversion of " . basename($capture_filename) . " to " . basename($converted_filename), ['download-convert' => $data_username]);
		} else {
			TwitchHelper::log(TwitchHelper::LOG_ERROR, "Failed conversion of " . basename($capture_filename) . " to " . basename($converted_filename), ['download-convert' => $data_username]);
			return false;
		}

		return $converted_filename;
	}
}
