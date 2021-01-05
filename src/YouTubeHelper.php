<?php

namespace App;

use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\Process;

// declare(ticks=1); // test

// Because you're not a G Suite user, you can only make your app available to external (general audience) users.
// thanks youtube for ruining this project, requiring user accounts to authenticate instead of just an api key and secret

class YouTubeHelper extends TwitchHelper
{


    public $realm = 'youtube';

    /** @var \GuzzleHttp\Client */
	public static $yt_guzzler = null;

    public static $streamerDbPath = __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "cache" . DIRECTORY_SEPARATOR . "youtube_streamers.json";

    public static function getChannelId(string $username)
    {

        if (file_exists(self::$streamerDbPath)) {

            $json_streamers = json_decode(file_get_contents(self::$streamerDbPath), true);

            if ($json_streamers && isset($json_streamers[$username])) {
                self::logAdvanced(self::LOG_DEBUG, "helper", "Fetched channel data from cache for {$username}");
                if (!isset($json_streamers[$username]['_updated']) || time() > $json_streamers[$username]['_updated'] + 2592000) {
                    self::logAdvanced(self::LOG_INFO, "helper", "Channel data in cache for {$username} is too old, proceed to updating!");
                } else {
                    return $json_streamers[$username];
                }
            }
        } else {
            $json_streamers = [];
        }


        /*
		$access_token = self::getAccessToken();

		if (!$access_token) {
			throw new \Exception('Fatal error, could not get access token for channel id request');
			return false;
        }
        */

        $query = [];
        $query['part'] = 'snippet,contentDetails,statistics';
        $query['forUsername'] = $username;
        $query['key'] = TwitchConfig::cfg('youtube_api_client_id');

        $response = self::$yt_guzzler->request('GET', 'channels', [
            'query' => $query
        ]);

        $server_output = $response->getBody()->getContents();
        $json = json_decode($server_output, true);

        if (!$json["items"]) {
            self::logAdvanced(self::LOG_ERROR, "helper", "Failed to fetch channel data for {$username}: {$server_output}");
            return false;
        }

        $data = $json["items"][0];

        $data['_updated'] = time();

        $json_streamers[$username] = $data;
        file_put_contents(self::$streamerDbPath, json_encode($json_streamers));

        self::logAdvanced(self::LOG_INFO, "helper", "Fetched channel data online for {$username}");

        return $data["snippet"]["title"];
    }

    /**
	 * Get Twitch channel username from ID
	 *
	 * @param string $id
	 * @return string|false Username
	 */
	public static function getChannelUsername(string $user_id)
	{
		$data = self::getChannelData($user_id);
		if (!$data) return false;
		return $data["title"];
	}

    /**
     * Get Twitch channel data from username or id
     *
     * @param string $user_id
     * @return array
     */
    public static function getChannelData(string $user_id)
    {

        if (file_exists(self::$streamerDbPath)) {

            $json_streamers = json_decode(file_get_contents(self::$streamerDbPath), true);

            if ($json_streamers && isset($json_streamers[$user_id])) {
                self::logAdvanced(self::LOG_DEBUG, "helper", "Fetched channel data from cache for {$user_id}");
                if (!isset($json_streamers[$user_id]['_updated']) || time() > $json_streamers[$user_id]['_updated'] + 2592000) {
                    self::logAdvanced(self::LOG_INFO, "helper", "Channel data in cache for {$user_id} is too old, proceed to updating!");
                } else {
                    return $json_streamers[$user_id];
                }
            }
        } else {
            $json_streamers = [];
        }


        /*
		$access_token = self::getAccessToken();

		if (!$access_token) {
			throw new \Exception('Fatal error, could not get access token for channel id request');
			return false;
        }
        */

        $query = [];
        $query['part'] = 'snippet,contentDetails,statistics';
        $query['id'] = $user_id;
        $query['key'] = TwitchConfig::cfg('youtube_api_client_id');

        $response = self::$yt_guzzler->request('GET', 'channels', [
            'query' => $query
        ]);

        $server_output = $response->getBody()->getContents();
        $json = json_decode($server_output, true);

        if (!$json["items"]) {
            self::logAdvanced(self::LOG_ERROR, "helper", "Failed to fetch channel data for {$user_id}: {$server_output}");
            return false;
        }

        $data = $json["items"][0];

        $data['_updated'] = time();

        $json_streamers[$user_id] = $data;
        file_put_contents(self::$streamerDbPath, json_encode($json_streamers));

        self::logAdvanced(self::LOG_INFO, "helper", "Fetched channel data online for {$user_id}");

        return $data;
    }

    /**
	 * Return videos for a streamer id
	 *
	 * @param string $streamer_id
	 * @return array|false
	 */
	public static function getVideos(string $streamer_id)
	{

		if (!$streamer_id) {
			self::logAdvanced(self::LOG_ERROR, "helper", "No streamer id supplied for videos fetching");
			throw new \Exception("No streamer id supplied for videos fetching");
			return false;
        }
        
        $channelData = self::getChannelData($streamer_id);

        $playlist_id = $channelData['contentDetails']['relatedPlaylists']['uploads'];

		try {
			$response = self::$yt_guzzler->request('GET', 'playlistItems', [
				'query' => [
                    'part' => 'snippet,contentDetails',
                    'playlistId' => $playlist_id
                ]
			]);
		} catch (\Throwable $th) {
			self::logAdvanced(self::LOG_FATAL, "helper", "Tried to get videos for {$streamer_id} but server returned: " . $th->getMessage());
			return false;
		}

		$server_output = $response->getBody()->getContents();
		$json = json_decode($server_output, true);

		if (!$json['items']) {
			self::logAdvanced(self::LOG_ERROR, "helper", "No videos found for user id {$streamer_id}");
			return false;
		}

		self::logAdvanced(self::LOG_INFO, "helper", "Querying videos for streamer id {$streamer_id}");

		return $json['items'] ?: false;
	}

}

YouTubeHelper::$yt_guzzler = new \GuzzleHttp\Client([
    'base_uri' => 'https://youtube.googleapis.com/youtube/v3/',
    'headers' => [
        // 'Client-ID' => TwitchConfig::cfg('youtube_api_client_id'),
        'Content-Type' => 'application/json',
        'Accept' => 'application/json',
        'Authorization' => 'Bearer ' . YouTubeHelper::getAccessToken(),
    ]
]);
