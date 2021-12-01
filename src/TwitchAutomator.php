<?php

namespace App;

use DateTime;
use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\Process;

// declare(ticks=1); // test


/*	
	## new twitch eventsub ##
	https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types#stream-subscriptions
	https://dev.twitch.tv/docs/eventsub/eventsub-reference/#events

	how to structure basename?
	how to make new flow with game updates, keep session?

	# this is complicated
	channel.update -> online  -> write data to json
					  offline -> write data to cache

	# this should be fine, game update is weird
	stream.online -> download() -> set online 1 -> start capture -> end capture
												-> if channel data, write to json

	# this is fine
	stream.offline -> end() -> set online 0

*/

class TwitchAutomator
{

	public $data_cache = [];

	public $json = [];

	public $realm = 'twitch';

	// public $errors = [];
	// public $info = [];

	public $force_record;

	/**
	 * Working VOD
	 *
	 * @var TwitchVOD
	 */
	public $vod;

	/**
	 * old
	 *
	 * @var array
	 * @deprecated 6.0.0
	 */
	private $payload = [];

	private $payload_eventsub = [];
	private $payload_headers = [];

	private $broadcaster_user_id = "";
	private $broadcaster_user_login = "";
	private $broadcaster_user_name  = "";

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
	public function basename()
	{
		/*
		$data_id = $data['data'][0]['id'];
		$data_title = $data['data'][0]['title'];
		$data_started = $data['data'][0]['started_at'];
		$data_game_id = $data['data'][0]['game_id'];
		$data_username = $data['data'][0]['user_name'];
		*/
		// $data_id = $this->payload['id'];
		// $data_title = $this->payload['title'];
		// $data_started = $this->payload['started_at'];
		// $data_game_id = $this->payload['game_id'];
		// $data_username = $this->payload['user_name'];

		// return $data_username . '_' . $data_id . '_' . str_replace(':', '_', $data_started);

		return $this->getLogin() . '_' . str_replace(':', '_', $this->getStartDate()) . '_' . $this->getVodID();
	}

	public function streamURL()
	{
		return 'twitch.tv/' . $this->broadcaster_user_login;
	}

	public function getDateTime()
	{
		date_default_timezone_set('UTC');
		return date(TwitchHelper::DATE_FORMAT);
	}

	// public function parsePayload()
	// {
	// 	return $this->payload;
	// }

	public function getVodID()
	{
		return TwitchConfig::getCache("{$this->getLogin()}.vod.id");
		// return $this->payload['id'];
	}

	public function getUserID()
	{
		return $this->broadcaster_user_id;
		// return TwitchHelper::getChannelId($this->payload['user_name']);
	}

	public function getUsername()
	{
		return $this->broadcaster_user_name;
		// return $this->payload['user_name'];
	}

	public function getLogin()
	{
		return $this->broadcaster_user_login;
		// return $this->payload['user_name'];
	}

	public function getStartDate()
	{
		return TwitchConfig::getCache("{$this->getLogin()}.vod.started_at");
		// return $this->payload['started_at'];
	}

	public function getTitle()
	{

		$channeldata = TwitchConfig::getCache("{$this->getLogin()}.channeldata");
		if ($channeldata) {
			$channeldata_json = json_decode($channeldata, true);
			if ($channeldata_json) {
				return $channeldata_json["title"];
			}
		}

		return false;

		// return $this->payload['title'];
	}

	/**
	 * Remove old VODs by streamer name, this has to be properly rewritten
	 */
	public function cleanup($login, $source_basename = null)
	{

		$vods = glob(TwitchHelper::vodFolder($login) . DIRECTORY_SEPARATOR . $login . "_*.json");

		$total_size = 0;

		$vod_list = [];

		foreach ($vods as $v) {

			$vodclass = TwitchVOD::load($v);

			if (TwitchConfig::cfg('keep_deleted_vods') && $vodclass->twitch_vod_exists === false) {
				TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "automator", "Keeping {$vodclass->basename} due to it being deleted on Twitch.");
				continue;
			}

			if (TwitchConfig::cfg('keep_favourite_vods') && $vodclass->hasFavouriteGame()) {
				TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "automator", "Keeping {$vodclass->basename} due to it having a favourite game.");
				continue;
			}

