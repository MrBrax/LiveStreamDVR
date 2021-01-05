<?php

namespace App;

use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\Process;

use App\YouTubeVOD;

// declare(ticks=1); // test

class TwitchAutomatorYouTube extends TwitchAutomator
{

	public function parsePayload()
	{
		return [];
	}

	/*
	public function basename()
	{
		$id = str_replace(":", "_", $this->payload['entry']['id']);
		$username = $this->payload['entry']['author']['name'];

		$ts = $this->payload['published'];
		$dt = \DateTime::createFromFormat("Y-m-d\TH:i:s\+00:00", $ts);
		$started = $dt->format(TwitchHelper::DATE_FORMAT);

		return $username . '_' . str_replace(':', '_', $started) . '_' . $id;
	}
	*/

	public function getStartDate()
	{

		$ts = $this->payload['updated'];
		$dt = \DateTime::createFromFormat("Y-m-d\TH:i:s.u\+00\:00", $ts); // 2021-01-01T19:35:44.389003649+00:00

		if (!$dt) {
			$ts = $this->payload['entry']['published'];
			$dt = \DateTime::createFromFormat("Y-m-d\TH:i:s\+00\:00", $ts); // 2021-01-01T08:35:07+00:00
		}

		if ($dt) {
			$started = $dt->format(TwitchHelper::DATE_FORMAT);
			return $started;
		} else {
			return false;
		}
	}

	public function streamURL()
	{
		// return "https://www.youtube.com/channel/" . $this->getUserID() . "/live";
		return $this->payload['entry']['link']['@attributes']['href'];
	}

	public function getVodID()
	{
		return str_replace(":", "_", substr($this->payload['entry']['id'], 9));
	}

	public function getUserID()
	{
		$s = explode("/", $this->payload['entry']['author']['uri']);
		return $s[count($s) - 1];
	}

	public function getUsername()
	{
		return $this->payload['entry']['author']['name'];
	}

	public function getTitle()
	{
		if ($this->payload['title'] == 'YouTube video feed') {
			return $this->payload['entry']['title'];
		} else {
			return $this->payload['title'];
		}
	}

	public function handle($data)
	{

		TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "automator", "Handle called (youtube)");

		if (!isset($data['entry'])) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "automator", "No data supplied for handle (youtube)", ['get' => $_GET, 'post' => $_POST, 'data' => $data, 'entry' => $data['entry']]);
			return false;
		}

		// $data_id = str_replace(":", "_", $data['entry']['id']);
		// $data_title = $data['data'][0]['title'];
		// $data_started = $data['data'][0]['started_at'];
		// $data_game_id = $data['data'][0]['game_id'];
		// $data_username = $data['entry']['author']['name'];

		$this->data_cache = $data;

		if (!isset($data['entry'])) {

			$this->end($data);
		} else {

			$this->payload = $data;

			$basename = $this->basename();

			$folder_base = TwitchHelper::vodFolder($this->getUsername());

			if (file_exists($folder_base . DIRECTORY_SEPARATOR . $basename . '.json')) {

				$vodclass = new YouTubeVOD();
				if ($vodclass->load($folder_base . DIRECTORY_SEPARATOR . $basename . '.json')) {

					if ($vodclass->is_finalized) {
						TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "automator", "VOD is finalized, but wanted more info on {$basename}");
					} elseif ($vodclass->is_capturing) {
						$this->updateGame();
					} else {
						TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "automator", "VOD exists but isn't capturing anymore on {$basename}");
					}
				} else {
					TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "automator", "Could not load VOD in handle for {$basename}");
				}
			} else {

				$this->download();
			}
		}
	}
}
