<?php

declare(strict_types=1);

namespace App;

use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\Process;

class TwitchVOD
{

	public $vod_path = 'vods';

	public string $capture_id = '';
	public string $filename = '';
	public string $basename = '';
	
	/** Base directory of all related files */
	public string $directory = '';
	
	public array $json = [];
	public array $meta = [];

	/** 
	 * Streamer display name.
	 * Do NOT use display name for file naming
	 */
	public ?string $streamer_name = null;

	/** Streamer user id */
	public ?string $streamer_id = null;

	/** Streamer login */
	public ?string $streamer_login = null;

	public array $segments = [];
	public array $segments_raw = [];

	/**
	 * Chapters
	 *
	 * @var [ 'time', 'game_id', 'game_name', 'viewer_count', 'title', 'datetime', 'offset', 'duration' ]
	 */
	public array $chapters = [];

	public array $ads = [];

	/** @deprecated 3.4.0 */
	public $started_at = null;
	/** @deprecated 3.4.0 */
	public $ended_at = null;

	public ?int $duration_seconds = null;
	public ?int $duration_live = null;

	public ?int $game_offset = null;

	public string $stream_resolution = '';
	public string $stream_title = '';

	public ?int $total_size = null;

	/** @todo: make these into an array instead **/
	public ?int $twitch_vod_id = null;
	public ?string $twitch_vod_url = null;
	public ?int $twitch_vod_duration = null;
	public ?string $twitch_vod_title = null;
	public ?string $twitch_vod_date = null;
	public ?bool $twitch_vod_exists = null;
	public ?bool $twitch_vod_attempted = null;
	public ?bool $twitch_vod_neversaved = null;
	public ?bool $twitch_vod_muted = null;

	/** @deprecated 3.2.0 use $is_capturing instead */
	public bool $is_recording = false;
	public bool $is_converted = false;
	public bool $is_capturing = false;
	public bool $is_converting = false;
	public bool $is_finalized = false;

	public bool $video_fail2 = false;
	private array $video_metadata = [];
	public array $video_metadata_public = [];

	public bool $is_chat_downloaded = false;
	public bool $is_vod_downloaded = false;
	public bool $is_chat_rendered = false;
	public bool $is_chat_burned = false;
	public bool $is_lossless_cut_generated = false;
	public bool $is_chatdump_captured = false;
	public bool $is_capture_paused = false;

	public ?\DateTime $dt_saved_at = null;
	public ?\DateTime $dt_started_at = null;
	public ?\DateTime $dt_ended_at = null;
	public ?\DateTime $dt_capture_started = null;
	public ?\DateTime $dt_conversion_started = null;

	public ?string $json_hash = null;

	/** Recently created? */
	public bool $created = false;
	/** Manually started? */
	public bool $force_record = false;

	public bool $automator_fail = false;

	public ?string $path_chat = null;
	public ?string $path_downloaded_vod = null;
	public ?string $path_losslesscut = null;
	public ?string $path_chatrender = null;
	public ?string $path_chatburn = null;
	public ?string $path_chatdump = null;
	public ?string $path_chatmask = null;
	public ?string $path_adbreak = null;
	public ?string $path_playlist = null;

	private array $associatedFiles = [];

	public ?bool $api_hasFavouriteGame = null;
	public ?array $api_getUniqueGames = null;
	public ?string $api_getWebhookDuration = null;
	public ?int $api_getDuration = null;
	public $api_getCapturingStatus = null;
	public ?int $api_getRecordingSize = null;
	public ?int $api_getChatDumpStatus = null;
	public ?int $api_getDurationLive = null;

	/** /basepath/vod/username */
	public ?string $webpath = null;

	private $pid_cache = [];

	private function realpath($str)
	{
		return realpath($str) ?: $str;
	}

	/**
	 * Load a VOD with a JSON file
	 *
	 * @param string $filename
	 * @param bool $api API call?
	 * @return bool|TwitchVOD
	 */
	public static function load(string $filename, $api = false)
	{

		TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "vodclass", "Loading VOD Class for {$filename} with api " . ($api ? 'enabled' : 'disabled'));

