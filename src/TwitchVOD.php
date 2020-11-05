<?php

declare(strict_types=1);

namespace App;

use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\Process;

class TwitchVOD
{

	public $vod_path = 'vods';

	public $filename 	= '';
	public $basename 	= '';
	public $directory 	= null;
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
	public $stream_title = null;

	public $total_size = null;

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

	/** @deprecated 3.2.0 use $is_capturing instead */
	public $is_recording = false;
	public $is_converted = false;
	public $is_capturing = false;
	public $is_converting = false;
	public $is_finalized = false;

	public $video_fail2 = false;
	public $video_metadata = [];

	public $is_chat_downloaded = false;
	public $is_vod_downloaded = false;
	public $is_chat_rendered = false;
	public $is_chat_burned = false;
	public $is_lossless_cut_generated = false;
	public $is_chatdump_captured = false;

	public $dt_ended_at = null;
	public $dt_capture_started = null;
	public $dt_conversion_started = null;

	public $json_hash = null;

	/** Recently created? */
	public $created = false;
	/** Manually started? */
	public $force_record = false;

	public $path_chat = null;
	public $path_downloaded_vod = null;
	public $path_losslesscut = null;
	public $path_chatrender = null;
	public $path_chatburn = null;
	public $path_chatdump = null;

	private $pid_cache = [];

