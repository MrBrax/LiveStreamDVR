<?php

namespace App;

// declare(strict_types=1);

use App\TwitchHelper;
use Exception;

use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\Process;

class Chunk
{
    public $chunk_num;
    public $filename;
    public $full_path;
    public $full_url;
    public $duration;
    function __construct()
    {
    }
}

/*
class TwitchPlaylistAutomatorException extends \Throwable {

}
*/

class TwitchPlaylistAutomator
{

    public $username;
    public $output_file;
    public $quality;
    public $user_id;
    public $video_id;
    public $unique_id;
    public $video;

    private $stream_urls;
    private $stream_playlist_url;
    private $stream_playlist_crc;
    private $run_file;
    private $last_deleted_chunk;
    private $removed_chunks;
    private $last_chunk_appended;

    /** @var Chunk[] $chunks_to_append */
    private $chunks_to_append;

    /** @var Chunk[] $chunks */
    private $chunks;

    function __construct()
    {
    }

    private function getPlaylistStreams($video_id)
    {
    }

    public function setup($username, $quality = 'best')
    {
        $this->username = $username;
        // $this->output_file = $output_file;
        $this->quality = $quality;

        $this->user_id = TwitchHelper::getChannelId($username);

        $videos = TwitchHelper::getVideos($this->user_id);

        if (!$videos) {
            TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "playlist-download-setup", "Playlist dump for {$this->username} error: No videos.");
            throw new \Exception("No videos");
        }

        $this->video = $videos[0];