		if (!file_exists($filename)) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_FATAL, "vodclass", "VOD Class for {$filename} not found");
			throw new \Exception('VOD not found');
			return false;
		}

		$data = file_get_contents($filename);

		if (!$data || strlen($data) == 0 || filesize($filename) == 0) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_FATAL, "vodclass", "Tried to load {$filename} but no data was returned");
			return false;
		}

		$vod = new self();

		$vod->json = json_decode($data, true);
		$vod->json_hash = md5($data);

		$vod->capture_id = isset($vod->json['capture_id']) ? $vod->json['capture_id'] : '';
		$vod->filename = $vod->realpath($filename);
		$vod->basename = basename($filename, '.json');
		$vod->directory = dirname($filename);

		$vod->meta = $vod->json['meta'];

		$vod->setupDates();
		$vod->setupBasic();
		$vod->setupUserData();
		$vod->setupProvider();
		$vod->setupAssoc();
		$vod->setupFiles();

		$vod->webpath = TwitchConfig::cfg('basepath') . '/vods/' . (TwitchConfig::cfg("channel_folders") && $vod->streamer_login ? $vod->streamer_login : '');

		if ($api) {
			$vod->setupApiHelper();
		}

		TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "vodclass", "VOD Class for {$vod->basename} with api " . ($api ? 'enabled' : 'disabled') . "!");

		return $vod;
	}

	public function setupDates()
	{

		// started at
		if (isset($this->json['dt_started_at']) && isset($this->json['dt_started_at']['date'])) {
			$this->dt_started_at = new \DateTime($this->json['dt_started_at']['date']);
		} elseif (isset($this->json['started_at']) && gettype($this->json['started_at']) == 'string') {
			/** @deprecated 3.4.0 */
			$this->dt_started_at = \DateTime::createFromFormat(TwitchHelper::DATE_FORMAT, $this->json['started_at']);
		} elseif (isset($this->json['started_at']) && gettype($this->json['started_at']) == 'array') {
			/** @deprecated 3.4.0 */
			$this->dt_started_at = new \DateTime($this->json['started_at']['date']);
		}

		// ended at
		if (isset($this->json['dt_ended_at']) && isset($this->json['dt_ended_at']['date'])) {
			$this->dt_ended_at = new \DateTime($this->json['dt_ended_at']['date']);
		} elseif (isset($this->json['ended_at']) && gettype($this->json['ended_at']) == 'string') {
			/** @deprecated 3.4.0 */
			$this->dt_ended_at = \DateTime::createFromFormat(TwitchHelper::DATE_FORMAT, $this->json['ended_at']);
		} elseif (isset($this->json['ended_at']) && gettype($this->json['ended_at']) == 'array') {
			/** @deprecated 3.4.0 */
			$this->dt_ended_at = new \DateTime($this->json['ended_at']['date']);
		}

		// saved at
		if (isset($this->json['saved_at']) && isset($this->json['saved_at']['date'])) {
			$this->dt_saved_at = new \DateTime($this->json['saved_at']['date']);
		}

		// capture started
		if (isset($this->json['dt_capture_started'])) {
			$this->dt_capture_started 		= new \DateTime($this->json['dt_capture_started']['date']);
		}

		// conversion started
		if (isset($this->json['dt_conversion_started'])) {
			$this->dt_conversion_started 	= new \DateTime($this->json['dt_conversion_started']['date']);
		}
	}

	public function setupUserData()
	{
		$this->streamer_id = (string)$this->json['streamer_id'];
		$this->streamer_login = TwitchChannel::channelLoginFromId($this->json['streamer_id']);
		$this->streamer_name = TwitchChannel::channelDisplayNameFromId($this->json['streamer_id']);
	}

	public function setupProvider()
	{

		$this->twitch_vod_id 			= isset($this->json['twitch_vod_id']) ? (int)$this->json['twitch_vod_id'] : null;
		$this->twitch_vod_url 			= isset($this->json['twitch_vod_url']) ? $this->json['twitch_vod_url'] : null;
		$this->twitch_vod_duration 		= isset($this->json['twitch_vod_duration']) ? (int)$this->json['twitch_vod_duration'] : null;
		$this->twitch_vod_title 		= isset($this->json['twitch_vod_title']) ? $this->json['twitch_vod_title'] : null;
		$this->twitch_vod_date 			= isset($this->json['twitch_vod_date']) ? $this->json['twitch_vod_date'] : null;
		$this->twitch_vod_exists 		= isset($this->json['twitch_vod_exists']) ? $this->json['twitch_vod_exists'] : null;
		$this->twitch_vod_neversaved 	= isset($this->json['twitch_vod_neversaved']) ? $this->json['twitch_vod_neversaved'] : null;
		$this->twitch_vod_attempted 	= isset($this->json['twitch_vod_attempted']) ? $this->json['twitch_vod_attempted'] : null;
		$this->twitch_vod_muted 		= isset($this->json['twitch_vod_muted']) ? $this->json['twitch_vod_muted'] : null;

		// legacy
		if (isset($this->meta) && isset($this->meta['data'][0]['title'])) {
			$this->stream_title = $this->meta['data'][0]['title'];
		}

		if (isset($this->meta) && isset($this->meta['title'])) {
			$this->stream_title = $this->meta['title'];
		}
	}

	public function setupAssoc()
	{

		$this->video_fail2 			= isset($this->json['video_fail2']) ? $this->json['video_fail2'] : false;
		$this->video_metadata		= isset($this->json['video_metadata']) ? $this->json['video_metadata'] : null;
		$this->filterMediainfo();

		$this->ads = isset($this->json['ads']) ? $this->json['ads'] : [];

		if (isset($this->json['chapters']) && count($this->json['chapters']) > 0) {
			$this->parseChapters($this->json['chapters']);
		} else {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "vodclass", "No chapters on {$this->basename}!");
		}

		$this->segments_raw = isset($this->json['segments_raw']) ? $this->json['segments_raw'] : [];

		if ($this->is_finalized) {
			$this->parseSegments($this->segments_raw);
			if (!$this->duration_seconds) {
				TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "vodclass", "VOD {$this->basename} finalized but no duration, trying to fix");
				$this->getDuration(true);
			}
		}

		if (!$this->video_metadata && $this->is_finalized && count($this->segments_raw) > 0 && !$this->video_fail2 && TwitchHelper::path_mediainfo()) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "vodclass", "VOD {$this->basename} finalized but no metadata, trying to fix");
			if ($this->getMediainfo()) {
				$this->saveJSON('fix mediainfo');
			}
		}
	}

	public function setupFiles()
	{

		$this->path_chat 				= $this->realpath($this->directory . DIRECTORY_SEPARATOR . $this->basename . ".chat");
		$this->path_downloaded_vod 		= $this->realpath($this->directory . DIRECTORY_SEPARATOR . $this->basename . "_vod.mp4");
		$this->path_losslesscut 		= $this->realpath($this->directory . DIRECTORY_SEPARATOR . $this->basename . "-llc-edl.csv");
		$this->path_chatrender			= $this->realpath($this->directory . DIRECTORY_SEPARATOR . $this->basename . "_chat.mp4");
		$this->path_chatmask			= $this->realpath($this->directory . DIRECTORY_SEPARATOR . $this->basename . "_chat_mask.mp4");
		$this->path_chatburn			= $this->realpath($this->directory . DIRECTORY_SEPARATOR . $this->basename . "_burned.mp4");
		$this->path_chatdump			= $this->realpath($this->directory . DIRECTORY_SEPARATOR . $this->basename . ".chatdump");
		$this->path_adbreak				= $this->realpath($this->directory . DIRECTORY_SEPARATOR . $this->basename . ".adbreak");
		$this->path_playlist			= $this->realpath($this->directory . DIRECTORY_SEPARATOR . $this->basename . ".m3u8");

		$this->associatedFiles = [
			"{$this->basename}.json",
			"{$this->basename}.chat",
			"{$this->basename}_vod.mp4",
			"{$this->basename}-llc-edl.csv",
			"{$this->basename}_chat.mp4",
			"{$this->basename}_burned.mp4",
			"{$this->basename}.chatdump",
			"{$this->basename}.chatdump.txt",
			"{$this->basename}.chatdump.line",
			"{$this->basename}.m3u8",
			"{$this->basename}.adbreak",
		];

		if (isset($this->segments_raw)) {
			foreach ($this->segments_raw as $seg) {
				$this->associatedFiles[] = basename($seg);
			}
		}

		$this->is_chat_downloaded 			= file_exists($this->path_chat);
		$this->is_vod_downloaded 			= file_exists($this->path_downloaded_vod);
		$this->is_lossless_cut_generated 	= file_exists($this->path_losslesscut);
		$this->is_chatdump_captured 		= file_exists($this->path_chatdump);
		$this->is_capture_paused 			= file_exists($this->path_adbreak);
		$this->is_chat_rendered 			= file_exists($this->path_chatrender);
		$this->is_chat_burned 				= file_exists($this->path_chatburn);
	}

	public function setupBasic()
	{

		$this->is_recording = file_exists($this->directory . DIRECTORY_SEPARATOR . $this->basename . '.ts');
		$this->is_converted = file_exists($this->directory . DIRECTORY_SEPARATOR . $this->basename . '.mp4');

		$this->is_capturing 	= isset($this->json['is_capturing']) ? $this->json['is_capturing'] : false;
		$this->is_converting 	= isset($this->json['is_converting']) ? $this->json['is_converting'] : false;
		$this->is_finalized 	= isset($this->json['is_finalized']) ? $this->json['is_finalized'] : false;

		$this->force_record				= isset($this->json['force_record']) ? $this->json['force_record'] : false;
		$this->automator_fail			= isset($this->json['automator_fail']) ? $this->json['automator_fail'] : false;

		$this->stream_resolution		= isset($this->json['stream_resolution']) && gettype($this->json['stream_resolution']) == 'string' ? $this->json['stream_resolution'] : '';

		// $this->duration 			= $this->json['duration'];
		$this->duration_seconds 	= $this->json['duration_seconds'] ? (int)$this->json['duration_seconds'] : null;

		$dur = $this->getDurationLive();
		$this->duration_live = $dur === false ? -1 : $dur;
	}

	public function setupApiHelper()
	{
		TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "vodclass", "Run api helper for {$this->basename}");
		$this->api_hasFavouriteGame = $this->hasFavouriteGame();
		$this->api_getUniqueGames = $this->getUniqueGames();
		$this->api_getWebhookDuration = $this->getWebhookDuration();
		$this->api_getDuration = $this->getDuration(true);
		$this->api_getDurationLive = $this->getDurationLive();
		$this->api_getRecordingSize = $this->getRecordingSize() ?: null;

		if(!$this->is_finalized){
			$this->api_getCapturingStatus = $this->getCapturingStatus();
			$this->api_getChatDumpStatus = $this->getChatDumpStatus() ?: null;
		}
	}

	/**
	 * Create new VOD and mark it as created, enabling safeguards.
	 *
	 * @param string $filename
	 * @return bool
	 */
	public function create(string $filename)
	{
		TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "vodclass", "Create VOD JSON: " . basename($filename));
		$this->created = true;
		$this->filename = $filename;
		$this->basename = basename($filename, '.json');
		$this->saveJSON('create json');
		return true;
	}

	/**
	 * Reload JSON to make sure you don't overwrite anything.
	 * Now just returns a new copy.
	 * @todo make this replace itself, how?
	 * @deprecated 6.0.0
	 * @return TwitchVOD
	 */
	public function refreshJSON($api = false)
	{
		if (!$this->filename) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "vodclass", "Can't refresh vod, not found!");
			return false;
		}
		TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "vodclass", "Refreshing JSON on {$this->basename}!");
		// $this->load($this->filename);
		return static::load($this->filename, $api);
	}

	public function setPermissions()
	{
		if (
			!TwitchConfig::cfg('file_permissions') ||
			!TwitchConfig::cfg('file_chown_user') ||
			!TwitchConfig::cfg('file_chown_group') ||
			!TwitchConfig::cfg('file_chmod')
		) return;

		foreach ($this->associatedFiles as $file) {
			$path = $this->directory . DIRECTORY_SEPARATOR . $file;
			if (file_exists($path)) {
				if (!chmod($path, octdec((string)TwitchConfig::cfg('file_chmod')))) {
					TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "vodclass", "Failed to chmod {$path}");
				}
				$chown_user = is_numeric(TwitchConfig::cfg('file_chown_user')) ? intval(TwitchConfig::cfg('file_chown_user')) : TwitchConfig::cfg('file_chown_user');
				$chown_group = is_numeric(TwitchConfig::cfg('file_chown_group')) ? intval(TwitchConfig::cfg('file_chown_group')) : TwitchConfig::cfg('file_chown_group');
				if (!chown($path, $chown_user)) {
					TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "vodclass", "Failed to chown {$path} to ${chown_user}");
				}
				if (!chgrp($path, $chown_group)) {
					TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "vodclass", "Failed to chgrp {$path} to ${chown_group}");
				}
			}
		}
	}

	/**
	 * Get duration of the mp4 file.
	 *
	 * @param boolean $save Save the duration to the JSON file
	 * @return int Duration in seconds
	 */
	public function getDuration($save = false)
	{

		if (isset($this->duration_seconds) && $this->duration_seconds !== null) {
			// TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Returning saved duration for " . $this->basename . ": " . $this->duration_seconds );
			return $this->duration_seconds;
		}

		if ($this->video_metadata) {

			if (isset($this->video_metadata['general']['FileSize']) && $this->video_metadata['general']['FileSize'] == '0') {
				TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "vodclass", "Invalid video metadata for {$this->basename}!");
				return null;
			}

			if (isset($this->video_metadata['general']['Duration'])) {
				TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "vodclass", "No duration_seconds but metadata exists for {$this->basename}: " . $this->video_metadata['general']['Duration']);
				$this->duration_seconds = (int)$this->video_metadata['general']['Duration'];
				return $this->duration_seconds;
			}
			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "vodclass", "Video metadata for {$this->basename} does not include duration!");
			return null;
		}

		if ($this->is_capturing) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "vodclass", "Can't request duration because {$this->basename} is still recording!");
			return null;
		}

		if (!$this->is_converted || $this->is_converting) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "vodclass", "Can't request duration because {$this->basename} is converting!");
			return null;
		}

		if (!$this->is_finalized) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "vodclass", "Can't request duration because {$this->basename} is not finalized!");
			return null;
		}

		if (!isset($this->segments_raw) || count($this->segments_raw) == 0) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "vodclass", "No video file available for duration of {$this->basename}");
			return null;
		}

		TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "vodclass", "No mediainfo for getDuration of {$this->basename}");
		$file = $this->getMediainfo();

		if (!$file) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "vodclass", "Could not find duration of {$this->basename}");
			return null;
		} else {

			// $this->duration 			= $file['playtime_string'];
			$this->duration_seconds 	= (int)$file['general']['Duration'];

			if ($save) {
				TwitchHelper::logAdvanced(TwitchHelper::LOG_SUCCESS, "vodclass", "Saved duration for {$this->basename}");
				$this->saveJSON('duration save');
			}

			TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "vodclass", "Duration fetched for {$this->basename}: {$this->duration_seconds}");

			return $this->duration_seconds;
		}

		TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "vodclass", "Reached end of getDuration for {$this->basename}, this shouldn't happen!");
	}

	/**
	 * Run MediaInfo on the selected segment
	 *
	 * @param integer $segment_num
	 * @return array|boolean
	 */
	public function getMediainfo($segment_num = 0)
	{

		TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "vodclass", "Fetching mediainfo of {$this->basename}");

		if (!isset($this->segments_raw) || count($this->segments_raw) == 0) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "vodclass", "No segments available for mediainfo of {$this->basename}");
			return false;
		}

		$filename = $this->directory . DIRECTORY_SEPARATOR . basename($this->segments_raw[$segment_num]);

		if (!file_exists($filename)) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "vodclass", "No file available for mediainfo of {$this->basename}");
			return false;
		}

		try {
			$data = TwitchHelper::mediainfo($filename);
		} catch (\Throwable $th) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "vodclass", "Trying to get mediainfo of {$this->basename} returned: " . $th->getMessage());
			return false;
		}

		if ($data) {
			$this->video_metadata = $data;
			return $this->video_metadata;
		}

		$this->video_fail2 = true;
		return false;
	}

	public function filterMediainfo()
	{

		if (!$this->video_metadata) return;

		$this->video_metadata_public = [];

		$filter = [
			"general.Duration",
			"general.Duration_String",
			"general.FileSize",

			"video.BitRate",
			"video.Width",
			"video.Height",
			"video.FrameRate_Mode",
			"video.FrameRate_Original",
			"video.FrameRate",
			"video.Format",
			"video.BitRate_Mode",
			"video.BitRate",

			"audio.Format",
			"audio.BitRate_Mode",
			"audio.BitRate",
		];

		foreach ($this->video_metadata as $keyp => $value) {
			$this->video_metadata_public[$keyp] = array_filter($value, function ($value, $keyc) use ($filter, $keyp) {
				return in_array("{$keyp}.{$keyc}", $filter);
			}, ARRAY_FILTER_USE_BOTH);
		}

		return $this->video_metadata_public;
	}

	/**
	 * Get the current recording duration
	 *
	 * @return int
	 */
	public function getDurationLive()
	{
		if (!$this->dt_started_at) return false;
		$now = new \DateTime();
		return abs($this->dt_started_at->getTimestamp() - $now->getTimestamp());
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

	public function getChapterString()
	{
		$str = '';
		if ($this->chapters) {
			foreach ($this->chapters as $chapter) {
				if (!$chapter['offset'] || !$chapter['game_name']) continue;
				$str .= $chapter['offset'] . ':' . str_replace(" ", "_", $chapter['game_name']) . ';';
			}
		}
		return trim($str, ";");
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

		TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "vodclass", "Download chat for {$this->basename}");

		if (TwitchConfig::cfg('chat_compress', false)) {

			if (file_exists($compressed_filename)) {
				TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "vodclass", "Chat compressed already exists for {$this->basename}");
				return;
			}

			if (file_exists($this->path_chat)) {
				TwitchHelper::logAdvanced(TwitchHelper::LOG_WARNING, "vodclass", "Chat already exists for {$this->basename}");
				shell_exec("gzip " . $this->path_chat);
				return;
			}
		} else {

			if (file_exists($this->path_chat)) {
				TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "vodclass", "Chat already exists for {$this->basename}");
				return;
			}
		}

		// if tcd generated file exists, rename it
		if (file_exists($tcd_filename)) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_WARNING, "vodclass", "Renamed chat file for {$this->basename}");
			rename($tcd_filename, $this->path_chat);
			return;
		}

		$cmd = [];

		if (TwitchConfig::cfg('pipenv_enabled')) {
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

		$tcdJob = TwitchAutomatorJob::create("tcd_{$this->basename}");
		$tcdJob->setPid($process->getPid());
		$tcdJob->setProcess($process);
		$tcdJob->save();

		$process->wait();

		$tcdJob->clear();

		TwitchHelper::appendLog("tcd_{$this->basename}_" . time() . "_stdout", "$ " . implode(" ", $cmd) . "\n" . $process->getOutput());
		TwitchHelper::appendLog("tcd_{$this->basename}_" . time() . "_stderr", "$ " . implode(" ", $cmd) . "\n" . $process->getErrorOutput());

		if (mb_strpos($process->getErrorOutput(), "404 Client Error:") !== false) {
			throw new \Exception("VOD on Twitch not found, is it deleted?");
		}

		if (mb_strpos($process->getErrorOutput(), "401 Client Error: Unauthorized") !== false) {
			throw new \Exception("Unauthorized, probably need a new oauth token?");
		}

		if (file_exists($tcd_filename)) {

			rename($tcd_filename, $this->path_chat);

			if (TwitchConfig::cfg('chat_compress', false)) {
				shell_exec("gzip " . $this->path_chat);
			}
		} else {

			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "vodclass", "No chat file for {$this->basename} created.");

			return false;
		}

		$successful = file_exists($this->path_chat) && filesize($this->path_chat) > 0;

		if ($successful) {
			$this->is_chat_downloaded = true;
			TwitchHelper::logAdvanced(TwitchHelper::LOG_SUCCESS, "vodclass", "Chat downloaded for {$this->basename}");
		} else {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "vodclass", "Chat couldn't be downloaded for {$this->basename}");
		}

		TwitchHelper::webhook([
			'action' => 'chat_download',
			'success' => $successful,
			'path' => $this->path_chat,
			'vod' => $this
		]);

		return $successful;
		// return [$chat_filename, $capture_output, $cmd];

	}

	/**
	 * Render chat to mp4
	 *
	 * @return bool
	 * @throws Exception
	 */
	public function renderChat($chat_width = 300, $chat_height = null, $font = 'Inter', $font_size = 12, $use_downloaded = false, $overwrite = false)
	{

		if ($use_downloaded && !$this->is_chat_downloaded) {
			throw new \Exception('No chat downloaded');
			return false;
		} else if (!$use_downloaded && !$this->is_chatdump_captured) {
			throw new \Exception('No chat dumped');
			return false;
		}

		if (!TwitchHelper::path_twitchdownloader() || !file_exists(TwitchHelper::path_twitchdownloader())) {
			throw new \Exception('TwitchDownloaderCLI not installed');
			return false;
		}

		TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "vodclass", "Render chat for {$this->basename}");

		// $chat_filename = $this->directory . DIRECTORY_SEPARATOR . $this->basename . '.chat';
		// $video_filename = $this->directory . DIRECTORY_SEPARATOR . $this->basename . '_chat.mp4';
		// $chat_width = 300;

		if (file_exists($this->path_chat) && file_exists($this->path_chatrender) && !$overwrite) {
			throw new \Exception('Chat already rendered');
			return false;
		}

		$cmd = [];

		$cmd[] = TwitchHelper::path_twitchdownloader();

		$cmd[] = '--mode';
		$cmd[] = 'ChatRender';

		$cmd[] = '--temp-path';
		$cmd[] = TwitchHelper::$cache_folder;

		$cmd[] = '--ffmpeg-path';
		$cmd[] = TwitchHelper::path_ffmpeg();

		$cmd[] = '--input';
		$cmd[] = realpath($use_downloaded ? $this->path_chat : $this->path_chatdump);

		$cmd[] = '--chat-height';
		$cmd[] = $chat_height ?: $this->video_metadata['video']['Height'];

		$cmd[] = '--chat-width';
		$cmd[] = $chat_width;

		$cmd[] = '--framerate';
		// $cmd[] = round((int)explode(".", $this->video_metadata['video']['FrameRate_Original'])[0]);
		$cmd[] = round($this->video_metadata['video']['FrameRate_Original'] ?? $this->video_metadata['video']['FrameRate']);

		$cmd[] = '--update-rate';
		$cmd[] = '0';

		$cmd[] = '--font';
		$cmd[] = $font;

		$cmd[] = '--font-size';
		$cmd[] = $font_size;

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

		set_time_limit(0);

		TwitchHelper::appendLog("tdrender_{$this->basename}_" . time() . "_stdout", "$ " . implode(" ", $cmd) . "\n");
		TwitchHelper::appendLog("tdrender_{$this->basename}_" . time() . "_stderr", "$ " . implode(" ", $cmd) . "\n");

		$process = new Process($cmd, $this->directory, $env, null, null);
		$process->start();

		$tdrenderJob = TwitchAutomatorJob::create("tdrender_{$this->streamer_login}");
		$tdrenderJob->setPid($process->getPid());
		$tdrenderJob->setProcess($process);
		$tdrenderJob->save();

		$process->wait();

		$tdrenderJob->clear();

		TwitchHelper::appendLog("tdrender_{$this->basename}_" . time() . "_stdout", $process->getOutput());
		TwitchHelper::appendLog("tdrender_{$this->basename}_" . time() . "_stderr", $process->getErrorOutput());

		if (mb_strpos($process->getErrorOutput(), "Unhandled exception") !== false) {
			throw new \Exception('Error when running TwitchDownloaderCLI. Please check logs.');
			return false;
		}

		// return [$video_filename, $capture_output, $cmd];

		$successful = file_exists($this->path_chatrender) && filesize($this->path_chatrender) > 0;

		if ($successful) {
			$this->is_chat_rendered = true;
			TwitchHelper::logAdvanced(TwitchHelper::LOG_SUCCESS, "vodclass", "Chat rendered for {$this->basename}");
		} else {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "vodclass", "Chat couldn't be rendered for {$this->basename}");
		}

		return $successful;
	}

	/**
	 * Burn chat to vod in a new file
	 *
	 * @return boolean success
	 */
	public function burnChat(
		$burn_horizontal = "left",
		$burn_vertical = "top",
		$ffmpeg_preset = "slow",
		$ffmpeg_crf = 26,
		$use_vod = false,
		$overwrite = false,
		$test_duration = false
	)
	{

		TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "vodclass", "Burn chat for {$this->basename}");

		if ($this->path_chatburn && file_exists($this->path_chatburn) && !$overwrite) {
			throw new \Exception('Chat already burned');
			return false;
		}

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

		if (!file_exists($video_filename)) {
			throw new \Exception('No video file');
			return false;
		}

		if (!$this->path_chatrender || !file_exists($this->path_chatrender)) {
			throw new \Exception('No chat render file');
			return false;
		}

		if (!$this->path_chatmask || !file_exists($this->path_chatmask)) {
			throw new \Exception('No chat mask file');
			return false;
		}

		// $chat_x = $this->video_metadata['video']['Width'] - $chat_width;

		$cmd = [];

		$cmd[] = TwitchHelper::path_ffmpeg();

		// chat render offset
		if ($this->getStartOffset() && !$use_vod) {
			$cmd[] = '-ss';
			$cmd[] = round($this->getStartOffset());
			TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "vodclass", "Using start offset for chat: {$this->getStartOffset()}");
		}

		// chat render
		$cmd[] = '-i';
		$cmd[] = realpath($this->path_chatrender);

		// chat mask offset
		if ($this->getStartOffset() && !$use_vod) {
			$cmd[] = '-ss';
			$cmd[] = round($this->getStartOffset());
		}

		// chat mask
		$cmd[] = '-i';
		$cmd[] = realpath($this->path_chatmask);

		// vod
		$cmd[] = '-i';
		$cmd[] = $video_filename;

		// alpha mask
		// https://ffmpeg.org/ffmpeg-filters.html#overlay-1
		// https://stackoverflow.com/questions/50338129/use-ffmpeg-to-overlay-a-video-on-top-of-another-using-an-alpha-channel
		$cmd[] = '-filter_complex';
		
		// if ($burn_horizontal == "left") {
		// 	$cmd[] = '[0][1]alphamerge[ia];[2][ia]overlay=0:0';
		// } else {
		// 	$cmd[] = '[0][1]alphamerge[ia];[2][ia]overlay=main_w-overlay_w:0';
		// }
		$pos_x = $burn_horizontal == "left" ? 0 : "main_w-overlay_w";
		$pos_y = $burn_vertical == "top" ? 0 : "main_h-overlay_h";
		$cmd[] = "[0][1]alphamerge[ia];[2][ia]overlay=${pos_x}:${pos_y}";
		
		// $cmd[] = '[0][1]alphamerge[ia];[2][ia]overlay=' . $chat_x . ':0';

		// copy audio stream
		$cmd[] = '-c:a';
		$cmd[] = 'copy';

		// h264 codec
		$cmd[] = '-c:v';
		$cmd[] = 'libx264';

		// preset
		$cmd[] = '-preset';
		$cmd[] = $ffmpeg_preset;

		// crf
		$cmd[] = '-crf';
		$cmd[] = $ffmpeg_crf;

		// overwrite
		$cmd[] = '-y';

		$cmd[] = $this->path_chatburn;

		set_time_limit(0);

		$process = new Process($cmd, $this->directory, null, null, null);
		$process->start();

		// create pidfile
		$burnchatJob = TwitchAutomatorJob::create("burnchat_{$this->streamer_login}");
		$burnchatJob->setPid($process->getPid());
		$burnchatJob->setProcess($process);
		$burnchatJob->save();

		// wait until process is done
		$process->wait();

		// remove pidfile
		//if (file_exists($pidfile)) unlink($pidfile);
		$burnchatJob->clear();

		TwitchHelper::appendLog("burnchat_{$this->basename}_" . time() . "_stdout", "$ " . implode(" ", $cmd) . "\n" . $process->getOutput());
		TwitchHelper::appendLog("burnchat_{$this->basename}_" . time() . "_stderr", "$ " . implode(" ", $cmd) . "\n" . $process->getErrorOutput());

		$successful = file_exists($this->path_chatburn) && filesize($this->path_chatburn) > 0;

		if ($successful) {
			$this->is_chat_burned = true;
			TwitchHelper::logAdvanced(TwitchHelper::LOG_SUCCESS, "vodclass", "Chat burned for {$this->basename}");
		} else {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "vodclass", "Chat couldn't be burned for {$this->basename}");
		}

		return $successful;
	}

	/**
	 * Fetch streamer's videos and try to match this VOD with an archived one.
	 *
	 * @return string|boolean
	 */
	public function matchProviderVod()
	{

		TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "vodclass", "Try to match twitch vod for {$this->basename}");

		if ($this->twitch_vod_id) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_WARNING, "vodclass", "Twitch vod already matched for {$this->basename}");
			return $this->twitch_vod_id;
		}

		if ($this->is_capturing || $this->is_converting) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_WARNING, "vodclass", "Twitch vod can't match, recording in progress of {$this->basename}");
			return false;
		}

		$channel_videos = TwitchHelper::getVideos($this->streamer_id);

		if (!$channel_videos) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "vodclass", "No videos returned from streamer of {$this->basename}");
			$this->twitch_vod_neversaved = true;
			$this->twitch_vod_exists = false; // @todo: check this
			return false;
		}

		$vod_id = null;

		foreach ($channel_videos as $vid) {

			$video_time = \DateTime::createFromFormat(TwitchHelper::DATE_FORMAT, $vid['created_at']);

			// if within 5 minutes difference
			if (abs($this->dt_started_at->getTimestamp() - $video_time->getTimestamp()) < 300) {

				$this->twitch_vod_id 		= (int)$vid['id'];
				$this->twitch_vod_url 		= $vid['url'];
				$this->twitch_vod_duration 	= TwitchHelper::parseTwitchDuration($vid['duration']);
				$this->twitch_vod_title 	= $vid['title'];
				$this->twitch_vod_date 		= $vid['created_at'];
				$this->twitch_vod_exists	= true;

				TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "vodclass", "Matched twitch vod for {$this->basename}");

				return $this->twitch_vod_id;
			}
		}

		$this->twitch_vod_attempted = true;
		$this->twitch_vod_neversaved = true;
		$this->twitch_vod_exists = false; // @todo: check this

		TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "vodclass", "Couldn't match vod for {$this->basename}");
	}

	/**
	 * Check if VOD has been deleted from Twitch
	 * @param bool $save Save to JSON
	 * @param bool $force Force check (unused?)
	 * @return boolean False if VOD has been deleted, true if exists.
	 */
	public function checkValidVod($save = false, $force = false)
	{

		$current_status = $this->twitch_vod_exists;

		if (!$this->is_finalized) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "vodclass", "Trying to check vod valid while not finalized on {$this->basename}");
			return null;
		}

		if (!$this->twitch_vod_id) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "vodclass", "No twitch VOD id for valid checking on {$this->basename}");
			if ($this->twitch_vod_neversaved) {
				if ($save && $current_status !== false) {
					$this->twitch_vod_exists = false;
					$this->saveJSON("vod check neversaved");
				}
			}
			return false;
		}

		TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "vodclass", "Check valid VOD for {$this->basename}");

		$video = TwitchHelper::getVideo($this->twitch_vod_id);

		if ($video) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_SUCCESS, "vodclass", "VOD exists for {$this->basename}");
			$this->twitch_vod_exists = true;
			if ($save && $current_status !== $this->twitch_vod_exists) {
				$this->saveJSON("vod check true");
			}
			return true;
		}

		TwitchHelper::logAdvanced(TwitchHelper::LOG_WARNING, "vodclass", "No VOD for {$this->basename}");

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
				TwitchHelper::logAdvanced(TwitchHelper::LOG_WARNING, "vodclass", "JSON has been changed since loading of {$this->basename}");
			}
		}

		if (!$this->created && ($this->is_capturing || $this->is_converting || !$this->is_finalized)) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_WARNING, "vodclass", "Saving JSON of {$this->basename} while not finalized!");
		}

		if (!$this->chapters || count($this->chapters) == 0) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_WARNING, "vodclass", "Saving JSON of {$this->basename} with no chapters!!");
		}

		if (!isset($this->streamer_name) && !$this->created) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_FATAL, "vodclass", "Found no streamer name in class of {$this->basename}, not saving!");
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
		$generated['streamer_login'] 	= $this->streamer_login;

		// $generated['started_at'] 		= $this->started_at;
		// $generated['ended_at'] 			= $this->ended_at;

		$generated['chapters'] 			= $this->chapters;
		$generated['segments_raw'] 		= $this->segments_raw;
		$generated['segments'] 			= $this->segments;
		$generated['ads'] 				= $this->ads;

		$generated['is_capturing']		= $this->is_capturing;
		$generated['is_converting']		= $this->is_converting;
		$generated['is_finalized']		= $this->is_finalized;

		// $generated['duration'] 			= $this->duration;
		$generated['duration_seconds'] 	= $this->duration_seconds ?: null;

		$generated['video_metadata'] 	= $this->video_metadata;
		$generated['video_fail2'] 		= $this->video_fail2;

		$generated['force_record'] 		= $this->force_record;

		$generated['automator_fail'] 	= $this->automator_fail;

		$generated['meta']				= $this->meta;

		$generated['saved_at']			= new \DateTime();

		$generated['dt_capture_started'] 		= $this->dt_capture_started;
		$generated['dt_conversion_started'] 	= $this->dt_conversion_started;
		$generated['dt_started_at'] 			= $this->dt_started_at;
		$generated['dt_ended_at'] 				= $this->dt_ended_at;

		$generated['capture_id']				= $this->capture_id;

		if (!is_writable($this->filename)) { // this is not the function i want
			// TwitchHelper::log(TwitchHelper::LOG_FATAL, "Saving JSON of " . $this->basename . " failed, permissions issue?");
			// return false;
		}

		TwitchHelper::logAdvanced(TwitchHelper::LOG_SUCCESS, "vodclass", "Saving JSON of {$this->basename}" . ($reason ? ' (' . $reason . ')' : ''));

		file_put_contents($this->filename, json_encode($generated));
		$this->setPermissions();

		return $generated;
	}

	public function addSegment($data)
	{
		TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "vodclass", "Adding segment to {$this->basename}: " . basename($data));
		$this->segments_raw[] = basename($data);
	}

	public function addChapter($data)
	{
		TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "vodclass", "Adding chapter to {$this->basename}");
		$this->chapters[] = $data;
	}

	public function addAdvertisement($data)
	{
		TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "vodclass", "Adding advertisement to {$this->basename}: " . basename($data));
		$this->ads[] = $data;
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
			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "vodclass", "No chapter data found for {$this->basename}");
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

			$entry['datetime'] = \DateTime::createFromFormat(TwitchHelper::DATE_FORMAT, $entry['time']);

			if (null !== TwitchConfig::cfg('favourites') && count(TwitchConfig::cfg('favourites')) > 0) {
				$entry['favourite'] = isset(TwitchConfig::cfg('favourites')[$entry['game_id']]);
			}

			// offset
			if ($this->dt_started_at) {
				$entry['offset'] = $entry['datetime']->getTimestamp() - $this->dt_started_at->getTimestamp();
			}

			if ($this->is_finalized && $this->getDuration() !== false && $this->getDuration() > 0 && isset($entry['duration'])) {
				$entry['width'] = ($entry['duration'] / $this->getDuration()) * 100; // temp
			}

			// strings for templates
			$entry['strings'] = [];
			if ($this->dt_started_at) {
				$diff = $entry['datetime']->diff($this->dt_started_at);
				$entry['strings']['started_at'] = $diff->format('%H:%I:%S');
			} else {
				$entry['strings']['started_at'] = $entry['datetime']->format("Y-m-d H:i:s");
			}

			if (isset($entry['duration'])) {
				$entry['strings']['duration'] = TwitchHelper::getNiceDuration($entry['duration']);
			}

			// box art
			if ($game_data && $game_data['box_art_url']) {

				$box_art_width = round(140 * 0.5); // 14
				$box_art_height = round(190 * 0.5); // 19

				$img_url = $game_data['box_art_url'];
				$img_url = str_replace("{width}", (string)$box_art_width, $img_url);
				$img_url = str_replace("{height}", (string)$box_art_height, $img_url);
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

			if ($i == sizeof($chapters) - 1 && $this->dt_ended_at) {
				$chapters[$i]['duration'] = $this->dt_ended_at->getTimestamp() - $chapter['datetime']->getTimestamp();
			}

			$i++;
		}

		$this->chapters = $chapters;
	}

	public function parseSegments(array $array)
	{

		if (!$array) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "vodclass", "No segment data supplied on {$this->basename}");

			if (!$this->segments_raw) {
				TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "vodclass", "No segment_raw data on {$this->basename}, calling rebuild...");
				$this->rebuildSegmentList();
			}

			return false;
		}

		$segments = [];

		foreach ($array as $k => $v) {

			if (gettype($v) != 'string') {
				TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "vodclass", "Segment list containing invalid data for {$this->basename}, rebuilding...");
				$this->rebuildSegmentList();
				return;
			}

			$segment = [];

			$segment['filename'] = realpath($this->directory . DIRECTORY_SEPARATOR . basename($v));
			$segment['basename'] = basename($v);
			if (isset($segment['filename']) && $segment['filename'] != false && file_exists($segment['filename']) && filesize($segment['filename']) > 0) {
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

	public function searchChatDump(array $words)
	{

		if (!file_exists($this->path_chatdump . '.txt')) {
			return false;
		}

		// $reg = ["/daily dose/i", "/unusual memes/i"];

		$line_regex = "/^\<(.*)\>\s(\w+)\:\s(.*)$/";

		$handle = fopen($this->path_chatdump . '.txt', 'r');
		$lines = 0;
		$found_lines = [];
		if ($handle) {
			$line = fgets($handle);
			while ($line !== false) {
				$lines++;
				foreach ($words as $word) {
					if (stripos($line, $word) !== false) {
						// if (preg_match($word, $line)) {
						preg_match($line_regex, trim($line), $matches);
						if ($matches) {
							$found_lines[] = [
								'date' => $matches[1],
								'username' => $matches[2],
								'text' => $matches[3]
							];
						}
						break;
					}
				}
				$line = fgets($handle);
			}
		}

		return $found_lines;
	}

	public function getWebhookDuration()
	{
		if ($this->dt_started_at && $this->dt_ended_at) {
			$diff = $this->dt_started_at->diff($this->dt_ended_at);
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
			$img_url = str_replace("{width}", "140", $img_url);
			$img_url = str_replace("{height}", "190", $img_url);
			$data[] = [
				'id' => $id ?: $gd['id'],
				'name' => $gd['name'],
				'image_url' => $img_url
			];
		}

		return $data;
	}

	/**
	 * Return the current game/chapter in an array
	 *
	 * @return array|null
	 */
	public function getCurrentGame()
	{
		if (sizeof($this->chapters) == 0) {
			return null;
		}
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

		TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "vodclass", "Saving lossless cut csv for {$this->basename}");

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

		file_put_contents($this->directory . DIRECTORY_SEPARATOR . $this->basename . '-llc-edl.csv', $data);
		$this->setPermissions();
	}

	public function generatePlaylistFile()
	{

		$string = "";
		$string .= "#EXTM3U\n";
		$string .= "#EXT-X-TARGETDURATION:{$this->getDurationLive()}\n";
		$string .= "#EXTINF:" . $this->getDurationLive() . "\n";
		// $string .= "{$this->basename}.ts\n";
		$string .= "{$this->webpath}/{$this->basename}.ts\n";
		$string .= "#EXT-X-ENDLIST\n";

		file_put_contents($this->path_playlist, $string);
		$this->setPermissions();
	}

	public function rebuildSegmentList()
	{

		if ($this->is_capturing || $this->is_converting || $this->noFiles()) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "vodclass", "Won't rebuild segment list on {$this->basename}, it's still recording.");
			return false;
		}

		TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "vodclass", "Rebuild segment list for {$this->basename}");

		$videos = glob($this->directory . DIRECTORY_SEPARATOR . $this->basename . "*.mp4");

		if (!$videos) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_WARNING, "vodclass", "No segments found for {$this->basename}");
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

		TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "vodclass", "Download VOD for {$this->basename}");

		set_time_limit(0); // todo: hotfix

		$capture_filename = $this->directory . DIRECTORY_SEPARATOR . $this->basename . '_vod.ts';
		$converted_filename = $this->directory . DIRECTORY_SEPARATOR . $this->basename . '_vod.mp4';

		// download vod
		if (!file_exists($capture_filename)) {

			$video_url = 'https://www.twitch.tv/videos/' . $this->twitch_vod_id;

			$cmd = [];

			if (TwitchConfig::cfg('pipenv_enabled')) {
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

			// logging level
			if (TwitchConfig::cfg('debug', false)) {
				$cmd[] = '--loglevel';
				$cmd[] = 'debug';
			} elseif (TwitchConfig::cfg('app_verbose', false)) {
				$cmd[] = '--loglevel';
				$cmd[] = 'info';
			}

			$process = new Process($cmd, $this->directory, null, null, null);
			$process->start();

			$vod_downloadJob = TwitchAutomatorJob::create("vod_download_{$this->basename}");
			$vod_downloadJob->setPid($process->getPid());
			$vod_downloadJob->setProcess($process);
			$vod_downloadJob->save();

			$process->wait();

			//if (file_exists($pidfile)) unlink($pidfile);
			$vod_downloadJob->clear();

			// output logs
			TwitchHelper::appendLog("streamlink_vod_{$this->basename}_" . time() . "_stdout", "$ " . implode(" ", $cmd) . "\n" . $process->getOutput());
			TwitchHelper::appendLog("streamlink_vod_{$this->basename}_" . time() . "_stderr", "$ " . implode(" ", $cmd) . "\n" . $process->getErrorOutput());

			if (mb_strpos($process->getOutput(), "error: Unable to find video:") !== false) {
				throw new \Exception("VOD on Twitch not found, is it deleted?");
			}
		}

		TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "vodclass", "Starting remux of {$this->basename}");

		$cmd = [];

		$cmd[] = TwitchHelper::path_ffmpeg();

		$cmd[] = '-i';
		$cmd[] = $capture_filename; // input filename

		if (TwitchConfig::cfg('encode_audio')) {
			$cmd[] = '-c:v';
			$cmd[] = 'copy'; // use same video codec

			$cmd[] = '-c:a';
			$cmd[] = 'aac'; // re-encode audio

			$cmd[] = '-b:a';
			$cmd[] = '160k'; // use same audio bitrate
		} else {
			$cmd[] = '-codec';
			$cmd[] = 'copy'; // use same codec
		}

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

		$vod_convertJob = TwitchAutomatorJob::create("vod_convert_{$this->basename}");
		$vod_convertJob->setPid($process->getPid());
		$vod_convertJob->setProcess($process);
		$vod_convertJob->save();

		$process->wait();

		//if (file_exists($pidfile)) unlink($pidfile);
		$vod_convertJob->clear();

		TwitchHelper::appendLog("ffmpeg_vod_{$this->basename}_" . time() . "_stdout", "$ " . implode(" ", $cmd) . "\n" . $process->getOutput());
		TwitchHelper::appendLog("ffmpeg_vod_{$this->basename}_" . time() . "_stderr", "$ " . implode(" ", $cmd) . "\n" . $process->getErrorOutput());

		if (file_exists($capture_filename) && file_exists($converted_filename) && filesize($converted_filename) > 0) {
			unlink($capture_filename);
		}

		$successful = file_exists($converted_filename) && filesize($converted_filename) > 0;

		if ($successful) {
			$this->is_vod_downloaded = true;
		} else {
			return false;
		}

		TwitchHelper::webhook([
			'action' => 'vod_download',
			'success' => $successful,
			'path' => $converted_filename,
			'vod' => $this
		]);

		return $converted_filename;
	}

	public function checkMutedVod($save = false, $force = false)
	{

		if (!$this->twitch_vod_id) {
			return null;
		}

		$previous = $this->twitch_vod_muted;

		TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "vodclass", "Check muted VOD for {$this->basename}");

		$data = TwitchHelper::getVideo($this->twitch_vod_id);

		if (!$data) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "vodclass", "VOD {$this->basename} is deleted!");
			throw new \Exception("VOD is deleted!");
			return false;
		} else {
			if (isset($data['muted_segments']) && sizeof($data['muted_segments']) > 0) {
				$this->twitch_vod_muted = true;
				TwitchHelper::logAdvanced(TwitchHelper::LOG_WARNING, "vodclass", "VOD {$this->basename} is muted!");
				if ($previous !== $this->twitch_vod_muted && $save) {
					$this->saveJSON("vod mute true");
				}
				return true;
			} else {
				$this->twitch_vod_muted = false;
				TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "vodclass", "VOD {$this->basename} is not muted!");
				if ($previous !== $this->twitch_vod_muted && $save) {
					$this->saveJSON("vod mute false");
				}
				return false;
			}
		}
		/*
		$cmd = [];

		if (TwitchConfig::cfg('pipenv_enabled')) {
			$cmd[] = 'pipenv run streamlink';
		} else {
			$cmd[] = TwitchHelper::path_streamlink();
		}

		$cmd[] = "--stream-url";
		$cmd[] = "https://www.twitch.tv/videos/{$this->twitch_vod_id}";

		$cmd[] = "best";

		$output = TwitchHelper::exec($cmd);

		// $stream_url = $output;

		if (!$output) {
			// TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "vodclass", "VOD {$this->basename} could not be checked for mute status!", ['output' => $output]);
			throw new \Exception("VOD could not be checked for mute status, no output.");
			return null;
		}

		if (mb_strpos($output, "index-muted-") !== false) {
			$this->twitch_vod_muted = true;
			TwitchHelper::logAdvanced(TwitchHelper::LOG_WARNING, "vodclass", "VOD {$this->basename} is muted!");
			if ($previous !== $this->twitch_vod_muted && $save) {
				$this->saveJSON("vod mute true");
			}
			return true;
		} elseif (mb_strpos($output, "Unable to find video") !== false) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "vodclass", "VOD {$this->basename} is deleted!");
			throw new \Exception("VOD is deleted!");
		} else {
			$this->twitch_vod_muted = false;
			TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "vodclass", "VOD {$this->basename} is not muted!");
			if ($previous !== $this->twitch_vod_muted && $save) {
				$this->saveJSON("vod mute false");
			}
			return false;
		}
		*/
	}

	public function hasFavouriteGame()
	{
		if (!$this->chapters) return false;
		foreach ($this->chapters as $chapter) {
			if (isset($chapter['favourite']) && $chapter['favourite']) return true;
		}
		return false;
	}

	public function getCapturingStatus()
	{

		if (TwitchConfig::cfg('playlist_dump')) {
			// check if running, whatever
		}
		TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "job", "Get capturing status for {$this->basename}");
		$job = TwitchHelper::findJob("capture_{$this->streamer_login}_");
		if($job === null){
			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "job", "Capturing status for {$this->basename} is null");
		}
		return $job ? $job->getStatus() : false;
	}

	public function getConvertingStatus()
	{
		//return (TwitchAutomatorJob::load("convert_{$this->streamer_name}"))->getStatus();
		TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "job", "Get converting status for {$this->basename}");
		$job = TwitchHelper::findJob("convert_{$this->streamer_login}");
		return $job ? $job->getStatus() : false;
	}

	public function getChatDownloadStatus()
	{
		TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "job", "Get chat download status for {$this->basename}");
		return (TwitchAutomatorJob::load("tcd_{$this->basename}"))->getStatus();
	}

	public function getChatDumpStatus()
	{
		TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "job", "Get chat dump status for {$this->basename}");
		$job = TwitchHelper::findJob("chatdump_{$this->streamer_login}");
		return $job ? $job->getStatus() : false;
	}

	public function finalize()
	{
		TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "vodclass", "Finalize {$this->basename}");

		if (file_exists($this->path_playlist)) {
			unlink($this->path_playlist);
		}

		$this->getMediainfo();
		$this->saveLosslessCut();
		$this->matchProviderVod();
		// $this->checkMutedVod(); // initially not muted when vod is published
		$this->is_finalized = true;
	}

	/** @todo Something */
	public function repair()
	{

		$username = explode("_", $this->basename)[0];
		// $user_id = TwitchHelper::getChannelId($username);
	}

	/**
	 * @deprecated
	 */
	public function troubleshoot($fix = false)
	{

		$base = $this->directory . DIRECTORY_SEPARATOR . $this->basename;

		$now = new \DateTime();

		if ($this->is_finalized) {
			if (!file_exists($base . '.mp4')) {
				return ["fixable" => false, "text" => "reached finalize step, but the .mp4 file never got created."];
			}
			if (!$this->twitch_vod_id) {

				if ($this->twitch_vod_exists === false) {
					return ["fixable" => false, "text" => "reached finalize step, was never able to match twitch vod."];
				}

				if ($fix) {
					if ($this->matchProviderVod()) {
						$this->saveJSON('troubleshoot vod match');
						return ["fixed" => true, "text" => "twitch vod matched successfully"];
					} else {
						return ["fixed" => false, "text" => "tried to match, but couldn't. maybe it's deleted?"];
					}
				}
				return ["fixable" => true, "text" => "reached finalize step, but does not have a matched twitch vod."];
			}
		} else {
			if (!$this->is_converted && isset($this->dt_ended_at) && $now->getTimestamp() > $this->dt_ended_at->getTimestamp() + 600) {
				return ["fixable" => false, "text" => "waited a few minutes, but didn't manage to finalize"];
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

		TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "vodclass", "Delete {$this->basename}");

		foreach ($this->associatedFiles as $file) {
			if (file_exists($this->directory . DIRECTORY_SEPARATOR . $file)) {
				TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "vodclass", "Delete {$file}");
				unlink($this->directory . DIRECTORY_SEPARATOR . $file);
			}
		}
	}

	/**
	 * Save vod to saved folder, not really that functional
	 *
	 * @return void
	 */
	public function save()
	{
		set_time_limit(0);
		TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "vodclass", "Save {$this->basename}");

		/*
		foreach ($this->associatedFiles as $file) {
			if (file_exists($this->directory . DIRECTORY_SEPARATOR . $file)) {
				TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Save {$file}");
				rename($this->directory . DIRECTORY_SEPARATOR . $file, TwitchHelper::$public_folder . DIRECTORY_SEPARATOR . "saved_vods" . DIRECTORY_SEPARATOR . $file);
			}
		}
		*/
		$this->move(TwitchHelper::$public_folder . DIRECTORY_SEPARATOR . "saved_vods");
	}

	/**
	 * Move vod and all related files to another folder
	 * @param string $dest_dir Destination directory
	 * @return boolean True if successful
	 * @throws Exception If unsuccessful
	 */
	public function move(string $dest_dir)
	{
		set_time_limit(0);
		TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "vodclass", "Move {$this->basename} to ${dest_dir}");

		foreach ($this->associatedFiles as $file) {
			$file_from = $this->directory . DIRECTORY_SEPARATOR . $file;
			$file_to = $dest_dir . DIRECTORY_SEPARATOR . $file;
			if (file_exists($file_from)) {
				TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "vodclass", "Move {$file_from} to ${file_to}");
				if (!rename($file_from, $file_to)) {
					TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "vodclass", "Failed to move {$file_from} to ${file_to}");
					throw new \Exception("Failed to move {$file} to ${dest_dir}");
				}
			}
		}
		return true;
	}

	/** @deprecated 3.4.0 this function sucks */
	public function convert()
	{

		set_time_limit(0);

		$captured_filename = $this->directory . DIRECTORY_SEPARATOR . $this->basename . '.ts';

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
