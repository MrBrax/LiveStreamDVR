<?php

declare(strict_types=1);

namespace App;

use DateTime;

class TwitchChannel
{

    public ?string $username = null;
    public ?string $userid = null;
    public ?string $login = null;
    public ?string $display_name = null;
    public ?string $description = null;
    public ?string $profile_image_url = null;
    public ?bool $is_live = false;
    public ?bool $is_converting = false;
    public ?TwitchVOD $current_vod = null;
    public ?array $current_game = null;
    public ?int $current_duration = null;
    public ?array $quality = [];
    public ?\DateTime $subbed_at = null;
    public ?\DateTime $expires_at = null;

    public array $vods_list = [];
    public array $vods_raw = [];
    public int $vods_size = 0;

    public array $channel_data = [];
    public array $config = [];

    private static function loadAbstract($streamer_id)
    {

        $api = true; // todo: fix

        $channel = new self();

        $channel->userid = $streamer_id;

        /*
        if (!$channel->userid || !is_numeric($channel->userid)) {
            // TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "helper", "Could not get channel id in channel for {$username}");
            throw new \Exception("Could not get channel id in channel: {$username} => {$channel->userid}");
            return false;
        }
        */

        $channel_data = self::getChannelData($channel->userid);

        $channel_login = $channel_data['login'];

        $config = [];
        foreach(TwitchConfig::$channels_config as $channel_config){
            if($channel_config['login'] == $channel_data['login']) $config = $channel_config;
        }

        if (!$config) {
            throw new \Exception("Streamer not found in config: {$channel_login}");
            return false;
        }

        if (!isset($channel_data['login'])) {
            throw new \Exception("Streamer data could not be fetched: {$channel_login}");
            return false;
        }

        $channel->channel_data = $channel_data;
        $channel->config       = $config;

        // $channel->userid               = (int)$channel->channel_data['id'];
        $channel->username             = $channel->channel_data['login'];
        $channel->login                = $channel->channel_data['login'];
        $channel->display_name         = $channel->channel_data['display_name'];
        $channel->description          = $channel->channel_data['description'];
        $channel->profile_image_url    = $channel->channel_data['profile_image_url'];
        $channel->quality              = isset($config['quality']) ? $config['quality'] : "best";
        $channel->match                = isset($config['match']) ? $config['match'] : [];
        $channel->no_capture           = isset($config['no_capture']) ? $config['no_capture'] : [];

        $subfile = TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . "subs.json";
        if (file_exists($subfile)) {
            $sub_data = json_decode(file_get_contents($subfile), true);
            if (isset($sub_data[$channel->display_name])) {
                if (isset($sub_data[$channel->display_name]['subbed_at']))
                    $channel->subbed_at = \DateTime::createFromFormat(TwitchHelper::DATE_FORMAT, $sub_data[$channel->display_name]['subbed_at']);

                if (isset($sub_data[$channel->display_name]['expires_at']))
                    $channel->expires_at = \DateTime::createFromFormat(TwitchHelper::DATE_FORMAT, $sub_data[$channel->display_name]['expires_at']);
            }
        }

        $channel->parseVODs($api);

        return $channel;

    }

    public static function loadFromId( $streamer_id ){
        return self::loadAbstract( $streamer_id ); // $channel;
    }

    public static function loadFromLogin( string $login ){
        return self::loadAbstract( self::channelIdFromLogin($login) ); // $channel;
    }

    public static function channelIdFromLogin($login){
        
        $cache_json = file_exists(TwitchConfig::$streamerCachePath) ? json_decode(file_get_contents(TwitchConfig::$streamerCachePath), true) : [];
        
        if ($cache_json) {
			foreach ($cache_json as $user_id => $data) {
				if ($data['login'] == $login) {
					return (string)$user_id;
				}
			}
		}

        return false;

    }

    public static function channelLoginFromId($streamer_id){
        
        $cache_json = file_exists(TwitchConfig::$streamerCachePath) ? json_decode(file_get_contents(TwitchConfig::$streamerCachePath), true) : [];
        
        if ($cache_json) {
			foreach ($cache_json as $user_id => $data) {
				if ($data['id'] == $streamer_id) {
					return (string)$data["login"];
				}
			}
		}

        return false;

    }

