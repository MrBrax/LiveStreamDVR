<?php

namespace App;

use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\Process;

// declare(ticks=1); // test

class YouTubeVOD extends TwitchVOD
{

    public ?string $youtube_vod_id;

    /*
    public function setupUserData()
    {
        
        $s = explode("/", $this->meta['entry']['author']['uri']);
        $this->streamer_id = $s[count($s) - 1];

        $this->streamer_name = YouTubeHelper::getChannelUsername($this->streamer_id);
    }
    */

    public function setupProvider()
	{

    }

    /**
	 * Fetch streamer's videos and try to match this VOD with an archived one.
	 *
	 * @return string|boolean
	 */
	public function matchProviderVod()
	{

		TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "vodclass", "Try to match YouTube vod for {$this->basename}");

        TwitchHelper::logAdvanced(TwitchHelper::LOG_WARNING, "vodclass", "Not implemented");
        /*
		if ($this->youtube_vod_id) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_WARNING, "vodclass", "YouTube vod already matched for {$this->basename}");
			return $this->youtube_vod_id;
		}

		if ($this->is_capturing || $this->is_converting) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_WARNING, "vodclass", "YouTube vod can't match, recording in progress of {$this->basename}");
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
        */

	}
    
}