			if (TwitchConfig::cfg('keep_muted_vods') && $vodclass->twitch_vod_muted === true) {
				TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "automator", "Keeping {$vodclass->basename} due to it being muted on Twitch.");
				continue;
			}

			$vod_list[] = $vodclass;

			foreach ($vodclass->segments_raw as $s) {
				$total_size += filesize(TwitchHelper::vodFolder($login) . DIRECTORY_SEPARATOR . basename($s));
			}
		}

		$gb = $total_size / 1024 / 1024 / 1024;

		// $this->info[] = 'Total filesize for ' . $login . ': ' . $gb;
		TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "automator", "Total filesize for {$login}: " . TwitchHelper::formatBytes($total_size));

		TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "automator", "Amount for {$login}: " . sizeof($vod_list) . "/" . (TwitchConfig::cfg("vods_to_keep") + 1));


		// don't include the current vod
		if (sizeof($vod_list) > (TwitchConfig::cfg('vods_to_keep') + 1) || $gb > TwitchConfig::cfg('storage_per_streamer')) {

			TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "automator", "Total filesize for {$login} exceeds either vod amount or storage per streamer");

			// don't delete the newest vod, hopefully
			if ($source_basename != null && $vod_list[0]->basename == $source_basename) {
				TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "automator", "Trying to cleanup latest VOD {$vod_list[0]->basename}");
				return false;
			}

			// only delete first vod, too scared of having it do all
			TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "automator", "Cleanup {$vod_list[0]->basename}");
			$vod_list[0]->delete();
		}

	}

	/**
	 * Entrypoint for stream capture, this is where all Twitch EventSub (webhooks) end up.
	 *
	 * @param array $data
	 * @param array $headers
	 * @return void
	 */
	public function handle($data, $headers)
	{

		TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "automator", "Handle called, proceed to parsing.");

		// $headers = apache_request_headers();

		/*
		if (!$data['data']) {
			$link = $headers['Link'];
			preg_match("/user_id=([0-9]+)>/", $link, $link_match);
			$userid = (string)$link_match[1];
			$username = TwitchHelper::getChannelUsername($userid);
			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "automator", "No data supplied for handle (probably stream end, {$username}?)", ['get' => $_GET, 'post' => $_POST, 'headers' => $headers, 'data' => $data]);
			return false;
		}

		$data_id = $data['data'][0]['id'];
		// $data_title = $data['data'][0]['title'];
		// $data_started = $data['data'][0]['started_at'];
		// $data_game_id = $data['data'][0]['game_id'];
		$data_username = $data['data'][0]['user_name'];
		*/

		/* stream.online
			{
				"subscription": {
					"id": "f1c2a387-161a-49f9-a165-0f21d7a4e1c4",
					"type": "stream.online",
					"version": "1",
					"status": "enabled",
					"cost": 0,
					"condition": {
						"broadcaster_user_id": "1337"
					},
					"transport": {
						"method": "webhook",
						"callback": "https://example.com/webhooks/callback"
					},
					"created_at": "2019-11-16T10:11:12.123Z"
				},
				"event": {
					"id": "9001",
					"broadcaster_user_id": "1337",
					"broadcaster_user_login": "cool_user",
					"broadcaster_user_name": "Cool_User",
					"type": "live",
					"started_at": "2020-10-11T10:11:12.123Z"
				}
			}
		*/

		/* stream.offline
			{
				"subscription": {
					"id": "f1c2a387-161a-49f9-a165-0f21d7a4e1c4",
					"type": "stream.offline",
					"version": "1",
					"status": "enabled",
					"cost": 0,
					"condition": {
						"broadcaster_user_id": "1337"
					},
					"created_at": "2019-11-16T10:11:12.123Z",
					"transport": {
						"method": "webhook",
						"callback": "https://example.com/webhooks/callback"
					}
				},
				"event": {
					"broadcaster_user_id": "1337",
					"broadcaster_user_login": "cool_user",
					"broadcaster_user_name": "Cool_User"
				}
			}
		*/

		/* channel.update
			{
				"subscription": {
					"id": "f1c2a387-161a-49f9-a165-0f21d7a4e1c4",
					"type": "channel.update",
					"version": "1",
					"status": "enabled",
					"cost": 0,
					"condition": {
					"broadcaster_user_id": "1337"
					},
					"transport": {
						"method": "webhook",
						"callback": "https://example.com/webhooks/callback"
					},
					"created_at": "2019-11-16T10:11:12.123Z"
				},
				"event": {
					"broadcaster_user_id": "1337",
					"broadcaster_user_login": "cool_user",
					"broadcaster_user_name": "Cool_User",
					"title": "Best Stream Ever",
					"language": "en",
					"category_id": "21779",
					"category_name": "Fortnite",
					"is_mature": false
				}
			}
		*/

		if (!$headers['Twitch-Eventsub-Message-Id'][0]) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "automator", "No twitch message id supplied to handle", ['headers' => $headers, 'data' => $data]);
			return false;
		}

		$message_retry = $headers['Twitch-Eventsub-Message-Retry'] ? $headers['Twitch-Eventsub-Message-Retry'][0] : null;

		/*
		if (!$headers['Twitch-Notification-Id'][0]) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "automator", "No twitch notification id supplied to handle", ['headers' => $headers, 'payload' => $data]);
			return false;
		}
		*/

		$this->payload_eventsub = $data;
		$this->payload_headers = $headers;

		$subscription = $data['subscription'];
		$subscription_type = $subscription['type'];
		$subscription_id = $subscription['id'];

		$this->data_cache = $data;

		$event = $data['event'];
		$this->broadcaster_user_id = $event['broadcaster_user_id'];
		$this->broadcaster_user_login = $event['broadcaster_user_login'];
		$this->broadcaster_user_name = $event['broadcaster_user_name'];

		if ($subscription_type == "channel.update") {

			// check if channel is in config, copypaste
			if (!TwitchConfig::getChannelByLogin($this->broadcaster_user_login)) {
				TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "automator", "Handle (update) triggered with sub id {$subscription_id}, but username '{$this->broadcaster_user_login}' is not in config.");
				
				// 5head solution
				// TwitchHelper::channelUnsubscribe($this->broadcaster_user_id);
				TwitchHelper::eventSubUnsubscribe($subscription_id);
				return false;
			}

			TwitchConfig::setCache("{$this->broadcaster_user_login}.last.update", (new DateTime())->format(DateTime::ATOM));
			TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "automator", "Channel update for {$this->broadcaster_user_login}", ['headers' => $headers, 'payload' => $data]);

			$this->updateGame();
		} elseif ($subscription_type == "stream.online") {

			TwitchConfig::setCache("{$this->broadcaster_user_login}.last.online", (new DateTime())->format(DateTime::ATOM));
			TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "automator", "Stream online for {$this->broadcaster_user_login} (retry {$message_retry})", ['headers' => $headers, 'payload' => $data]);

			// check if channel is in config, hmm
			if (!TwitchConfig::getChannelByLogin($this->broadcaster_user_login)) {
				TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "automator", "Handle (online) triggered with sub id {$subscription_id}, but username '{$this->broadcaster_user_login}' is not in config.");
				
				// 5head solution
				// TwitchHelper::channelUnsubscribe($this->broadcaster_user_id);
				TwitchHelper::eventSubUnsubscribe($subscription_id);
				return false;
			}

			TwitchConfig::setCache("{$this->broadcaster_user_login}.online", "1");
			TwitchConfig::setCache("{$this->broadcaster_user_login}.vod.id", $event["id"]);
			TwitchConfig::setCache("{$this->broadcaster_user_login}.vod.started_at", $event["started_at"]);

			// $this->payload = $data['data'][0];

			$basename = $this->basename();

			$folder_base = TwitchHelper::vodFolder($this->broadcaster_user_login);

			if (file_exists($folder_base . DIRECTORY_SEPARATOR . $basename . '.json')) {

				if ($vodclass = TwitchVOD::load(($folder_base . DIRECTORY_SEPARATOR . $basename . '.json'))) {

					if ($vodclass->is_finalized) {
						TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "automator", "VOD is finalized, but wanted more info on {$basename} (retry {$message_retry})");
					} elseif ($vodclass->is_capturing) {
						// $this->updateGame();
						TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "automator", "VOD exists and is still capturing on {$basename} (retry {$message_retry})");
					} else {
						TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "automator", "VOD exists but isn't capturing anymore on {$basename} (retry {$message_retry})");
					}
				} else {
					TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "automator", "Could not load VOD in handle for {$basename} (retry {$message_retry})");
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

				$this->download();
			}
		} elseif ($subscription_type == "stream.offline") {

			TwitchConfig::setCache("{$this->broadcaster_user_login}.last.offline", (new DateTime())->format(DateTime::ATOM));
			TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "automator", "Stream offline for {$this->broadcaster_user_login}", ['headers' => $headers, 'payload' => $data]);

			// TwitchConfig::setCache("{$this->broadcaster_user_login}.online", "0");
			TwitchConfig::setCache("{$this->broadcaster_user_login}.online", null);
			// TwitchConfig::setCache("{$this->broadcaster_user_login}.vod.id", null);
			// TwitchConfig::setCache("{$this->broadcaster_user_login}.vod.started_at", null);

			$this->end();
		} else {

			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "automator", "No supported subscription type ({$subscription_type}).", ['headers' => $headers, 'payload' => $data]);
		}
	}

	/**
	 * Add game/chapter to stream
	 *
	 * @return void
	 */
	public function updateGame($from_cache = false)
	{

		/*
		$data_id 			= $this->getVodID();
		$data_started 		= $this->getStartDate();
		$data_game_id 		= $this->payload['game_id'];
		$data_username 		= $this->getUsername();
		$data_viewer_count 	= $this->payload['viewer_count'];
		$data_title 		= $this->getTitle();
		*/

		// $broadcaster_user_id = $this->payload_eventsub['broadcaster_user_id'];
		// $broadcaster_user_login = $this->payload_eventsub['broadcaster_user_login'];
		// $broadcaster_user_name = $this->payload_eventsub['broadcaster_user_name'];

		// if online
		if (TwitchConfig::getCache("{$this->getLogin()}.online") === "1") {

			$basename = $this->basename();
			$folder_base = TwitchHelper::vodFolder($this->getLogin());

			if (!$this->vod) {
				try {
					$this->vod = TwitchVOD::load($folder_base . DIRECTORY_SEPARATOR . $basename . '.json');
				} catch (\Throwable $th) {
					TwitchHelper::logAdvanced(TwitchHelper::LOG_FATAL, "automator", "Tried to load VOD {$basename} but errored: {$th->getMessage()}");

					TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "automator", "Resetting online status on {$this->getLogin()} due to file error.");
					TwitchConfig::setCache("{$this->broadcaster_user_login}.online", null);
					return false;
				}
				
			}

			$event = [];

			// fetch from cache
			if ($from_cache) {
				$cd = TwitchConfig::getCache("{$this->getLogin()}.channeldata");
				if (!$cd) {
					TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "automator", "Tried to get channel cache for {$this->broadcaster_user_login} but it was not available.");
					return false;
				}
				$cdj = json_decode($cd, true);
				if (!$cdj) {
					TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "automator", "Tried to parse channel cache json for {$this->broadcaster_user_login} but it errored.");
					return false;
				}
				$event = $cdj;
			} else {
				$event = $this->payload_eventsub["event"];
			}

			TwitchHelper::logAdvanced(TwitchHelper::LOG_SUCCESS, "automator", "Channel data for {$this->broadcaster_user_login} fetched from " . ($from_cache ? 'cache' : 'notification') . ".", ['event' => $event]);

			$chapter = [
				'time' 			=> $this->getDateTime(),
				'dt_started_at'	=> new \DateTime(),
				'game_id' 		=> $event["category_id"],
				'game_name'		=> $event["category_name"],
				// 'viewer_count' 	=> $data_viewer_count,
				'title'			=> $event["title"],
				'is_mature'		=> $event["is_mature"],
				'online'		=> true,
			];

			$this->vod->addChapter($chapter);
			$this->vod->saveJSON('game update');

			TwitchHelper::webhook([
				'action' => 'chapter_update',
				'chapter' => $chapter,
				'vod' => $this->vod
			]);

			// append chapter to history
			$fp = fopen(TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . "history" . DIRECTORY_SEPARATOR . $this->broadcaster_user_login . ".jsonline", 'a');
			fwrite($fp, json_encode($chapter) . "\n");
			fclose($fp);

			TwitchHelper::logAdvanced(TwitchHelper::LOG_SUCCESS, "automator", "Game updated on '{$this->broadcaster_user_login}' to '{$event["category_name"]}' ({$event["title"]}) using " . ($from_cache ? 'cache' : 'notification') . ".");
		} else {
			$event = $this->payload_eventsub["event"];
			TwitchConfig::setCache("{$this->broadcaster_user_login}.channeldata", json_encode($this->payload_eventsub['event']));
			TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "automator", "Channel {$this->broadcaster_user_login} not online, saving channel data to cache: {$event["category_name"]} ({$event["title"]})", ['payload' => $this->payload_eventsub]);

			// DRY
			$chapter = [
				'time' 			=> $this->getDateTime(),
				'dt_started_at'	=> new \DateTime(),
				'game_id' 		=> $event["category_id"],
				'game_name'		=> $event["category_name"],
				// 'viewer_count' 	=> $data_viewer_count,
				'title'			=> $event["title"],
				'is_mature'		=> $event["is_mature"],
				'online'		=> false,
			];

			$fp = fopen(TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . "history" . DIRECTORY_SEPARATOR . $this->broadcaster_user_login . ".jsonline", 'a');
			fwrite($fp, json_encode($chapter) . "\n");
			fclose($fp);
		}

		/*
		$basename = $this->basename();

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
		$this->vod->meta = $this->payload;
		$this->vod->json['meta'] = $this->payload;

		if ($this->force_record) $this->vod->force_record = true;

		// full datetime-stamp of stream start
		// $this->json['started_at'] = $data_started;
		$this->vod->dt_started_at = \DateTime::createFromFormat(TwitchHelper::DATE_FORMAT, $data_started);

		// fetch game name from either cache or twitch
		$game_name = TwitchHelper::getGameName((int)$data_game_id);

		$chapter = [
			'time' 			=> $this->getDateTime(),
			'datetime'		=> new \DateTime(), /** @deprecated 5.0.0 *
			'dt_started_at'	=> new \DateTime(),
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

		TwitchHelper::logAdvanced(TwitchHelper::LOG_SUCCESS, "automator", "Game updated on {$data_username} to {$game_name} ({$data_title})", ['instance' => $_GET['instance']]);
		*/
	}

	/**
	 * This function gets called when a stream ends, but the username isn't provided by Twitch, weirdly.
	 *
	 * @return void
	 */
	public function end()
	{
		TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "automator", "Stream end");
	}

	/**
	 * Start the download/capture process of a live stream. This is the main process.
	 *
	 * @param integer $tries
	 * @return void
	 */
	public function download($tries = 0)
	{

		// $data_id = $this->payload['id'];
		$data_title = $this->getTitle();
		$data_started = $this->getStartDate();
		// $data_game_id = $this->payload['game_id'];
		// $data_username = $this->payload['user_name'];

		$data_id = $this->getVodID();
		$data_username = $this->getUsername();

		// this shouldn't happen, just a safeguard
		if (!$data_id) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "automator", "No data supplied for download, try #{$tries}");
			throw new \Exception('No data supplied');
			return;
		}

		$basename = $this->basename();

		$folder_base = TwitchHelper::vodFolder($this->getLogin());

		// make a folder for the streamer if it for some reason doesn't exist, but it should get created in the config
		if (!file_exists($folder_base)) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_WARNING, "automator", "Making folder for {$data_username}, unusual.", ['download' => $data_username]);
			mkdir($folder_base);
		}

		// if running
		$job = TwitchAutomatorJob::load("capture_{$basename}");
		if ($job && $job->getStatus()) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_FATAL, "automator", "Stream already capturing to {$job->metadata['basename']} from {$data_username}, but reached download function regardless!", ['download' => $data_username]);
			return false;
		}

		// create the vod and put it inside this class
		$this->vod = new TwitchVOD();
		$this->vod->create($folder_base . DIRECTORY_SEPARATOR . $basename . '.json');

		$this->vod->meta = $this->payload_eventsub;
		$this->vod->json['meta'] = $this->payload_eventsub;
		$this->vod->streamer_name = $this->getUsername();
		$this->vod->streamer_login = $this->getLogin();
		$this->vod->streamer_id = $this->getUserID();
		$this->vod->dt_started_at = \DateTime::createFromFormat(TwitchHelper::DATE_FORMAT, $data_started);

		if ($this->force_record) $this->vod->force_record = true;

		$this->vod->saveJSON('stream download');
		$this->vod = $this->vod->refreshJSON();

		TwitchHelper::webhook([
			'action' => 'start_download',
			'vod' => $this->vod
		]);

		// $this->updateGame();

		$streamer = TwitchConfig::getChannelByLogin($this->broadcaster_user_login);

		// check matched title, broken?
		if ($streamer && count($streamer->match) > 0) {

			$match = false;

			// $this->notify($basename, 'Check keyword matches for user ' . json_encode($streamer), self::NOTIFY_GENERIC);
			TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "automator", "Check keyword matches for {$basename}", ['download' => $data_username]);

			foreach ($streamer->match as $m) {
				if (mb_strpos(strtolower($data_title), $m) !== false) {
					$match = true;
					break;
				}
			}

			if (!$match) {
				// $this->notify($basename, 'Cancel download because stream title does not contain keywords', self::NOTIFY_GENERIC);
				TwitchHelper::logAdvanced(TwitchHelper::LOG_WARNING, "automator", "Cancel download of {$basename} due to missing keywords", ['download' => $data_username]);
				$this->vod->delete();
				return;
			}
		}

		$this->vod->is_capturing = true;
		$this->vod->saveJSON('is_capturing set');

		// update the game + title if it wasn't updated already
		TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "automator", "Update game for {$basename}", ['download' => $data_username, 'instance' => $_GET['instance']]);
		if (TwitchConfig::getCache("{$this->getLogin()}.channeldata")) {
			$this->updateGame(true);
			TwitchConfig::setCache("{$this->getLogin()}.channeldata", null);
		}

		/** @todo: non-blocking, how */
		/*
		if (TwitchConfig::cfg('playlist_dump')) {
			try {
				$client = new \GuzzleHttp\Client();
				$client->request("GET", TwitchConfig::cfg('app_url') . "/api/v0/playlist_dump/{$data_username}", [
					'connect_timeout' => 5,
					'timeout' => 5
				]);
			} catch (\Throwable $th) {
				TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "automator", "Playlist dump fetch timeout for {$basename}, probably normal", ['download' => $data_username]);
			}
			// $this->playlistDump($data);
		}
		*/

		if (TwitchConfig::cfg('playlist_dump')) {

			$psa = new TwitchPlaylistAutomator();
			$psa->setup($data_username, TwitchConfig::getChannelByLogin($this->getLogin())->quality[0]);
			$psa->output_file = $folder_base . DIRECTORY_SEPARATOR . $basename . '.ts';

			try {
				$capture_filename = $psa->downloadLatest();
			} catch (\Throwable $th) {
				TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "automator", "Exception handler for playlist dump for {$basename}, capture normally: " . $th->getMessage());

				// fallback
				$capture_filename = $this->capture($basename, $tries);
			}
		} else {

			// capture with streamlink, this is the crucial point in this entire program
			$capture_filename = $this->capture($basename, $tries);
		}

		$capture_failed = !$capture_filename || (isset($capture_filename) && !file_exists($capture_filename));

		// send internal webhook for capture start
		TwitchHelper::webhook([
			'action' => 'end_capture',
			'vod' => $this->vod,
			'success' => !$capture_failed
		]);

		// error handling if nothing got downloaded
		if ($capture_failed) {

			TwitchHelper::logAdvanced(TwitchHelper::LOG_WARNING, "automator", "Panic handler for {$basename}, no captured file!");

			if ($tries >= TwitchConfig::cfg('download_retries')) {
				TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "automator", "Giving up on downloading, too many tries for {$basename}", ['download' => $data_username]);
				rename($folder_base . DIRECTORY_SEPARATOR . $basename . '.json', $folder_base . DIRECTORY_SEPARATOR . $basename . '.json.broken');
				throw new \Exception('Too many tries');
				return;
				// @TODO: fatal error
			}

			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "automator", "Error when downloading, retrying {$basename}", ['download' => $data_username]);

			sleep(15);

			$this->download($tries + 1);

			return;
		}

		// end timestamp
		TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "automator", "Add end timestamp for {$basename}", ['download' => $data_username]);

		$this->vod = $this->vod->refreshJSON();
		// $this->vod->ended_at = $this->getDateTime();
		$this->vod->dt_ended_at = new \DateTime();
		$this->vod->is_capturing = false;
		if ($this->stream_resolution) $this->vod->stream_resolution = $this->stream_resolution;
		$this->vod->saveJSON('stream capture end');

		if ($this->vod->getDurationLive() > (86400 - (60 * 10))) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_WARNING, "automator", "The stream {$basename} is 24 hours, this might cause issues.", ['download' => $data_username]);
		}

		// wait for one minute in case something didn't finish
		sleep(60);

		$this->vod = $this->vod->refreshJSON();
		$this->vod->is_converting = true;
		$this->vod->saveJSON('is_converting set');

		// convert with ffmpeg
		$converted_filename = $this->convert($basename);

		sleep(10);

		$convert_success = file_exists($capture_filename) && $converted_filename && file_exists($converted_filename);

		TwitchHelper::webhook([
			'action' => 'end_convert',
			'vod' => $this->vod,
			'success' => $convert_success
		]);

		// remove ts if both files exist
		if ($convert_success) {
			unlink($capture_filename);
		} else {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_FATAL, "automator", "Missing conversion files for {$basename}");
			$this->vod->automator_fail = true;
			$this->vod->is_converting = false;
			$this->vod->saveJSON('automator fail');
			return false;
			// return @TODO: fatal error
		}

		// add the captured segment to the vod info
		TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "automator", "Conversion done, add segments to {$basename}", ['download' => $data_username]);
		$this->vod = $this->vod->refreshJSON();
		$this->vod->is_converting = false;
		// if(!$this->json['segments_raw']) $this->json['segments_raw'] = [];
		$this->vod->addSegment($converted_filename);
		$this->vod->saveJSON('add segment');

		// remove old vods for the streamer
		TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "automator", "Cleanup old VODs for {$data_username}", ['download' => $data_username]);
		$this->cleanup($this->getLogin(), $basename);

		// finalize

		// metadata stuff
		TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "automator", "Sleep 2 minutes for {$basename}", ['download' => $data_username]);
		sleep(60 * 2);

		TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "automator", "Do metadata on {$basename}", ['download' => $data_username]);

		$vodclass = TwitchVOD::load($folder_base . DIRECTORY_SEPARATOR . $basename . '.json');

		$vodclass->finalize();
		$vodclass->saveJSON('finalized');

		// download chat and optionally burn it
		if ($streamer->download_chat && $vodclass->twitch_vod_id) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "automator", "Auto download chat on {$basename}", ['download' => $data_username]);
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

		TwitchHelper::logAdvanced(TwitchHelper::LOG_SUCCESS, "automator", "All done for {$basename}", ['download' => $data_username]);

		// finally send internal webhook for capture finish
		TwitchHelper::webhook([
			'action' => 'end_download',
			'vod' => $vodclass
		]);
	}

	/**
	 * Actually capture the stream with streamlink or youtube-dl
	 * Blocking function
	 *
	 * @param int $tries Current try after failing
	 * @return string Captured filename
	 */
	public function capture($basename, $tries)
	{

		// $data_id = $this->payload['id'];
		// $data_title = $this->payload['title'];

		// $data_started = $this->payload['started_at'];
		$data_started = $this->getStartDate();

		// $data_game_id = $this->payload['game_id'];
		// $data_username = $this->payload['user_name'];

		$data_id = $this->getVodID();
		$data_username = $this->getUsername();

		if (!$data_id) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "automator", "No ID supplied for capture");
			// $this->errors[] = 'ID not supplied for capture';
			return false;
		}

		// $stream_url = 'twitch.tv/' . $data_username;
		$stream_url = $this->streamURL();

		// $basename = $this->basename();

		$folder_base = TwitchHelper::vodFolder($this->getLogin());

		$capture_filename = $folder_base . DIRECTORY_SEPARATOR . $basename . '.ts';

		$chat_filename = $folder_base . DIRECTORY_SEPARATOR . $basename . '.chatdump';

		$streamer_config = TwitchConfig::getChannelByLogin($this->getLogin());

		// failure
		/*
		$int = 1;
		while (file_exists($capture_filename)) {
			// $this->errors[] = 'File exists while capturing, making a new name';
			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "automator", "File exists while capturing, making a new name for {$basename}, attempt #{$int}", ['download-capture' => $data_username]);
			$capture_filename = $folder_base . DIRECTORY_SEPARATOR . $basename . '-' . $int . '.ts';
			$int++;
		}
		*/

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

		// disable reruns
		$cmd[] = '--twitch-disable-reruns';

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
		if (isset($streamer_config) && isset($streamer_config->quality)) {
			$cmd[] = implode(",", $streamer_config->quality); // quality
		} else {
			$cmd[] = 'best';
		}

		// $this->info[] = 'Streamlink cmd: ' . implode(" ", $cmd);

		$this->vod = $this->vod->refreshJSON();
		$this->vod->dt_capture_started = new \DateTime();
		$this->vod->saveJSON('dt_capture_started set');

		TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "automator", "Starting capture with filename " . basename($capture_filename), ['download-capture' => $data_username, 'cmd' => implode(' ', $cmd), ['instance' => $_GET['instance']]]);

		// start process in async mode
		$process = new Process($cmd, dirname($capture_filename), null, null, null);
		$process->start();

		// output command line
		TwitchHelper::clearLog("streamlink_{$basename}_stdout.{$tries}");
		TwitchHelper::clearLog("streamlink_{$basename}_stderr.{$tries}");
		TwitchHelper::appendLog("streamlink_{$basename}_stdout.{$tries}", "$ " . implode(" ", $cmd));
		TwitchHelper::appendLog("streamlink_{$basename}_stderr.{$tries}", "$ " . implode(" ", $cmd));

		// generate m3u8 file
		$this->vod->generatePlaylistFile();

		// save pid to file
		// $pidfile = TwitchHelper::$pids_folder . DIRECTORY_SEPARATOR . 'capture_' . $data_username . '.pid';
		TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "automator", "Capture " . basename($capture_filename) . " has PID " . $process->getPid(), ['download-capture' => $data_username]);
		// file_put_contents($pidfile, $process->getPid());
		$captureJob = TwitchAutomatorJob::create("capture_{$basename}");
		$captureJob->setPid($process->getPid());
		$captureJob->setProcess($process);
		$captureJob->setMetadata([
			'username' => $data_username,
			'basename' => $basename,
			'capture_filename' => $capture_filename,
			'stream_id' => $data_id
		]);
		$captureJob->save();

		// send internal webhook for capture start
		TwitchHelper::webhook([
			'action' => 'start_capture',
			'vod' => $this->vod
		]);

		// chat capture
		if (TwitchConfig::cfg('chat_dump') && $this->realm == 'twitch') {

			$chat_cmd = [];

			// test
			// $chat_cmd[] = 'screen';
			// $chat_cmd[] = '-S';
			// $chat_cmd[] = $basename;

			// $chat_cmd[] = 'python';
			// $chat_cmd[] = __DIR__ . '/Utilities/twitch-chat.py';
			$chat_cmd[] = 'node';
			$chat_cmd[] = __DIR__ . '/Utilities/twitch-chat-dumper/index.js';

			$chat_cmd[] = '--channel';
			$chat_cmd[] = $this->vod->streamer_login;

			$chat_cmd[] = '--userid';
			$chat_cmd[] = $this->vod->streamer_id;

			$chat_cmd[] = '--date';
			$chat_cmd[] = $data_started;

			$chat_cmd[] = '--output';
			$chat_cmd[] = $chat_filename;

			TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "automator", "Starting chat dump with filename " . basename($chat_filename), ['download-capture' => $data_username, 'cmd' => implode(' ', $chat_cmd)]);

			// $chat_process = Process::fromShellCommandline( implode(" ", $cmd) );
			$chat_process = new Process($chat_cmd, null, null, null, null);
			$chat_process->setTimeout(null);
			$chat_process->setIdleTimeout(null);

			// these don't seem to work and i don't know what good they do so i'll just comment these out
			/*
			try {
				$chat_process->setTty(true);
			} catch (\Throwable $th) {
				TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "automator", "TTY not supported", ['download-capture' => $data_username]);
			}

			if ($chat_process->isTty()) {
				TwitchHelper::logAdvanced(TwitchHelper::LOG_SUCCESS, "automator", "TTY enabled", ['download-capture' => $data_username]);
			}

			if ($chat_process->isPtySupported()) {
				$chat_process->setPty(true);
				TwitchHelper::logAdvanced(TwitchHelper::LOG_SUCCESS, "automator", "PTY enabled", ['download-capture' => $data_username]);
			} else {
				TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "automator", "PTY not supported", ['download-capture' => $data_username]);
			}
			*/


			$chat_process->start();

			// $chat_pidfile = TwitchHelper::$pids_folder . DIRECTORY_SEPARATOR . 'chatdump_' . $data_username . '.pid';
			// file_put_contents($chat_pidfile, $chat_process->getPid());
			$chatJob = TwitchAutomatorJob::create("chatdump_{$basename}");
			$chatJob->setPid($chat_process->getPid());
			$chatJob->setProcess($chat_process);
			$chatJob->setMetadata([
				'username' => $data_username,
				'basename' => $basename,
				'chat_filename' => $chat_filename
			]);
			$chatJob->save();

			TwitchHelper::clearLog("chatdump_{$basename}_stdout.{$tries}");
			TwitchHelper::clearLog("chatdump_{$basename}_stderr.{$tries}");
			TwitchHelper::appendLog("chatdump_{$basename}_stdout.{$tries}", implode(" ", $chat_cmd));
			TwitchHelper::appendLog("chatdump_{$basename}_stderr.{$tries}", implode(" ", $chat_cmd));
		} else {
			$chat_process = null;
		}

		// $time_start = time();
		$stream_paused_ticks = 0;
		$stream_is_paused = false;
		$current_ad_start = null;
		$capture_start = time();
		// $vod = $this->vod;

		$chunks_missing = 0;

		TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "automator", "Using process wait method " . TwitchConfig::cfg('process_wait_method', 1), ['download-capture' => $data_username]);

		if (TwitchConfig::cfg('process_wait_method', 1) == 1) {

			// wait loop until it's done
			$process->wait(function ($type, $buffer) use ($process, $basename, $tries, $data_username, $chat_process, &$chunks_missing, &$current_ad_start, $capture_start, &$stream_is_paused, &$stream_paused_ticks) {

				// check timeout of chat dump
				if (TwitchConfig::cfg('chat_dump') && isset($chat_process)) {
					if ($chat_process->isRunning()) {
						$chat_process->checkTimeout();
						// if( !$chat_process->getIncrementalOutput() ){
						// 	TwitchHelper::log( TwitchHelper::LOG_DEBUG, "No chat output in chat dump", ['download-capture' => $data_username] );
						// }
					} else {
						TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "automator", "Chat dump enabled but not running", ['download-capture' => $data_username]);
					}
				}

				// get stream resolution
				preg_match("/stream:\s([0-9_a-z]+)\s/", $buffer, $matches);
				if ($matches) {
					$this->stream_resolution = $matches[1];
					TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "automator", "Stream resolution for {$basename}: {$this->stream_resolution}", ['download-capture' => $data_username]);
				}

				// stream stop
				if (strpos($buffer, "404 Client Error") !== false) {
					TwitchHelper::logAdvanced(TwitchHelper::LOG_WARNING, "automator", "Chunk 404'd for {$basename} ({$chunks_missing}/100)!", ['download-capture' => $data_username]);
					$chunks_missing++;
					if ($chunks_missing >= 100) {
						TwitchHelper::logAdvanced(TwitchHelper::LOG_WARNING, "automator", "Too many 404'd chunks for {$basename}, stopping!", ['download-capture' => $data_username]);
						$process->stop();
					}
				}

				// stream not found
				if (strpos($buffer, "Waiting for streams") !== false) {
					TwitchHelper::logAdvanced(TwitchHelper::LOG_WARNING, "automator", "No streams found for {$basename}, retrying...", ['download-capture' => $data_username]);
				}

				// stream error
				if (strpos($buffer, "403 Client Error") !== false) {
					TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "automator", "Chunk 403'd for {$basename}!", ['download-capture' => $data_username]);
				}

				// ad removal
				if (strpos($buffer, "Will skip ad segments") !== false) {
					TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "automator", "Capturing of {$basename}, will try to remove ads!", ['download-capture' => $data_username]);
					$current_ad_start = time();
				}

				if ($stream_paused_ticks >= 30) {
					if ($stream_paused_ticks % 5 == 0) {
						TwitchHelper::logAdvanced(TwitchHelper::LOG_WARNING, "automator", "Stream is paused for {$stream_paused_ticks} ticks for {$basename}!", ['download-capture' => $data_username]);
					}
					if ($stream_paused_ticks >= 300) {
						TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "automator", "Stream reached {$stream_paused_ticks} ticks for {$basename}, aborting capture!", ['download-capture' => $data_username]);
						$process->stop();
					}
				}

				if ($stream_is_paused) {
					$stream_paused_ticks++;
				}

				// $adbreak_file = $this->vod->directory . DIRECTORY_SEPARATOR . $this->vod->basename . '.adbreak';

				/** @todo: this gets stuck for some reason, get streamlink devs to fix this */
				if (strpos($buffer, "Filtering out segments and pausing stream output") !== false) {
					TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "automator", "Pausing capture for {$basename} due to ad segment!", ['download-capture' => $data_username]);
					$current_ad_start = time();
					$stream_is_paused = true;
					// file_put_contents($adbreak_file, $current_ad_start);
				}

				if (strpos($buffer, "Resuming stream output") !== false) {
					$ad_length = isset($current_ad_start) ? time() - $current_ad_start : -1;
					$time_offset = time() - $capture_start - $ad_length;
					$stream_is_paused = false;
					$stream_paused_ticks = 0;
					TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "automator", "Resuming capture for {$basename} due to ad segment, {$ad_length}s @ {$time_offset}s!", ['download-capture' => $data_username]);
					// if(file_exists($adbreak_file)){
					// 	unlink($adbreak_file);
					// }
					/*
					if( isset($current_ad_start) ){
						$vod->addAdvertisement([
							'start' => $current_ad_start,
							'end' => $current_ad_start - time()
						]);
					}
					*/
				}

				if (strpos($buffer, "bad interpreter: No such file or directory") !== false) {
					TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "automator", "Fatal error with streamlink, please check logs", ['download-capture' => $data_username]);
				}

				// log output
				if (Process::ERR === $type) {
					TwitchHelper::appendLog("streamlink_{$basename}_stderr.{$tries}", $buffer);
				} else {
					TwitchHelper::appendLog("streamlink_{$basename}_stdout.{$tries}", $buffer);
				}
			});
		} else {

			// yes this is a copypaste, not sure which one to go with yet
			while (true) {

				// check if capture is running, and quit if it isn't
				if (!$process->isRunning()) {
					TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "automator", "Streamlink exited for {$data_username}, breaking loop", ['download-capture' => $data_username]);
					break;
				}

				// check timeout of capture
				try {
					$process->checkTimeout();
				} catch (\Throwable $th) {
					TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "automator", "Process timeout: " . $th->getMessage(), ['download-capture' => $data_username]);
				}

				$cmd_stdout_buffer = $process->getIncrementalOutput();
				$cmd_stderr_buffer = $process->getIncrementalErrorOutput();

				$process->addOutput("TwitchAutomator pad (" . date("Y-m-d H:i:s") . ")");

				// get stream resolution
				preg_match("/stream:\s([0-9_a-z]+)\s/", $cmd_stdout_buffer, $matches);
				if ($matches) {
					$this->stream_resolution = $matches[1];
					TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "automator", "Stream resolution for {$basename}: {$this->stream_resolution}", ['download-capture' => $data_username]);
				}

				// stream stop
				if (strpos($cmd_stdout_buffer, "404 Client Error") !== false) {
					TwitchHelper::logAdvanced(TwitchHelper::LOG_WARNING, "automator", "Chunk 404'd for {$basename} ({$chunks_missing}/100)!", ['download-capture' => $data_username]);
					$chunks_missing++;
					if ($chunks_missing >= 100) {
						TwitchHelper::logAdvanced(TwitchHelper::LOG_WARNING, "automator", "Too many 404'd chunks for {$basename}, stopping!", ['download-capture' => $data_username]);
						$process->stop();
					}
				}

				// stream not found
				if (strpos($cmd_stdout_buffer, "Waiting for streams") !== false) {
					TwitchHelper::logAdvanced(TwitchHelper::LOG_WARNING, "automator", "No streams found for {$basename}, retrying...", ['download-capture' => $data_username]);
				}

				// stream error
				if (strpos($cmd_stdout_buffer, "403 Client Error") !== false) {
					TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "automator", "Chunk 403'd for {$basename}!", ['download-capture' => $data_username]);
				}

				// ad removal
				if (strpos($cmd_stdout_buffer, "Will skip ad segments") !== false) {
					TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "automator", "Capturing of {$basename}, will try to remove ads!", ['download-capture' => $data_username]);
					$current_ad_start = time();
				}

				if ($stream_paused_ticks >= 30) {
					if ($stream_paused_ticks % 5 == 0) {
						TwitchHelper::logAdvanced(TwitchHelper::LOG_WARNING, "automator", "Stream is paused for {$stream_paused_ticks} ticks for {$basename}!", ['download-capture' => $data_username]);
					}
					if ($stream_paused_ticks >= 300) {
						TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "automator", "Stream reached {$stream_paused_ticks} ticks for {$basename}, aborting capture!", ['download-capture' => $data_username]);
						$process->stop();
					}
				}

				if ($stream_is_paused) {
					$stream_paused_ticks++;
				}

				// $adbreak_file = $this->vod->directory . DIRECTORY_SEPARATOR . $this->vod->basename . '.adbreak';

				/** @todo: this gets stuck for some reason, get streamlink devs to fix this */
				if (strpos($cmd_stdout_buffer, "Filtering out segments and pausing stream output") !== false) {
					TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "automator", "Pausing capture for {$basename} due to ad segment!", ['download-capture' => $data_username]);
					$current_ad_start = time();
					$stream_is_paused = true;
					file_put_contents($this->vod->path_adbreak, $current_ad_start);
				}

				if (strpos($cmd_stdout_buffer, "Resuming stream output") !== false) {
					$ad_length = isset($current_ad_start) ? time() - $current_ad_start : -1;
					$time_offset = time() - $capture_start - $ad_length;
					$stream_paused_ticks = 0;
					$stream_is_paused = false;
					TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "automator", "Resuming capture for {$basename} due to ad segment, {$ad_length}s @ {$time_offset}s!", ['download-capture' => $data_username]);
					if (file_exists($this->vod->path_adbreak)) {
						unlink($this->vod->path_adbreak);
					}
					/*
					if( isset($current_ad_start) ){
						$vod->addAdvertisement([
							'start' => $current_ad_start,
							'end' => $current_ad_start - time()
						]);
					}
					*/
				}

				if (strpos($cmd_stdout_buffer, "bad interpreter: No such file or directory") !== false) {
					TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "automator", "Fatal error with streamlink, please check logs", ['download-capture' => $data_username]);
				}

				// generate m3u8 file
				$this->vod->generatePlaylistFile();

				// check timeout of chat dump
				if (TwitchConfig::cfg('chat_dump') && isset($chat_process)) {

					try {
						$chat_process->checkTimeout();
					} catch (\Throwable $th) {
						TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "automator", "Process timeout: " . $th->getMessage(), ['download-capture' => $data_username]);
					}

					$chat_process->addOutput("pad (" . date("Y-m-d H:i:s") . ")");

					$cmd_chatdump_stdout_buffer = $chat_process->getIncrementalOutput();
					$cmd_chatdump_stderr_buffer = $chat_process->getIncrementalErrorOutput();
					if ($cmd_chatdump_stdout_buffer) TwitchHelper::appendLog("chatdump_{$basename}_stdout.{$tries}", $cmd_chatdump_stdout_buffer);
					if ($cmd_chatdump_stderr_buffer) TwitchHelper::appendLog("chatdump_{$basename}_stderr.{$tries}", $cmd_chatdump_stderr_buffer);
				}


				if ($cmd_stdout_buffer) TwitchHelper::appendLog("streamlink_{$basename}_stdout.{$tries}", $cmd_stdout_buffer);
				if ($cmd_stderr_buffer) TwitchHelper::appendLog("streamlink_{$basename}_stderr.{$tries}", $cmd_stderr_buffer);

				sleep(10);
			}
		}

		TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "automator", "Finished capture with filename " . basename($capture_filename), ['download-capture' => $data_username]);

		if (TwitchConfig::cfg('chat_dump')) {
			// gracefully kill chat dump
			TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "automator", "Ending chat dump with filename " . basename($chat_filename), ['download-capture' => $data_username]);

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
			if ($chatJob) {
				$chatJob->clear();
			}
			// TwitchHelper::appendLog("chatdump_" . $basename . "_stdout." . $int, $chat_process->getOutput() );
			// TwitchHelper::appendLog("chatdump_" . $basename . "_stderr." . $int, $chat_process->getErrorOutput() );
			TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "automator", "Ended chat dump with filename " . basename($chat_filename), ['download-capture' => $data_username]);
		}

		// download with youtube-dl if streamlink fails, shouldn't be required anymore
		if (mb_strpos($process->getOutput(), '410 Client Error') !== false) {

			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "automator", "410 error for {$basename}");

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
			$yt_cmd[] = implode('/', TwitchConfig::getChannelByLogin($this->getLogin())->quality ?: []);

			// verbose
			if (TwitchConfig::cfg('debug', false) || TwitchConfig::cfg('app_verbose', false)) {
				$yt_cmd[] = '-v';
			}

			// stream url
			$yt_cmd[] = $stream_url;

			$yt_process = new Process($yt_cmd, null, null, null, null);
			$yt_process->run();

			TwitchHelper::appendLog("youtubedl_{$basename}_" . time() . "_stdout", "$ " . implode(" ", $yt_cmd) . "\n" . $yt_process->getOutput());
			TwitchHelper::appendLog("youtubedl_{$basename}_" . time() . "_stderr", "$ " . implode(" ", $yt_cmd) . "\n" . $yt_process->getErrorOutput());
		}

		if (mb_strpos($process->getOutput(), 'already exists, use') !== false) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_FATAL, "automator", "Unexplainable, " . basename($capture_filename) . " could not be captured due to existing file already.", ['download-capture' => $data_username]);
		}

		// get stream resolution
		preg_match("/stream:\s([0-9_a-z]+)\s/", $process->getOutput(), $matches);
		if ($matches) {
			$this->stream_resolution = $matches[1];
		}

		if (!$process->getOutput()) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "automator", "No streamlink output from job " . basename($capture_filename) . ".", ['download-capture' => $data_username]);
		}

		// delete pid file
		// if (file_exists($pidfile)) unlink($pidfile);
		if ($captureJob) $captureJob->clear();

		if (!file_exists($capture_filename)) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "automator", "File " . basename($capture_filename) . " never got created.", ['download-capture' => $data_username]);
			return false;
		}

		if (filesize($capture_filename) == 0) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "automator", "File " . basename($capture_filename) . " never got any data.", ['download-capture' => $data_username]);
			return false;
		}

		return $capture_filename;
	}

	/**
	 * Mux .ts to .mp4, for better compatibility.
	 * 
	 * @todo The arguments for this function is stupid, rewrite
	 * @param string $basename Basename of input file
	 * @return string Converted filename
	 */
	public function convert($basename)
	{

		$container_ext = TwitchConfig::cfg('vod_container', 'mp4');

		$folder_base = TwitchHelper::vodFolder($this->getLogin());

		$capture_filename 	= $folder_base . DIRECTORY_SEPARATOR . $basename . '.ts';

		$converted_filename = $folder_base . DIRECTORY_SEPARATOR . $basename . '.' . $container_ext;

		// $data_username = $this->vod->streamer_name;
		$data_id = $this->getVodID();
		$data_username = $this->getUsername();

		$int = 1;

		while (file_exists($converted_filename)) {
			// $this->errors[] = 'File exists while converting, making a new name';
			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "automator", "File exists while converting, making a new name for {$basename}, attempt #{$int}", ['download-convert' => $data_username]);
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

		$this->vod = $this->vod->refreshJSON();
		$this->vod->dt_conversion_started = new \DateTime();
		$this->vod->saveJSON('dt_conversion_started set');

		TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "automator", "Starting conversion of " . basename($capture_filename) . " to " . basename($converted_filename), ['download-convert' => $data_username]);

		$process = new Process($cmd, dirname($capture_filename), null, null, null);
		$process->start();

		// create pidfile
		$convertJob = TwitchAutomatorJob::create("convert_{$basename}");
		$convertJob->setPid($process->getPid());
		$convertJob->setProcess($process);
		$convertJob->setMetadata([
			'capture_filename' => $capture_filename,
			'converted_filename' => $converted_filename,
		]);
		$convertJob->save();

		TwitchHelper::webhook([
			'action' => 'start_convert',
			'vod' => $this->vod,
		]);

		// wait until process is done
		$process->wait();

		// remove pidfile
		$convertJob->clear();
		//if (file_exists($pidfile)) unlink($pidfile);

		TwitchHelper::appendLog("ffmpeg_convert_{$basename}_" . time() . "_stdout", "$ " . implode(" ", $cmd) . "\n" . $process->getOutput());
		TwitchHelper::appendLog("ffmpeg_convert_{$basename}_" . time() . "_stderr", "$ " . implode(" ", $cmd) . "\n" . $process->getErrorOutput());

		if (strpos($process->getErrorOutput(), "Packet corrupt") !== false || strpos($process->getErrorOutput(), "Non-monotonous DTS in output stream") !== false) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "automator", "Found corrupt packets when converting " . basename($capture_filename) . " to " . basename($converted_filename), ['download-convert' => $data_username]);
		}

		if (file_exists($converted_filename) && filesize($converted_filename) > 0) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_SUCCESS, "automator", "Finished conversion of " . basename($capture_filename) . " to " . basename($converted_filename), ['download-convert' => $data_username]);
		} else {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "automator", "Failed conversion of " . basename($capture_filename) . " to " . basename($converted_filename), ['download-convert' => $data_username]);
			return false;
		}

		return $converted_filename;
	}
}