    private static function getChannelData($streamer_id)
	{

		if (!is_numeric($streamer_id)) {
			throw new \Exception("Non-numeric passed to getChannelData ({$streamer_id})");
			return false;
		}

        // first, check cache
		if (file_exists(TwitchConfig::$streamerCachePath)) {

			$json_streamers = json_decode(file_get_contents(TwitchConfig::$streamerCachePath), true);

			if ($json_streamers && isset($json_streamers[$streamer_id])) {
				
                TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "helper", "Fetched channel data from cache for {$streamer_id} ({$json_streamers[$streamer_id]['display_name']})");
				
                // check if too old, continue if true
                if (!isset($json_streamers[$streamer_id]['_updated']) || time() > $json_streamers[$streamer_id]['_updated'] + 2592000) {
					TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "helper", "Channel data in cache for {$streamer_id} is too old, proceed to updating!");
				} else {
					return $json_streamers[$streamer_id];
				}

			}

		} else {

			$json_streamers = [];

		}

		$access_token = TwitchHelper::getAccessToken();

		if (!$access_token) {
			throw new \Exception('Fatal error, could not get access token for channel id request');
			return false;
		}

		$query = [];
		$query['id'] = $streamer_id;

		try {
			$response = TwitchHelper::$guzzler->request('GET', '/helix/users', [
				'query' => $query
			]);
		} catch (\Throwable $th) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_FATAL, "helper", "getChannelData for {$streamer_id} errored: " . $th->getMessage());
			return false;
		}

		$server_output = $response->getBody()->getContents();
		$json = json_decode($server_output, true);

		if (!$json["data"]) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "helper", "Failed to fetch channel data for {$streamer_id}: {$server_output}");
			return false;
		}

		$data = $json["data"][0];

		$data["_updated"] = time();

		if (isset($data["profile_image_url"]) && $data["profile_image_url"]) {
			$client = new \GuzzleHttp\Client;
			$avatar_ext = pathinfo($data["profile_image_url"], PATHINFO_EXTENSION);
			$avatar_output = TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . "channel" . DIRECTORY_SEPARATOR . "avatar" . DIRECTORY_SEPARATOR . $data["display_name"] . "." . $avatar_ext;
			$avatar_final = TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . "channel" . DIRECTORY_SEPARATOR . "avatar" . DIRECTORY_SEPARATOR . $data["display_name"] . ".webp";
			try {
				$response = $client->request("GET", $data["profile_image_url"], [
					"query" => $query,
					"sink" => $avatar_output
				]);
			} catch (\Throwable $th) {
				TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "helper", "Avatar fetching for {$streamer_id} errored: " . $th->getMessage());
			}
			if (file_exists($avatar_output)) {
				$data["cache_avatar"] = $data["display_name"] . "." . $avatar_ext;
				if (TwitchHelper::path_ffmpeg()) {
					TwitchHelper::exec([TwitchHelper::path_ffmpeg(), "-i", $avatar_output, "-y", $avatar_final]);
					$data["cache_avatar"] = $data["display_name"] . ".webp";
				}
			}
		}

		$json_streamers[$streamer_id] = $data;
		file_put_contents(TwitchConfig::$streamerCachePath, json_encode($json_streamers));

		TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "helper", "Fetched channel data online for {$streamer_id}");

		return $data;
	}

    /**
     * Load
     *
     * @param string $username
     * @return void
     */
    /*
    public function load(string $username, $api = false)
    {

        $this->userid = TwitchHelper::getChannelId($username);

        if (!$this->userid || !is_numeric($this->userid)) {
            // TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "helper", "Could not get channel id in channel for {$username}");
            throw new \Exception("Could not get channel id in channel: {$username} => {$this->userid}");
            return false;
        }

        $channel_data = TwitchHelper::getChannelData($this->userid);

        $config = TwitchConfig::getStreamer($username);

        if (!$config) {
            throw new \Exception("Streamer not found in config: {$username}");
            return false;
        }

        if (!isset($channel_data['login'])) {
            throw new \Exception("Streamer data could not be fetched: {$username}");
            return false;
        }

        $this->channel_data = $channel_data;
        $this->config       = $config;

        // $this->userid               = (int)$this->channel_data['id'];
        $this->username             = $this->channel_data['login'];
        $this->login                = $this->channel_data['login'];
        $this->display_name         = $this->channel_data['display_name'];
        $this->description          = $this->channel_data['description'];
        $this->profile_image_url    = $this->channel_data['profile_image_url'];
        $this->quality              = isset($config['quality']) ? $config['quality'] : "best";
        $this->match                = isset($config['match']) ? $config['match'] : [];
        $this->no_capture           = isset($config['no_capture']) ? $config['no_capture'] : [];

        $subfile = TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . "subs.json";
        if (file_exists($subfile)) {
            $sub_data = json_decode(file_get_contents($subfile), true);
            if (isset($sub_data[$this->display_name])) {
                if (isset($sub_data[$this->display_name]['subbed_at']))
                    $this->subbed_at = \DateTime::createFromFormat(TwitchHelper::DATE_FORMAT, $sub_data[$this->display_name]['subbed_at']);

                if (isset($sub_data[$this->display_name]['expires_at']))
                    $this->expires_at = \DateTime::createFromFormat(TwitchHelper::DATE_FORMAT, $sub_data[$this->display_name]['expires_at']);
            }
        }

        $this->parseVODs($api);
    }
    */

    public function getFolder()
    {
        return TwitchHelper::vodFolder($this->username);
    }

    /**
     * Load and add each vod to channel
     *
     * @return void
     */
    private function parseVODs($api = false)
    {

        $this->vods_raw = glob(TwitchHelper::vodFolder($this->display_name) . DIRECTORY_SEPARATOR . $this->display_name . "_*.json");

        foreach ($this->vods_raw as $k => $v) {

            $vodclass = new TwitchVOD();
            if (!$vodclass->load($v, $api)) {
                continue;
            }

            // if ($vodclass->is_recording && !$vodclass->is_converting) {
            if ($vodclass->is_capturing) {
                $this->is_live = true;
                $this->current_vod = $vodclass;
                $this->current_game = $vodclass->getCurrentGame();
                $this->current_duration = $vodclass->getDurationLive() ?: null;
            }

            if ($vodclass->is_converting) {
                $this->is_converting = true;
            }

            if ($vodclass->segments) {
                foreach ($vodclass->segments as $s) {
                    $this->vods_size += $s['filesize'];
                }
            }

            $this->vods_list[] = $vodclass;
        }
    }

    /**
     * Match vods online
     *
     * @return void
     */
    public function matchVods()
    {
        foreach ($this->vods_list as $vod) {
            if (!$vod->is_finalized) continue;
            if ($vod->matchProviderVod()) {
                $vod->saveJSON('matched vod');
            }
        }
    }

    /**
     * Check vods online
     *
     * @return boolean Is a vod deleted?
     */
    public function checkValidVods()
    {

        $list = [];

        $is_a_vod_deleted = false;

        foreach ($this->vods_list as $vod) {

            if (!$vod->is_finalized) continue;

            $isvalid = $vod->checkValidVod(true);

            $list[$vod->basename] = $isvalid;

            if (!$isvalid) {
                $is_a_vod_deleted = true;
                // echo '<!-- deleted: ' . $vod->basename . ' -->';
            }
        }

        return $is_a_vod_deleted;
    }

    public function getPlaylists()
    {

        $videos = TwitchHelper::getVideos($this->userid);

        $data = [];

        foreach ($videos as $i => $video) {
            $video_id = $video['id'];
            $video_url = $video['url'];
            $playlist_urls = [];

            $stream_urls_raw = TwitchHelper::exec([TwitchHelper::path_streamlink(), '--json', '--url', $video_url, '--stream-url']);
            $stream_urls = json_decode($stream_urls_raw, true);

            if ($stream_urls && isset($stream_urls['streams'])) {
                $entry = array_merge($video, [
                    "playlist_urls" => $stream_urls['streams']
                ]);
                $data[(string)$video_id] = $entry;
            } else {
                TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "channel", "No videos api response for {$this->username}.", ['output' => $stream_urls_raw]);
            }

            if ($i > 5) break;
        }

        return $data;
    }

    public function getSubscription()
    {

        $subs = TwitchHelper::getSubs();

        if (!$subs['data']) return false;

        foreach ($subs['data'] as $sub) {
            if ($this->userid == $sub['condition']['broadcaster_user_id']) {
                return $sub;
            }
        }

        return false;
    }
}
