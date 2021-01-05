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
    public ?TwitchVOD $current_vod = null;
    public ?array $current_game = null;
    public ?int $current_duration = null;
    public ?array $quality = [];
    public ?\DateTime $subbed_at = null;
    public ?\DateTime $expires_at = null;

    public array $vods_list = [];
    public array $vods_raw = [];
    public int $vods_size = 0;

    /**
     * Load
     *
     * @param string $username
     * @return void
     */
    public function load(string $username)
    {

        $this->userid = TwitchHelper::getChannelId($username);

        if(!$this->userid){
			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "helper", "Could not get channel id in channel for {$username}");
            return false;
        }

        $this->channel_data = TwitchHelper::getChannelData($this->userid);

        $config = TwitchConfig::getStreamer($username);

        // $this->userid               = (int)$this->channel_data['id'];
        $this->username             = $this->channel_data['login'];
        $this->login                = $this->channel_data['login'];
        $this->display_name         = $this->channel_data['display_name'];
        $this->description          = $this->channel_data['description'];
        $this->profile_image_url    = $this->channel_data['profile_image_url'];
        $this->quality              = isset($config['quality']) ? $config['quality'] : "best";
        $this->match                = isset($config['match']) ? $config['match'] : [];

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

        $this->parseVODs();
    }

    public function getFolder()
    {
        return TwitchHelper::vodFolder($this->username);
    }

    /**
     * Load and add each vod to channel
     *
     * @return void
     */
    private function parseVODs()
    {

        $this->vods_raw = glob(TwitchHelper::vodFolder($this->display_name) . DIRECTORY_SEPARATOR . $this->display_name . "_*.json");

        foreach ($this->vods_raw as $k => $v) {

            $vodclass = new TwitchVOD();
            if (!$vodclass->load($v)) continue;

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
}