	/**
	 * Load a VOD with a JSON file
	 *
	 * @param string $filename
	 * @return bool
	 */
	public function load(string $filename)
	{

		TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Loading VOD Class for {$filename}");

		if (!file_exists($filename)) {
			TwitchHelper::log(TwitchHelper::LOG_FATAL, "VOD Class for {$filename} not found");
			throw new \Exception('VOD not found');
			return false;
		}

		$data = file_get_contents($filename);

		if (!$data || strlen($data) == 0 || filesize($filename) == 0) {
			TwitchHelper::log(TwitchHelper::LOG_FATAL, "Tried to load {$filename} but no data was returned");
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

		if (isset($this->json['started_at']) && isset($this->json['started_at']['date'])) {
			$this->started_at = new \DateTime($this->json['started_at']['date']);
		} else {
			// $this->started_at = \DateTime::createFromFormat("Y-m-d\TH:i:s\Z", $this->json['started_at']);
		}

		if (isset($this->json['ended_at']) && isset($this->json['ended_at']['date'])) {
			$this->ended_at = new \DateTime($this->json['ended_at']['date']);
		} else {
			// $this->ended_at = \DateTime::createFromFormat("Y-m-d\TH:i:s\Z", $this->json['ended_at']);
		}

		if (isset($this->json['saved_at']) && isset($this->json['saved_at']['date'])) {
			$this->saved_at = new \DateTime($this->json['saved_at']['date']);
		}

		$this->filename = $filename;
		$this->basename = basename($filename, '.json');
		$this->directory = dirname($filename);

		$this->is_recording = file_exists($this->directory . DIRECTORY_SEPARATOR . $this->basename . '.ts');
		$this->is_converted = file_exists($this->directory . DIRECTORY_SEPARATOR . $this->basename . '.mp4');

		$this->is_capturing 	= isset($this->json['is_capturing']) ? $this->json['is_capturing'] : false;
		$this->is_converting 	= isset($this->json['is_converting']) ? $this->json['is_converting'] : false;
		$this->is_finalized 	= isset($this->json['is_finalized']) ? $this->json['is_finalized'] : false;

		$this->streamer_name 	= $this->json['meta']['data'][0]['user_name'];
		$this->streamer_id 		= TwitchHelper::getChannelId($this->streamer_name);

		$this->twitch_vod_id 			= isset($this->json['twitch_vod_id']) ? $this->json['twitch_vod_id'] : null;
		$this->twitch_vod_url 			= isset($this->json['twitch_vod_url']) ? $this->json['twitch_vod_url'] : null;
		$this->twitch_vod_duration 		= isset($this->json['twitch_vod_duration']) ? $this->json['twitch_vod_duration'] : null;
		$this->twitch_vod_title 		= isset($this->json['twitch_vod_title']) ? $this->json['twitch_vod_title'] : null;
		$this->twitch_vod_date 			= isset($this->json['twitch_vod_date']) ? $this->json['twitch_vod_date'] : null;
		$this->twitch_vod_exists 		= isset($this->json['twitch_vod_exists']) ? $this->json['twitch_vod_exists'] : null;
		$this->twitch_vod_neversaved 	= isset($this->json['twitch_vod_neversaved']) ? $this->json['twitch_vod_neversaved'] : null;
		$this->twitch_vod_attempted 	= isset($this->json['twitch_vod_attempted']) ? $this->json['twitch_vod_attempted'] : null;
		$this->twitch_vod_muted 		= isset($this->json['twitch_vod_muted']) ? $this->json['twitch_vod_muted'] : null;

		$this->force_record				= isset($this->json['force_record']) ? $this->json['force_record'] : false;

		$this->stream_resolution		= isset($this->json['stream_resolution']) ? $this->json['stream_resolution'] : null;

		$this->meta = $this->json['meta'];

		if (isset($this->json['dt_capture_started'])) {
			$this->dt_capture_started 		= new \DateTime($this->json['dt_capture_started']['date']);
		}

		if (isset($this->json['dt_conversion_started'])) {
			$this->dt_conversion_started 	= new \DateTime($this->json['dt_conversion_started']['date']);
		}

		if (isset($this->json['dt_ended'])) {
			$this->dt_ended_at = new \DateTime($this->json['dt_ended']['date']);
		}

		if ($this->meta && $this->meta['data'][0]['title']) {
			$this->stream_title = $this->meta['data'][0]['title'];
		}

		// $this->duration 			= $this->json['duration'];
		$this->duration_seconds 	= $this->json['duration_seconds'] ?: null;
		$this->duration_live		= $this->getDurationLive();

		$this->video_fail2 			= isset($this->json['video_fail2']) ? $this->json['video_fail2'] : false;
		$this->video_metadata		= isset($this->json['video_metadata']) ? $this->json['video_metadata'] : null;

		if (isset($this->json['chapters']) && count($this->json['chapters']) > 0) {
			$this->parseChapters($this->json['chapters']);
		} else {
			TwitchHelper::log(TwitchHelper::LOG_ERROR, "No chapters on {$this->basename}!");
		}

		if ($this->is_finalized) {
			$this->segments_raw = $this->json['segments_raw'];
			$this->parseSegments($this->segments_raw);
			if (!$this->duration_seconds) {
				TwitchHelper::log(TwitchHelper::LOG_DEBUG, "VOD {$this->basename} finalized but no duration, trying to fix");
				$this->getDuration(true);
			}
		}

		if (!$this->video_metadata && $this->is_finalized && count($this->segments_raw) > 0 && !$this->video_fail2 && TwitchHelper::path_mediainfo()) {
			TwitchHelper::log(TwitchHelper::LOG_DEBUG, "VOD {$this->basename} finalized but no metadata, trying to fix");
			$this->getMediainfo();
			$this->saveJSON('fix mediainfo');
		}

		$this->path_chat 				= $this->directory . DIRECTORY_SEPARATOR . $this->basename . '.chat';
		$this->path_downloaded_vod 		= $this->directory . DIRECTORY_SEPARATOR . $this->basename . '_vod.mp4';
		$this->path_losslesscut 		= $this->directory . DIRECTORY_SEPARATOR . $this->basename . '-llc-edl.csv';
		$this->path_chatrender			= $this->directory . DIRECTORY_SEPARATOR . $this->basename . '_chat.mp4';
		$this->path_chatburn			= $this->directory . DIRECTORY_SEPARATOR . $this->basename . '_burned.mp4';
		$this->path_chatdump			= $this->directory . DIRECTORY_SEPARATOR . $this->basename . '.chatdump';

		$this->is_chat_downloaded 			= file_exists($this->path_chat);
		$this->is_vod_downloaded 			= file_exists($this->path_downloaded_vod);
		$this->is_lossless_cut_generated 	= file_exists($this->path_losslesscut);
		$this->is_chatdump_captured 		= file_exists($this->path_chatdump);

		$this->is_chat_rendered 	= file_exists($this->path_chatrender);
		$this->is_chat_burned 		= file_exists($this->path_chatburn);

		return true;
	}

	/**
	 * Create new VOD and mark it as created, enabling safeguards.
	 *
	 * @param string $filename
	 * @return bool
	 */
	public function create(string $filename)
	{
		TwitchHelper::log(TwitchHelper::LOG_INFO, "Create VOD JSON: " . basename($filename));
		$this->created = true;
		$this->filename = $filename;
		$this->basename = basename($filename, '.json');
		$this->saveJSON('create json');
		return true;
	}

	/**
	 * Reload JSON to make sure you don't overwrite anything.
	 *
	 * @return bool
	 */
	public function refreshJSON()
	{
		if (!$this->filename) {
			TwitchHelper::log(TwitchHelper::LOG_ERROR, "Can't refresh vod, not found!");
			return false;
		}
		TwitchHelper::log(TwitchHelper::LOG_INFO, "Refreshing JSON on {$this->basename}!");
		$this->load($this->filename);
	}

	/**
	 * Get duration of the mp4 file.
	 *
	 * @param boolean $save Save the duration to the JSON file
	 * @return string Duration in seconds
	 */
	public function getDuration($save = false)
	{

		if (isset($this->duration_seconds) && $this->duration_seconds !== null) {
			// TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Returning saved duration for " . $this->basename . ": " . $this->duration_seconds );
			return $this->duration_seconds;
		}

		if ($this->video_metadata) {
			if (isset($this->video_metadata['general']['Duration'])) {
				TwitchHelper::log(TwitchHelper::LOG_DEBUG, "No duration_seconds but metadata exists for {$this->basename}: " . $this->video_metadata['general']['Duration']);
				$this->duration_seconds = $this->video_metadata['general']['Duration'];
				return $this->video_metadata['general']['Duration'];
			}
			TwitchHelper::log(TwitchHelper::LOG_ERROR, "Video metadata for {$this->basename} does not include duration!");
			return null;
		}

		if ($this->is_capturing || $this->is_recording) {
			TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Can't request duration because {$this->basename} is still recording!");
			return null;
		}

		if (!$this->is_converted || $this->is_converting) {
			TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Can't request duration because {$this->basename} is converting!");
			return null;
		}

		if (!$this->is_finalized) {
			TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Can't request duration because {$this->basename} is not finalized!");
			return null;
		}

		if (!isset($this->segments_raw) || count($this->segments_raw) == 0) {
			TwitchHelper::log(TwitchHelper::LOG_ERROR, "No video file available for duration of {$this->basename}");
			return null;
		}

		TwitchHelper::log(TwitchHelper::LOG_DEBUG, "No mediainfo for getDuration of {$this->basename}");
		$file = $this->getMediainfo();

		if (!$file) {
			TwitchHelper::log(TwitchHelper::LOG_ERROR, "Could not find duration of {$this->basename}");
			return null;
		} else {

			// $this->duration 			= $file['playtime_string'];
			$this->duration_seconds 	= $file['general']['Duration'];

			if ($save) {
				TwitchHelper::log(TwitchHelper::LOG_SUCCESS, "Saved duration for {$this->basename}");
				$this->saveJSON('duration save');
			}

			TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Duration fetched for {$this->basename}: {$this->duration_seconds}");

			return $this->duration_seconds;
		}

		TwitchHelper::log(TwitchHelper::LOG_ERROR, "Reached end of getDuration for {$this->basename}, this shouldn't happen!");
	}

	/**
	 * Run MediaInfo on the selected segment
	 *
	 * @param integer $segment_num
	 * @return array|boolean
	 */
	public function getMediainfo($segment_num = 0)
	{

		TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Fetching mediainfo of {$this->basename}");

		if (!isset($this->segments_raw) || count($this->segments_raw) == 0) {
			TwitchHelper::log(TwitchHelper::LOG_ERROR, "No segments available for mediainfo of {$this->basename}");
			return false;
		}

		$filename = $this->directory . DIRECTORY_SEPARATOR . basename($this->segments_raw[$segment_num]);

		$data = TwitchHelper::mediainfo($filename);
		if ($data) {
			$this->video_metadata = $data;
			return $this->video_metadata;
		}

		$this->video_fail2 = true;
		return false;
	}

	/**
	 * Get the current recording duration
	 *
	 * @return int
	 */
	public function getDurationLive()
	{
		if (!$this->started_at) return false;
		$now = new \DateTime();
		return abs($this->started_at->getTimestamp() - $now->getTimestamp());
		// $diff = $this->started_at->diff( new \DateTime() );
		// $diff->format("%s");
		//return $diff->format('%H:%I:%S');
	}

	/**
	 * Get the start offset with the twitch vod, for syncing chat etc
	 *
	 * @return int|bool
	 */
	public function getStartOffset()
	{
		if (!$this->twitch_vod_id) return false;
		return $this->twitch_vod_duration - $this->getDuration();
	}

	/**
	 * Download chat with tcd
	 * @return bool success
	 */
	public function downloadChat()
	{

		if (!file_exists(TwitchHelper::path_tcd())) {
			throw new \Exception('tcd not found');
			return false;
		}

		if (!$this->twitch_vod_id) {
			throw new \Exception('no twitch vod id');
			return false;
		}

		// $chat_filename = $this->directory . DIRECTORY_SEPARATOR . $this->basename . '.chat';

		$compressed_filename = $this->directory . DIRECTORY_SEPARATOR . $this->basename . '.chat.gz';

		$tcd_filename = $this->directory . DIRECTORY_SEPARATOR . $this->twitch_vod_id . '.json';

		if (file_exists($this->path_chat)) {
			return true;
		}

		TwitchHelper::log(TwitchHelper::LOG_INFO, "Download chat for {$this->basename}");

		if (TwitchConfig::cfg('chat_compress', false)) {

			if (file_exists($compressed_filename)) {
				TwitchHelper::log(TwitchHelper::LOG_ERROR, "Chat compressed already exists for {$this->basename}");
				return;
			}

			if (file_exists($this->path_chat)) {
				TwitchHelper::log(TwitchHelper::LOG_WARNING, "Chat already exists for {$this->basename}");
				shell_exec("gzip " . $this->path_chat);
				return;
			}
		} else {

			if (file_exists($this->path_chat)) {
				TwitchHelper::log(TwitchHelper::LOG_ERROR, "Chat already exists for {$this->basename}");
				return;
			}
		}

		// if tcd generated file exists, rename it
		if (file_exists($tcd_filename)) {
			TwitchHelper::log(TwitchHelper::LOG_WARNING, "Renamed chat file for {$this->basename}");
			rename($tcd_filename, $this->path_chat);
			return;
		}

		$cmd = [];

		if (TwitchConfig::cfg('pipenv')) {
			$cmd[] = 'pipenv run tcd';
		} else {
			$cmd[] = TwitchHelper::path_tcd();
		}

		$cmd[] = '--settings-file';
		$cmd[] = TwitchHelper::$config_folder . DIRECTORY_SEPARATOR . 'tcd_settings.json';

		$cmd[] = '--video';
		$cmd[] = $this->twitch_vod_id;

		$cmd[] = '--client-id';
		$cmd[] = TwitchConfig::cfg('api_client_id');

		$cmd[] = '--client-secret';
		$cmd[] = TwitchConfig::cfg('api_secret');

		$cmd[] = '--format';
		$cmd[] = 'json';

		if (TwitchConfig::cfg('debug', false) || TwitchConfig::cfg('app_verbose', false)) {
			$cmd[] = '--verbose';
			$cmd[] = '--debug';
		}

		$cmd[] = '--output';
		$cmd[] = $this->directory;

		// $capture_output = shell_exec( $cmd );

		$process = new Process($cmd, $this->directory, null, null, null);
		$process->start();

		$pidfile = TwitchHelper::$pids_folder . DIRECTORY_SEPARATOR . 'tcd_' . $this->basename . '.pid';
		file_put_contents($pidfile, $process->getPid());

		$process->wait();

		if (file_exists($pidfile)) unlink($pidfile);

		TwitchHelper::appendLog("tcd_" . $this->basename . "_" . time() . "_stdout", "$ " . implode(" ", $cmd) . "\n" . $process->getOutput());
		TwitchHelper::appendLog("tcd_" . $this->basename . "_" . time() . "_stderr", "$ " . implode(" ", $cmd) . "\n" . $process->getErrorOutput());

		if (file_exists($tcd_filename)) {

			rename($tcd_filename, $this->path_chat);

			if (TwitchConfig::cfg('chat_compress', false)) {
				shell_exec("gzip " . $this->path_chat);
			}
		} else {

			TwitchHelper::log(TwitchHelper::LOG_ERROR, "No chat file for {$this->basename} created.");

			return false;
		}

		$successful = file_exists($this->path_chat) && filesize($this->path_chat) > 0;

		if ($successful) {
			$this->is_chat_downloaded = true;
			TwitchHelper::log(TwitchHelper::LOG_SUCCESS, "Chat downloaded for {$this->basename}");
		} else {
			TwitchHelper::log(TwitchHelper::LOG_ERROR, "Chat couldn't be downloaded for {$this->basename}");
		}

		return $successful;
		// return [$chat_filename, $capture_output, $cmd];

	}

	/**
	 * Render chat to mp4
	 *
	 * @return bool
	 */
	public function renderChat()
	{

		if (!$this->is_chat_downloaded) {
			throw new \Exception('no chat downloaded');
			return false;
		}

		if (!TwitchHelper::path_twitchdownloader() || !file_exists(TwitchHelper::path_twitchdownloader())) {
			throw new \Exception('TwitchDownloaderCLI not installed');
			return false;
		}

		TwitchHelper::log(TwitchHelper::LOG_INFO, "Render chat for {$this->basename}");

		// $chat_filename = $this->directory . DIRECTORY_SEPARATOR . $this->basename . '.chat';
		// $video_filename = $this->directory . DIRECTORY_SEPARATOR . $this->basename . '_chat.mp4';
		$chat_width = 300;

		if (file_exists($this->path_chat) && file_exists($this->path_chatrender)) {
			return true;
			// $this->burnChat($chat_width);
			// return;
		}

		$cmd = [];

		$cmd[] = TwitchHelper::path_twitchdownloader();

		$cmd[] = '--mode';
		$cmd[] = 'ChatRender';

		$cmd[] = '--input';
		$cmd[] = realpath($this->path_chat);

		$cmd[] = '--chat-height';
		$cmd[] = $this->video_metadata['video']['Height'];

		$cmd[] = '--chat-width';
		$cmd[] = $chat_width;

		$cmd[] = '--framerate';
		$cmd[] = '60';

		$cmd[] = '--update-rate';
		$cmd[] = '0';

		$cmd[] = '--font-size';
		$cmd[] = '12';

		$cmd[] = '--outline';

		$cmd[] = '--background-color';
		$cmd[] = '#00000000';

		$cmd[] = '--generate-mask';

		$cmd[] = '--output';
		$cmd[] = $this->path_chatrender;
		// $cmd[] = ' 2>&1'; // console output

		$env = [
			// 'DOTNET_BUNDLE_EXTRACT_BASE_DIR' => __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "cache",
			'PATH' => dirname(TwitchHelper::path_ffmpeg()),
			'TEMP' => TwitchHelper::$cache_folder
		];

		$process = new Process($cmd, $this->directory, $env, null, null);
		$process->start();

		$pidfile = TwitchHelper::$pids_folder . DIRECTORY_SEPARATOR . 'tdrender_' . $this->streamer_name . '.pid';
		file_put_contents($pidfile, $process->getPid());

		$process->wait();

		if (file_exists($pidfile)) unlink($pidfile);

		TwitchHelper::appendLog("tdrender_" . $this->basename . "_" . time() . "_stdout", "$ " . implode(" ", $cmd) . "\n" . $process->getOutput());
		TwitchHelper::appendLog("tdrender_" . $this->basename . "_" . time() . "_stderr", "$ " . implode(" ", $cmd) . "\n" . $process->getErrorOutput());

		// $this->burnChat( $chat_width );

		if (mb_strpos($process->getErrorOutput(), "Unhandled exception") !== false) {
			throw new \Exception('Error when running TwitchDownloaderCLI. Please check logs.');
			return false;
		}

		// return [$video_filename, $capture_output, $cmd];

		$successful = file_exists($this->path_chatrender) && filesize($this->path_chatrender) > 0;

		if ($successful) {
			$this->is_chat_rendered = true;
			TwitchHelper::log(TwitchHelper::LOG_SUCCESS, "Chat rendered for {$this->basename}");
		} else {
			TwitchHelper::log(TwitchHelper::LOG_ERROR, "Chat couldn't be rendered for {$this->basename}");
		}

		return $successful;
	}

	/**
	 * Burn chat to vod in a new file
	 *
	 * @param integer $chat_width
	 * @param boolean $use_vod Use downloaded VOD instead of captured one?
	 * @return boolean success
	 */
	public function burnChat($chat_width = 300, $use_vod = false)
	{

		TwitchHelper::log(TwitchHelper::LOG_INFO, "Burn chat for {$this->basename}");

		if ($use_vod) {

			if (!$this->is_vod_downloaded) {
				throw new \Exception('no vod downloaded');
				return false;
			}

			$video_filename = $this->directory . DIRECTORY_SEPARATOR . $this->basename . '_vod.mp4';
		} else {
			$video_filename = $this->directory . DIRECTORY_SEPARATOR . basename($this->segments_raw[0]);
		}

		// $chat_filename = $this->directory . DIRECTORY_SEPARATOR . $this->basename . '_chat.mp4';
		// $mask_filename = $this->directory . DIRECTORY_SEPARATOR . $this->basename . '_chat_mask.mp4';
		// $final_filename = $this->directory . DIRECTORY_SEPARATOR . $this->basename . '_burned.mp4';

		$chat_x = $this->video_metadata['video']['Width'] - $chat_width;

		$cmd = [];

		$cmd[] = TwitchHelper::path_ffmpeg();

		// chat render offset
		if ($this->getStartOffset() && !$use_vod) {
			$cmd[] = '-ss';
			$cmd[] = round($this->getStartOffset());
		}

		// chat render
		$cmd[] = '-i';
		$cmd[] = $this->path_chatrender;

		// chat mask offset
		if ($this->getStartOffset() && !$use_vod) {
			$cmd[] = '-ss';
			$cmd[] = round($this->getStartOffset());
		}

		// chat mask
		$cmd[] = '-i';
		$cmd[] = $this->path_chatmask;

		// vod
		$cmd[] = '-i';
		$cmd[] = $video_filename;

		// alpha mask
		// https://ffmpeg.org/ffmpeg-filters.html#overlay-1
		// https://stackoverflow.com/questions/50338129/use-ffmpeg-to-overlay-a-video-on-top-of-another-using-an-alpha-channel
		$cmd[] = '-filter_complex';
		$cmd[] = '[0][1]alphamerge[ia];[2][ia]overlay=main_w-overlay_w:0';
		// $cmd[] = '[0][1]alphamerge[ia];[2][ia]overlay=' . $chat_x . ':0';

		// copy audio stream
		$cmd[] = '-c:a';
		$cmd[] = 'copy';

		// h264 slow crf 26
		$cmd[] = '-c:v';
		$cmd[] = 'libx264';
		$cmd[] = '-preset';
		$cmd[] = TwitchConfig::cfg('burn_preset', 'slow');
		$cmd[] = '-crf';
		$cmd[] = TwitchConfig::cfg('burn_crf', '26');

		$cmd[] = $this->path_chatburn;

		$process = new Process($cmd, $this->directory, null, null, null);
		$process->start();

		// create pidfile
		$pidfile = TwitchHelper::$pids_folder . DIRECTORY_SEPARATOR . 'burnchat_' . $this->streamer_name . '.pid';
		file_put_contents($pidfile, $process->getPid());

		// wait until process is done
		$process->wait();

		// remove pidfile
		if (file_exists($pidfile)) unlink($pidfile);

		TwitchHelper::appendLog("burnchat_" . $this->basename . "_" . time() . "_stdout", "$ " . implode(" ", $cmd) . "\n" . $process->getOutput());
		TwitchHelper::appendLog("burnchat_" . $this->basename . "_" . time() . "_stderr", "$ " . implode(" ", $cmd) . "\n" . $process->getErrorOutput());

		$successful = file_exists($this->path_chatburn) && filesize($this->path_chatburn) > 0;

		if ($successful) {
			$this->is_chat_burned = true;
			TwitchHelper::log(TwitchHelper::LOG_SUCCESS, "Chat burned for {$this->basename}");
		} else {
			TwitchHelper::log(TwitchHelper::LOG_ERROR, "Chat couldn't be burned for {$this->basename}");
		}

		return $successful;
	}

	/**
	 * Fetch streamer's videos and try to match this VOD with an archived one.
	 *
	 * @return string|boolean
	 */
	public function matchTwitchVod()
	{

		TwitchHelper::log(TwitchHelper::LOG_INFO, "Try to match twitch vod for {$this->basename}");

		if ($this->twitch_vod_id) {
			TwitchHelper::log(TwitchHelper::LOG_WARNING, "Twitch vod already matched for {$this->basename}");
			return $this->twitch_vod_id;
		}

		if ($this->is_capturing || $this->is_converting) {
			TwitchHelper::log(TwitchHelper::LOG_WARNING, "Twitch vod can't match, recording in progress of {$this->basename}");
			return false;
		}

		$channel_videos = TwitchHelper::getVideos($this->streamer_id);

		if (!$channel_videos) {
			TwitchHelper::log(TwitchHelper::LOG_ERROR, "No videos returned from streamer of {$this->basename}");
			$this->twitch_vod_neversaved = true;
			$this->twitch_vod_exists = false; // @todo: check this
			return false;
		}

		$vod_id = null;

		foreach ($channel_videos as $vid) {

			$video_time = \DateTime::createFromFormat(TwitchConfig::cfg('date_format'), $vid['created_at']);

			// if within 5 minutes difference
			if (abs($this->started_at->getTimestamp() - $video_time->getTimestamp()) < 300) {

				$this->twitch_vod_id 		= $vid['id'];
				$this->twitch_vod_url 		= $vid['url'];
				$this->twitch_vod_duration 	= TwitchHelper::parseTwitchDuration($vid['duration']);
				$this->twitch_vod_title 	= $vid['title'];
				$this->twitch_vod_date 		= $vid['created_at'];
				$this->twitch_vod_exists	= true;

				TwitchHelper::log(TwitchHelper::LOG_INFO, "Matched twitch vod for {$this->basename}");

				return $this->twitch_vod_id;
			}
		}

		$this->twitch_vod_attempted = true;
		$this->twitch_vod_neversaved = true;
		$this->twitch_vod_exists = false; // @todo: check this

		TwitchHelper::log(TwitchHelper::LOG_ERROR, "Couldn't match vod for {$this->basename}");
	}

	/**
	 * Check if VOD has been deleted from Twitch
	 *
	 * @return boolean
	 */
	public function checkValidVod($save = false, $force = false)
	{

		$current_status = $this->twitch_vod_exists;

		if (!$this->is_finalized) {
			TwitchHelper::log(TwitchHelper::LOG_ERROR, "Trying to check vod valid while not finalized on {$this->basename}");
			return null;
		}

		if (!$this->twitch_vod_id) {
			TwitchHelper::log(TwitchHelper::LOG_ERROR, "No twitch VOD id for valid checking on {$this->basename}");
			if ($this->twitch_vod_neversaved) {
				if ($save && $current_status !== false) {
					$this->twitch_vod_exists = false;
					$this->saveJSON("vod check neversaved");
				}
			}
			return false;
		}

		TwitchHelper::log(TwitchHelper::LOG_INFO, "Check valid VOD for {$this->basename}");

		$video = TwitchHelper::getVideo($this->twitch_vod_id);

		if ($video) {
			TwitchHelper::log(TwitchHelper::LOG_SUCCESS, "VOD exists for {$this->basename}");
			$this->twitch_vod_exists = true;
			if ($save && $current_status !== $this->twitch_vod_exists) {
				$this->saveJSON("vod check true");
			}
			return true;
		}

		TwitchHelper::log(TwitchHelper::LOG_WARNING, "No VOD for {$this->basename}");

		$this->twitch_vod_exists = false;

		if ($save && $current_status !== $this->twitch_vod_exists) {
			$this->saveJSON("vod check false");
		}

		return false;
	}

	/**
	 * Save JSON to file, be sure to load it first!
	 *
	 * @param string $reason Reason/source for saving, will be included in log
	 * @return bool|array
	 */
	public function saveJSON($reason = null)
	{

		if (file_exists($this->filename)) {
			$tmp = file_get_contents($this->filename);
			if (md5($tmp) !== $this->json_hash) {
				TwitchHelper::log(TwitchHelper::LOG_WARNING, "JSON has been changed since loading of {$this->basename}");
			}
		}

		if (!$this->created && ($this->is_capturing || $this->is_converting || !$this->is_finalized)) {
			TwitchHelper::log(TwitchHelper::LOG_WARNING, "Saving JSON of {$this->basename} while not finalized!");
		}

		if (!$this->chapters || count($this->chapters) == 0) {
			TwitchHelper::log(TwitchHelper::LOG_WARNING, "Saving JSON of {$this->basename} with no chapters!!");
		}

		if (!$this->streamer_name && !$this->created) {
			TwitchHelper::log(TwitchHelper::LOG_FATAL, "Found no streamer name in class of {$this->basename}, not saving!");
			return false;
		}

		$generated = $this->json;

		if ($this->twitch_vod_id && $this->twitch_vod_url) {
			$generated['twitch_vod_id'] 		= $this->twitch_vod_id;
			$generated['twitch_vod_url'] 		= $this->twitch_vod_url;
			$generated['twitch_vod_duration'] 	= $this->twitch_vod_duration;
			$generated['twitch_vod_title'] 		= $this->twitch_vod_title;
			$generated['twitch_vod_date'] 		= $this->twitch_vod_date;
		}

		$generated['twitch_vod_exists'] 		= $this->twitch_vod_exists;
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

		$generated['saved_at']			= new \DateTime();

		$generated['dt_capture_started'] 		= $this->dt_capture_started;
		$generated['dt_conversion_started'] 	= $this->dt_conversion_started;
		$generated['dt_ended_at'] 				= $this->dt_ended_at;

		if (!is_writable($this->filename)) { // this is not the function i want
			// TwitchHelper::log(TwitchHelper::LOG_FATAL, "Saving JSON of " . $this->basename . " failed, permissions issue?");
			// return false;
		}

		TwitchHelper::log(TwitchHelper::LOG_SUCCESS, "Saving JSON of {$this->basename}" . ($reason ? ' (' . $reason . ')' : ''));

		file_put_contents($this->filename, json_encode($generated));

		return $generated;
	}

	public function addSegment($data)
	{
		TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Adding segment to {$this->basename}: " . basename($data));
		$this->segments_raw[] = basename($data);
	}

	public function addChapter($data)
	{
		TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Adding chapter to {$this->basename}");
		$this->chapters[] = $data;
	}

	/**
	 * Parse chapters from array and add it to the $this->chapters list
	 *
	 * @param array $array
	 * @return void
	 */
	private function parseChapters(array $array)
	{

		if (!$array || count($array) == 0) {
			TwitchHelper::log(TwitchHelper::LOG_ERROR, "No chapter data found for {$this->basename}");
			return false;
		}

		$chapters = [];

		// $data = isset($this->json['chapters']) ? $this->json['chapters'] : $this->json['games']; // why

		foreach ($array as $chapter) {

			$entry = $chapter;

			if ($entry['game_id']) {
				$game_data = TwitchHelper::getGameData((int)$entry['game_id']);
			} else {
				$game_data = null;
			}

			// $entry = array_merge($game_data, $entry); // is this a good idea?

			$entry['datetime'] = \DateTime::createFromFormat(TwitchConfig::cfg("date_format"), $entry['time']);

			if (null !== TwitchConfig::cfg('favourites') && count(TwitchConfig::cfg('favourites')) > 0) {
				$entry['favourite'] = isset(TwitchConfig::cfg('favourites')[$entry['game_id']]);
			}

			// offset
			if ($this->started_at) {
				$entry['offset'] = $entry['datetime']->getTimestamp() - $this->started_at->getTimestamp();
			}

			if ($this->is_finalized && $this->getDuration() !== false && $this->getDuration() > 0 && isset($entry['duration'])) {
				$entry['width'] = ($entry['duration'] / $this->getDuration()) * 100; // temp
			}

			// strings for templates
			$entry['strings'] = [];
			if ($this->started_at) {
				$diff = $entry['datetime']->diff($this->started_at);
				$entry['strings']['started_at'] = $diff->format('%H:%I:%S');
			} else {
				$entry['strings']['started_at'] = $entry['datetime']->format("Y-m-d H:i:s");
			}

			if (isset($entry['duration'])) {
				$entry['strings']['duration'] = TwitchHelper::getNiceDuration($entry['duration']);
			}

			// box art
			if ($game_data && $game_data['box_art_url']) {

				$img_url = $game_data['box_art_url'];
				$img_url = str_replace("{width}", 14, $img_url);
				$img_url = str_replace("{height}", 19, $img_url);
				$entry['box_art_url'] = $img_url;
			}

			$chapters[] = $entry;
		}

		$i = 0;

		foreach ($chapters as $chapter) {

			if (isset($chapters[$i + 1]) && $chapters[$i + 1]) {
				$chapters[$i]['duration'] = $chapters[$i + 1]['datetime']->getTimestamp() - $chapter['datetime']->getTimestamp();
			}

			if ($i == 0) {
				$this->game_offset = $chapter['offset'];
			}

			if ($i == sizeof($chapters) - 1 && $this->ended_at) {
				$chapters[$i]['duration'] = $this->ended_at->getTimestamp() - $chapter['datetime']->getTimestamp();
			}

			$i++;
		}

		$this->chapters = $chapters;
	}

	public function parseSegments(array $array)
	{

		if (!$array) {
			TwitchHelper::log(TwitchHelper::LOG_ERROR, "No segment data supplied on {$this->basename}");

			if (!$this->segments_raw) {
				TwitchHelper::log(TwitchHelper::LOG_ERROR, "No segment_raw data on {$this->basename}, calling rebuild...");
				$this->rebuildSegmentList();
			}

			return false;
		}

		$segments = [];

		foreach ($array as $k => $v) {

			if (gettype($v) != 'string') {
				TwitchHelper::log(TwitchHelper::LOG_ERROR, "Segment list containing invalid data for {$this->basename}, rebuilding...");
				$this->rebuildSegmentList();
				return;
			}

			$segment = [];

			$segment['filename'] = realpath($this->directory . DIRECTORY_SEPARATOR . basename($v));
			$segment['basename'] = basename($v);
			if (isset($segment['filename']) && $segment['filename'] != false && file_exists($segment['filename'])) {
				$segment['filesize'] = filesize($segment['filename']);
				$this->total_size += $segment['filesize'];
			} else {
				$segment['deleted'] = true;
			}

			$segment['strings'] = [];
			// $diff = $this->started_at->diff($this->ended_at);
			// $segment['strings']['webhook_duration'] = $diff->format('%H:%I:%S') . '</li>';

			$segments[] = $segment;
		}

		$this->segments = $segments;
	}

	public function getWebhookDuration()
	{
		if ($this->started_at && $this->ended_at) {
			$diff = $this->started_at->diff($this->ended_at);
			return $diff->format('%H:%I:%S');
		} else {
			return null;
		}
	}

	public function getUniqueGames()
	{

		$unique_games = [];

		foreach ($this->chapters as $g) {
			$unique_games[(int)$g['game_id']] = true;
		}

		$data = [];

		foreach ($unique_games as $id => $n) {
			if (!$id) continue;
			$gd = TwitchHelper::getGameData((int)$id);
			if (!$gd) continue;
			$img_url = $gd['box_art_url'];
			$img_url = str_replace("{width}", 140, $img_url);
			$img_url = str_replace("{height}", 190, $img_url);
			$data[] = [
				'name' => $gd['name'],
				'image_url' => $img_url
			];
		}

		return $data;
	}

	/**
	 * Return the current game/chapter in an array
	 *
	 * @return array
	 */
	public function getCurrentGame()
	{
		return $this->chapters[count($this->chapters) - 1];
	}

	public function getRecordingSize()
	{
		$filename = $this->directory . DIRECTORY_SEPARATOR . $this->basename . '.ts';
		if (!file_exists($filename)) return false;
		return filesize($filename);
	}

	/**
	 * Save file for lossless cut editing
	 * https://github.com/mifi/lossless-cut
	 *
	 * @return void
	 */
	public function saveLosslessCut()
	{

		TwitchHelper::log(TwitchHelper::LOG_INFO, "Saving lossless cut csv for {$this->basename}");

		$data = "";

		foreach ($this->chapters as $k => $chapter) {

			$offset = $chapter['offset'];

			$offset -= $this->chapters[0]['offset'];

			$data .= $offset . ',';

			if ($k < sizeof($this->chapters) - 1) {
				$data .= ($offset + $chapter['duration']) . ',';
			} else {
				$data .= ',';
			}

			$data .= $chapter['game_name'] ?: $chapter['game_id'];
			$data .= "\n";
		}

		file_put_contents(TwitchHelper::vodFolder($this->streamer_name) . DIRECTORY_SEPARATOR . $this->basename . '-llc-edl.csv', $data);
	}

	public function rebuildSegmentList()
	{

		if ($this->is_capturing || $this->is_converting || $this->noFiles()) {
			TwitchHelper::log(TwitchHelper::LOG_ERROR, "Won't rebuild segment list on {$this->basename}, it's still recording.");
			return false;
		}

		TwitchHelper::log(TwitchHelper::LOG_INFO, "Rebuild segment list for {$this->basename}");

		$videos = glob($this->directory . DIRECTORY_SEPARATOR . $this->basename . "*.mp4");

		if (!$videos) {
			TwitchHelper::log(TwitchHelper::LOG_WARNING, "No segments found for {$this->basename}");
			return false;
		}

		$this->segments = [];
		$this->segments_raw = [];

		foreach ($videos as $v) {
			$this->segments_raw[] = basename($v);
		}

		$this->parseSegments($this->segments_raw);

		$this->saveJSON('segments rebuild');

		return true;
	}

	public function downloadVod()
	{

		if (!$this->twitch_vod_id) {
			throw new \Exception("No twitch vod id for download");
			return false;
		}

		if ($this->is_vod_downloaded) {
			throw new \Exception("Vod is already downloaded");
			return false;
		}

		TwitchHelper::log(TwitchHelper::LOG_INFO, "Download VOD for {$this->basename}");

		set_time_limit(0); // todo: hotfix

		$capture_filename = $this->directory . DIRECTORY_SEPARATOR . $this->basename . '_vod.ts';
		$converted_filename = $this->directory . DIRECTORY_SEPARATOR . $this->basename . '_vod.mp4';

		// download vod
		if (!file_exists($capture_filename)) {

			$video_url = 'https://www.twitch.tv/videos/' . $this->twitch_vod_id;

			$cmd = [];

			if (TwitchConfig::cfg('pipenv')) {
				$cmd[] = 'pipenv run streamlink';
			} else {
				$cmd[] = TwitchHelper::path_streamlink();
			}

			$cmd[] = '-o';
			$cmd[] = $capture_filename; // output file

			$cmd[] = '--hls-segment-threads';
			$cmd[] = 10;

			$cmd[] = '--url';
			$cmd[] = $video_url; // stream url

			$cmd[] = '--default-stream';
			$cmd[] = 'best'; // twitch url and quality

			$process = new Process($cmd, $this->directory, null, null, null);
			$process->start();

			$pidfile = TwitchHelper::$pids_folder . DIRECTORY_SEPARATOR . 'vod_download_' . $this->basename . '.pid';
			file_put_contents($pidfile, $process->getPid());

			$process->wait();

			if (file_exists($pidfile)) unlink($pidfile);

			TwitchHelper::appendLog("streamlink_vod_" . $this->basename . "_" . time() . "_stdout", "$ " . implode(" ", $cmd) . "\n" . $process->getOutput());
			TwitchHelper::appendLog("streamlink_vod_" . $this->basename . "_" . time() . "_stderr", "$ " . implode(" ", $cmd) . "\n" . $process->getErrorOutput());
		}

		TwitchHelper::log(TwitchHelper::LOG_INFO, "Starting remux of {$this->basename}");

		$cmd = [];

		$cmd[] = TwitchHelper::path_ffmpeg();

		$cmd[] = '-i';
		$cmd[] = $capture_filename; // input filename

		$cmd[] = '-codec';
		$cmd[] = 'copy'; // use same codec

		$cmd[] = '-bsf:a';
		$cmd[] = 'aac_adtstoasc'; // fix audio sync in ts

		if (TwitchConfig::cfg('ts_sync')) {

			$cmd[] = '-async';
			$cmd[] = '1';

			// $cmd[] = '-filter_complex';
			// $cmd[] = 'aresample';

			// $cmd[] = '-af';
			// $cmd[] = 'aresample=async=1';

		}

		if (TwitchConfig::cfg('debug', false) || TwitchConfig::cfg('app_verbose', false)) {
			$cmd[] = '-loglevel';
			$cmd[] = 'repeat+level+verbose';
		}

		$cmd[] = $converted_filename; // output filename

		$process = new Process($cmd, $this->directory, null, null, null);
		$process->start();

		$pidfile = TwitchHelper::$pids_folder . DIRECTORY_SEPARATOR . 'vod_convert_' . $this->basename . '.pid';
		file_put_contents($pidfile, $process->getPid());

		$process->wait();

		if (file_exists($pidfile)) unlink($pidfile);

		TwitchHelper::appendLog("ffmpeg_vod_" . $this->basename . "_" . time() . "_stdout", "$ " . implode(" ", $cmd) . "\n" . $process->getOutput());
		TwitchHelper::appendLog("ffmpeg_vod_" . $this->basename . "_" . time() . "_stderr", "$ " . implode(" ", $cmd) . "\n" . $process->getErrorOutput());

		if (file_exists($capture_filename) && file_exists($converted_filename) && filesize($converted_filename) > 0) {
			unlink($capture_filename);
		}

		$successful = file_exists($converted_filename) && filesize($converted_filename) > 0;

		if ($successful) {
			$this->is_vod_downloaded = true;
		} else {
			return false;
		}

		return $converted_filename;
	}

	public function checkMutedVod($save = false, $force = false)
	{

		if (!$this->twitch_vod_id) {
			return null;
		}

		$previous = $this->twitch_vod_muted;

		TwitchHelper::log(TwitchHelper::LOG_INFO, "Check muted VOD for {$this->basename}");

		$cmd = [];

		if (TwitchConfig::cfg('pipenv')) {
			$cmd[] = 'pipenv run streamlink';
		} else {
			$cmd[] = TwitchHelper::path_streamlink();
		}

		$cmd[] = "--stream-url";
		$cmd[] = "https://www.twitch.tv/videos/" . $this->twitch_vod_id;

		$cmd[] = "best";

		$output = TwitchHelper::exec($cmd);

		// $stream_url = $output;

		if (!$output) {
			TwitchHelper::log(TwitchHelper::LOG_INFO, "VOD {$this->basename} could not be checked for mute status!");
			return null;
		}

		if (mb_strpos($output, "index-muted-") !== false) {
			$this->twitch_vod_muted = true;
			TwitchHelper::log(TwitchHelper::LOG_WARNING, "VOD {$this->basename} is muted!");
			if ($previous !== $this->twitch_vod_muted && $save) {
				$this->saveJSON("vod mute true");
			}
			return true;
		} else {
			$this->twitch_vod_muted = false;
			TwitchHelper::log(TwitchHelper::LOG_INFO, "VOD {$this->basename} is not muted!");
			if ($previous !== $this->twitch_vod_muted && $save) {
				$this->saveJSON("vod mute false");
			}
			return false;
		}
	}

	public function hasFavouriteGame()
	{
		if (!$this->chapters) return false;
		foreach ($this->chapters as $chapter) {
			if (isset($chapter['favourite']) && $chapter['favourite']) return true;
		}
		return false;
	}

	// TODO: finish this
	public function getCapturingStatus()
	{
		return TwitchHelper::getPidfileStatus('capture_' . $this->streamer_name);
	}

	public function getConvertingStatus()
	{
		return TwitchHelper::getPidfileStatus('convert_' . $this->streamer_name);
	}

	public function getChatDownloadStatus()
	{
		return TwitchHelper::getPidfileStatus('tcd_' . $this->basename);
	}

	public function getChatDumpStatus()
	{
		return TwitchHelper::getPidfileStatus('chatdump_' . $this->streamer_name);
	}

	public function finalize()
	{
		TwitchHelper::log(TwitchHelper::LOG_INFO, "Finalize {$this->basename}");
		$this->getMediainfo();
		$this->saveLosslessCut();
		$this->matchTwitchVod();
		// $this->checkMutedVod(); // initially not muted when vod is published
		$this->is_finalized = true;
	}

	/** @todo Something */
	public function repair()
	{

		$username = explode("_", $this->basename)[0];
		$user_id = TwitchHelper::getChannelId($username);
	}

	public function troubleshoot($fix = false)
	{

		$base = $this->directory . DIRECTORY_SEPARATOR . $this->basename;

		if ($this->is_finalized) {
			if (!file_exists($base . '.mp4')) {
				return ["fixable" => false, "text" => "reached finalize step, but the .mp4 file never got created."];
			}
			if (!$this->twitch_vod_id) {

				if ($this->twitch_vod_exists === false) {
					return ["fixable" => false, "text" => "reached finalize step, was never able to match twitch vod."];
				}

				if ($fix) {
					if ($this->matchTwitchVod()) {
						$this->saveJSON('troubleshoot vod match');
						return ["fixed" => true, "text" => "twitch vod matched successfully"];
					} else {
						return ["fixed" => false, "text" => "tried to match, but couldn't. maybe it's deleted?"];
					}
				}
				return ["fixable" => true, "text" => "reached finalize step, but does not have a matched twitch vod."];
			}
		}

		if ($this->is_capturing && !$this->getCapturingStatus()) {
			return ["fixable" => false, "text" => "streamlink exited but capturing didn't complete"];
		}

		if ($this->is_converting && !$this->getConvertingStatus()) {
			if (file_exists($base . '.mp4') && file_exists($base . '.ts')) {
				return ["fixable" => false, "text" => "reached conversion step, ffmpeg exited but conversion didn't complete, both .ts and .mp4 still exist."];
			} elseif (file_exists($base . '.mp4') && !file_exists($base . '.ts')) {
				if ($fix) {
					$this->is_recording = false;
					$this->is_capturing = false;
					$this->is_converting = false;
					$this->is_converted = true;
					$this->finalize();
					$this->saveJSON('troubleshoot finalize');
				}
				return ["fixable" => true, "text" => "reached conversion step, ffmpeg exited and conversion probably completed, but the .ts file got removed."];
			} elseif (!file_exists($base . '.mp4') && file_exists($base . '.ts')) {
				return ["fixable" => false, "text" => "reached conversion step, ffmpeg exited and conversion didn't complete - the .mp4 file never got created."];
			}
		}

		return false;
	}

	public function noFiles()
	{
		return (!file_exists($this->directory . DIRECTORY_SEPARATOR . $this->basename . '.ts') && !file_exists($this->directory . DIRECTORY_SEPARATOR . $this->basename . '.mp4'));
	}

	/**
	 * Delete everything about the VOD, trying to rewrite this
	 *
	 * @return void
	 */
	public function delete()
	{

		TwitchHelper::log(TwitchHelper::LOG_INFO, "Delete {$this->basename}");

		// segments
		foreach ($this->segments_raw as $s) {
			unlink($this->directory . DIRECTORY_SEPARATOR . basename($s));
		}

		unlink($this->directory . DIRECTORY_SEPARATOR . $this->basename . '.json'); // data file
		if ($this->is_lossless_cut_generated) unlink($this->directory . DIRECTORY_SEPARATOR . $this->basename . '-llc-edl.csv'); // losslesscut
		if ($this->is_chat_downloaded) unlink($this->directory . DIRECTORY_SEPARATOR . $this->basename . '.chat'); // chat download
		if ($this->is_chatdump_captured) {
			unlink($this->directory . DIRECTORY_SEPARATOR . $this->basename . '.chatdump');
			unlink($this->directory . DIRECTORY_SEPARATOR . $this->basename . '.chatdump.txt');
		}
	}

	/**
	 * Save vod to saved folder, not really that functional
	 *
	 * @return void
	 */
	public function save()
	{
		TwitchHelper::log(TwitchHelper::LOG_INFO, "Save {$this->basename}");
		rename(TwitchHelper::vodFolder($this->streamer_name) . DIRECTORY_SEPARATOR . $this->basename . '.mp4', TwitchHelper::$public_folder . DIRECTORY_SEPARATOR . "saved_vods" . $this->basename . '.mp4');
		rename(TwitchHelper::vodFolder($this->streamer_name) . DIRECTORY_SEPARATOR . $this->basename . '.json', TwitchHelper::$public_folder . DIRECTORY_SEPARATOR . "saved_vods" . $this->basename . '.json');
		rename(TwitchHelper::vodFolder($this->streamer_name) . DIRECTORY_SEPARATOR . $this->basename . '-llc-edl.csv', TwitchHelper::$public_folder . DIRECTORY_SEPARATOR . "saved_vods" . $this->basename . '-llc-edl.csv'); // losslesscut
		rename(TwitchHelper::vodFolder($this->streamer_name) . DIRECTORY_SEPARATOR . $this->basename . '.chat', TwitchHelper::$public_folder . DIRECTORY_SEPARATOR . "saved_vods" . $this->basename . '.chat'); // chat
	}

	public function convert()
	{

		set_time_limit(0);

		$captured_filename = TwitchHelper::vodFolder($this->streamer_name) . DIRECTORY_SEPARATOR . $this->basename . '.ts';

		if (!file_exists($captured_filename)) {
			throw new \Exception("No TS file found");
			return false;
		}

		$TwitchAutomator = new TwitchAutomator();

		$converted_filename = $TwitchAutomator->convert($this->basename);

		// delete captured file
		if (file_exists($converted_filename) && file_exists($captured_filename)) {
			unlink($captured_filename);
		}

		return true;
	}
}