        if (isset($this->video['thumbnail_url']) && $this->video['thumbnail_url'] != '') {
            TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "playlist-download-setup", "Playlist dump for {$this->username} error: Newest vod is finalized.");
            throw new Exception("Newest vod is finalized");
        }

        $this->video_id = $this->video['id'];

        $this->unique_id = "{$this->username}-{$this->video_id}";

        $this->run_file = $this->getCacheFolder() . DIRECTORY_SEPARATOR . 'running';
    }

    public function getCacheFolder()
    {
        return TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . 'playlist' . DIRECTORY_SEPARATOR . $this->unique_id;
    }

    private function fetchPlaylist()
    {
        return file_get_contents($this->stream_playlist_url);
    }

    private function isRunning()
    {
        return file_exists($this->run_file);
    }

    private function setRunning(bool $state)
    {

        if ($state) {
            file_put_contents($this->run_file, getmypid());
        } else {
            if (file_exists($this->run_file)) unlink($this->run_file);
        }
    }

    private function appendChunks()
    {
        // write every ts file to the big one, flush after every write to keep memory down
        $handle = fopen($this->output_file, 'a');
        foreach ($this->chunks_to_append as $chunk) {
            /** @var Chunk $chunk */
            $chunk_data = file_get_contents($chunk->full_path);
            fwrite($handle, $chunk_data);
            fflush($handle);
            $chunk_data = null;
            /*
            if(unlink($chunk->full_path)){ // test this
                $last_deleted_chunk = $chunk->chunk_num;
                $removed_chunks++;
            }
            */
        }
        fclose($handle);
    }

    private function deleteChunks()
    {
        // delete chunks
        foreach ($this->chunks as $chunk) {
            /** @var Chunk $chunk */
            if ($chunk->chunk_num >= $this->last_deleted_chunk && $chunk->chunk_num <= $this->last_chunk_num && file_exists($chunk->full_path)) {
                unlink($chunk->full_path);
                // TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Remove chunk {$chunk->filename} for {$unique_id}");
                $this->last_deleted_chunk = $chunk->chunk_num;
                $this->removed_chunks++;
            }
        }
    }

    public function downloadLatest()
    {

        set_time_limit(0);

        $output_basename = basename($this->output_file);

        $time_started = time();

        TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "playlist-download", "Start playlist download for {$this->username} (pid " . getmypid() . ")");

        $new_chunks_timeout = 120;
        $amount_of_tries = 8;

        $capture_info_file = $this->getCacheFolder() . DIRECTORY_SEPARATOR . 'capture.json';

        if (isset($_GET['force'])) {
            $this->setRunning(false);
        }

        // check if already running internal
        if ($this->isRunning()) {
            // $captureJob->clear();
            throw new \Exception("Job is already running for this playlist.");
            return false;
        }

        // save progress
        $this->setRunning(true);

        // set job
        $captureJob = new TwitchAutomatorJob("playlist_dump_{$this->unique_id}");
        $captureJob->setPid(getmypid());
        $captureJob->setMetadata([
            'username' => $this->username,
            'video_id' => $this->video_id,
            'output' => $this->output_file
        ]);
        $captureJob->save();

        // $concat_filename = $video_id . '.ts';

        // fetch stream m3u8 urls with streamlink
        $stream_urls_raw = TwitchHelper::exec([TwitchHelper::path_streamlink(), '--json', '--url', $this->video['url'], '--default-stream', $this->quality, '--stream-url']);
        $this->stream_urls = json_decode($stream_urls_raw, true);

        // $download_path = TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . 'playlist' . DIRECTORY_SEPARATOR . $unique_id;
        // $total_chunks_file = $download_path . DIRECTORY_SEPARATOR . 'total_chunks';

        // last added chunk
        $last_chunk_appended_file = $this->getCacheFolder() . DIRECTORY_SEPARATOR . 'lastchunk';
        $this->last_chunk_appended = -1;
        if (file_exists($last_chunk_appended_file)) {
            $this->last_chunk_appended = file_get_contents($last_chunk_appended_file);
        }

        if (!file_exists($this->getCacheFolder())) {
            if (!mkdir($this->getCacheFolder())) {
                $captureJob->clear();
                $this->setRunning(false);
                throw new Exception("Could not make download dir for {$this->unique_id}");
            }
        }

        TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "playlist-download", "Download path: {$this->getCacheFolder()}");

        if (!$this->stream_urls) {
            $captureJob->clear();
            $this->setRunning(false);
            TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "playlist-download", "No videos api response for {$this->username}.", ['output' => $stream_urls_raw]);
            throw new \Exception("No videos api response for {$this->username}");
        }

        if (!$this->stream_urls['streams']) {
            $captureJob->clear();
            $this->setRunning(false);
            TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "playlist-download", "Playlist dump for {$this->username} error: No stream urls with uid {$this->unique_id}.", ['output' => $stream_urls_raw]);
            throw new \Exception("No stream urls for {$this->username} with uid {$this->unique_id}");
        }

        if (!$this->stream_urls['streams'][$this->quality]) {
            $captureJob->clear();
            $this->setRunning(false);
            TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "playlist-download", "Playlist dump for {$this->username} error: No stream urls with quality {$this->quality} for {$this->unique_id}.", ['output' => $stream_urls_raw]);
            throw new \Exception("No stream urls for {$this->username} with quality {$this->quality} for {$this->unique_id}");
        }

        $this->stream_playlist_url = $this->stream_urls['streams'][$this->quality]['url'];

        TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "playlist-download", "Playlist URL: {$this->stream_playlist_url}");

        // save streams to file
        file_put_contents($this->getCacheFolder() . DIRECTORY_SEPARATOR . 'stream_urls.json', json_encode($this->stream_urls['streams']));

        $basepath = dirname($this->stream_playlist_url);

        $num_new_chunks = 0;

        $this->last_deleted_chunk = -1;
        $this->last_downloaded_chunk = -1;

        $first_run = true;

        $tries = 0;

        if (!file_exists($this->output_file)) {
            touch($this->output_file);
        }

        TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "playlist-download", "Enter playlist loop for {$this->unique_id} with quality {$this->quality}");

        // full loop
        // do {
        while (true) {

            TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "playlist-download", "Execute playlist loop for {$this->unique_id} with quality {$this->quality}");

            $num_new_chunks = 0;

            if (!$first_run || !file_exists($this->getCacheFolder())) {
                TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "playlist-download", "Breaking loop for playlist dump of {$this->unique_id}, playlist removed");
                break;
            }

            // download playlist every loop
            $playlist = $this->fetchPlaylist();

            if (isset($this->stream_playlist_crc) && crc32($playlist)) {
                TwitchHelper::logAdvanced(TwitchHelper::LOG_WARNING, "playlist-download", "Playlist CRC is identical two times in a row");
            }

            $this->stream_playlist_crc = crc32($playlist);

            // save playlist
            file_put_contents($this->getCacheFolder() . DIRECTORY_SEPARATOR . 'playlist.m3u8', $playlist);

            // extract all chunks
            $playlist_lines = explode("\n", $playlist);

            $this->chunks = [];
            foreach ($playlist_lines as $i => $line) {

                /*
                if(substr($line, 0, 1) == '#'){
                    $kv = explode( ":", substr($line, 1) );
                    if($kv[0] ==)
                    continue;
                }
                */

                if (substr($line, -3) == '.ts') {
                    $chunk_obj = new Chunk();
                    $chunk_obj->chunk_num = substr($line, 0, -3);
                    $chunk_obj->filename = $line;
                    $chunk_obj->full_path = $this->getCacheFolder() . DIRECTORY_SEPARATOR . $chunk_obj->filename;
                    $chunk_obj->full_url = $basepath . '/' . $chunk_obj->filename;
                    $chunk_obj->duration = substr(substr($playlist_lines[$i - 1], 8), 0, -1);

                    $this->chunks[] = $chunk_obj;
                }
            }

            file_put_contents($this->getCacheFolder() . DIRECTORY_SEPARATOR . 'chunks.json', json_encode($this->chunks));

            TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "playlist-download", count($this->chunks) . " chunks read for {$this->unique_id}");

            if (count($this->chunks) > 0) {
                $last_chunk = $this->chunks[count($this->chunks) - 1];
                // file_put_contents($total_chunks_file, $last_chunk->chunk_num);
            }

            $new_chunks = [];

            // download chunks
            foreach ($this->chunks as $chunk) {

                /** @var Chunk $chunk */

                // don't download old chunks
                if (file_exists($chunk->full_path) || $chunk->chunk_num <= $this->last_chunk_appended) { // hm
                    continue;
                }

                $this->last_chunk_num = $chunk->chunk_num;

                // regular php download, maybe handle this with aria some day
                TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "playlist-download", "Download chunk {$chunk->filename} for {$this->unique_id}");
                $chunk_data = file_get_contents($chunk->full_url);
                if (strlen($chunk_data) == 0) {
                    TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "playlist-download", "Empty chunk {$chunk->filename} for {$this->unique_id}");
                    break;
                }
                file_put_contents($chunk->full_path, $chunk_data);
                $num_new_chunks++;
                $new_chunks[] = $chunk;
                $chunk_data = null;
                $this->last_downloaded_chunk = $chunk;
            }

            // exit out if no new files, test
            TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "playlist-download", "Compare for first run: {$this->last_chunk_num} == {$this->last_chunk_appended}");
            if ($this->last_chunk_num == $this->last_chunk_appended) {
                if ($first_run) {
                    $captureJob->clear();
                    $this->setRunning(false);
                    TwitchHelper::log(TwitchHelper::LOG_WARNING, "No new chunks found for {$this->unique_id}");
                    throw new \Exception("First run, no new chunks for {$this->unique_id}");
                }
            }

            // concat into massive file
            if ($num_new_chunks > 0) {

                TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "playlist-download", "Concat new chunks for {$this->unique_id} ({$num_new_chunks})");

                // $concat_file = $download_path . DIRECTORY_SEPARATOR . $concat_filename;

                // build concat list
                $this->chunks_to_append = [];
                // $concat_list = '';
                foreach ($this->chunks as $chunk) {
                    /** @var Chunk $chunk */
                    if ($chunk->chunk_num > $this->last_chunk_appended) { // duplicate last err
                        if (!file_exists($chunk->full_path)) {
                            $captureJob->clear();
                            $this->setRunning(false);
                            throw new \Exception("Chunk {$chunk} does not exist for {$this->unique_id}");
                        }
                        $this->chunks_to_append[] = $chunk;
                        // $concat_list .= "file '" . realpath($chunk_path) . "'\n"; // unsafe
                        // $concat_list .= "file '" . $chunk->filename . "'\n";
                        // TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Append chunk {$chunk->filename} to all.ts for {$unique_id}");
                    }
                }

                TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "playlist-download", "Append " . count($this->chunks_to_append) . " chunks to {$output_basename} for {$this->unique_id}");

                // prepend all.ts
                /*
                if (file_exists($output_file)) {
                    TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Include all.ts (not first run) for {$unique_id}");
                    $concat_list = "file 'all.ts'\n" . $concat_list;
                }
                */

                // $concat_list_file = $download_path . DIRECTORY_SEPARATOR . 'list.txt';
                // file_put_contents($concat_list_file, $concat_list);

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

                // remove old chunks
                $this->removed_chunks = 0;

                $this->appendChunks();

                // check if output file is valid
                if (!file_exists($this->output_file) || filesize($this->output_file) == 0) {
                    $captureJob->clear();
                    $this->setRunning(false);
                    throw new \Exception("File could not be concat for {$this->unique_id}");
                }

                $this->deleteChunks();

                TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "playlist-download", "Removed {$this->removed_chunks} chunks for {$this->unique_id}");

                // save last chunk name to file
                $this->last_chunk_appended = $this->last_chunk_num;
                file_put_contents($last_chunk_appended_file, $this->last_chunk_appended);
                // unlink($concat_list_file);
            }

            if ($num_new_chunks == 0) {
                TwitchHelper::logAdvanced(TwitchHelper::LOG_WARNING, "playlist-download", "No new chunks downloaded, try #{$num_new_chunks}. Sleep for {$new_chunks_timeout} seconds for {$this->unique_id}.");
                $tries++;
            } else {
                TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "playlist-download", "{$num_new_chunks} new chunks downloaded, sleep for {$new_chunks_timeout} seconds for {$this->unique_id}");
                $tries = 0;
            }

            file_put_contents($capture_info_file, json_encode([
                'time_started' => $time_started,
                'chunks' => $this->chunks,
                'total_chunks' => $last_chunk->chunk_num,
                'last_downloaded_chunk' => $this->last_downloaded_chunk,
                'stream_urls' => $this->stream_urls['streams'],
                'tries' => $tries,
                'pid' => getmypid()
            ]));

            sleep($new_chunks_timeout);

            $first_run = false;

            if ($num_new_chunks == 0 && $tries > $amount_of_tries) {
                TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "playlist-download", "Reached {$tries}/{$amount_of_tries} tries on {$this->unique_id}.");
                break;
            }
        } // while ($num_new_chunks > 0 || $tries < $amount_of_tries);

        TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "playlist-download", "No more playlist chunks to download for {$this->unique_id}, " . count($this->chunks) . " total chunks. {$tries} tries.");

        $captureJob->clear();

        // if (file_exists($run_file)) unlink($run_file);
        $this->setRunning(false);

        if (!file_exists($this->output_file) || filesize($this->output_file) == 0) {
            TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "playlist-download", "No video file for {$this->unique_id}.");
            return false;
        }

        TwitchHelper::logAdvanced(TwitchHelper::LOG_SUCCESS, "playlist-download", "Playlist download completed.");

        return $this->output_file;
    }
}
