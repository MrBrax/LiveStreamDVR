<?php

namespace App;

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
            TwitchHelper::log(TwitchHelper::LOG_ERROR, "Playlist dump for {$this->username} error: No videos.");
            throw new \Exception("No videos");
        }

        $this->video = $videos[0];

        if (isset($this->video['thumbnail_url']) && $this->video['thumbnail_url'] != '') {
            TwitchHelper::log(TwitchHelper::LOG_ERROR, "Playlist dump for {$this->username} error: Newest vod is finalized.");
            throw new Exception("Newest vod is finalized");
        }

        $this->video_id = $this->video['id'];

        $this->unique_id = $this->username . '-' . $this->video_id;
    }

    public function getCacheFolder()
    {
        return TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . 'playlist' . DIRECTORY_SEPARATOR . $this->unique_id;
    }

    public function downloadLatest()
    {

        set_time_limit(0);

        $output_basename = basename($this->output_file);

        $time_started = time();

        TwitchHelper::log(TwitchHelper::LOG_INFO, "Start playlist download for {$this->username}");

        $new_chunks_timeout = 300;
        $amount_of_tries = 3;

        // $concat_filename = $video_id . '.ts';

        // fetch stream m3u8 urls with streamlink
        $stream_urls_raw = TwitchHelper::exec([TwitchHelper::path_streamlink(), '--json', '--url', $this->video['url'], '--default-stream', $this->quality, '--stream-url']);
        $stream_urls = json_decode($stream_urls_raw, true);

        // $download_path = TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . 'playlist' . DIRECTORY_SEPARATOR . $unique_id;

        $run_file = $this->getCacheFolder() . DIRECTORY_SEPARATOR . 'running';
        $capture_info_file = $this->getCacheFolder() . DIRECTORY_SEPARATOR . 'capture.json';
        // $total_chunks_file = $download_path . DIRECTORY_SEPARATOR . 'total_chunks';

        if (isset($_GET['force'])) {
            if (file_exists($run_file)) unlink($run_file);
        }

        if (file_exists($run_file)) {
            throw new \Exception("Job is already running for this user, probably. Use ?force=1 to force.");
        }

        // last added chunk
        $last_chunk_appended_file = $this->getCacheFolder() . DIRECTORY_SEPARATOR . 'lastchunk';
        $last_chunk_appended = -1;
        if (file_exists($last_chunk_appended_file)) {
            $last_chunk_appended = file_get_contents($last_chunk_appended_file);
        }

        if (!file_exists($this->getCacheFolder())) {
            if (!mkdir($this->getCacheFolder())) {
                throw new Exception("Could not make download dir for {$this->unique_id}");
            }
        }

        TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Download path: {$this->getCacheFolder()}");

        if (!$stream_urls) {
            TwitchHelper::log(TwitchHelper::LOG_ERROR, "No videos api response for {$this->username}.", ['output' => $stream_urls_raw]);
            throw new \Exception("No videos api response for {$this->username}");
        }

        if (!$stream_urls['streams']) {
            TwitchHelper::log(TwitchHelper::LOG_ERROR, "Playlist dump for {$this->username} error: No stream urls with uid {$this->unique_id}.", ['output' => $stream_urls_raw]);
            throw new \Exception("No stream urls for {$this->username} with uid {$this->unique_id}");
        }

        if (!$stream_urls['streams'][$this->quality]) {
            TwitchHelper::log(TwitchHelper::LOG_ERROR, "Playlist dump for {$this->username} error: No stream urls with quality {$this->quality} for {$this->unique_id}.", ['output' => $stream_urls_raw]);
            throw new \Exception("No stream urls for {$this->username} with quality {$this->quality} for {$this->unique_id}");
        }

        $stream_playlist_url = $stream_urls['streams'][$this->quality]['url'];

        TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Playlist URL: {$stream_playlist_url}");

        // save streams to file
        file_put_contents($this->getCacheFolder() . DIRECTORY_SEPARATOR . 'stream_urls.json', json_encode($stream_urls['streams']));

        // save progress
        file_put_contents($run_file, getmypid());

        $basepath = dirname($stream_playlist_url);

        $num_new_chunks = 0;

        $last_deleted_chunk = -1;
        $last_downloaded_chunk = -1;

        $first_run = true;

        $tries = 0;

        if (!file_exists($this->output_file)) {
            touch($this->output_file);
        }

        // full loop
        do {

            $num_new_chunks = 0;

            if (!$first_run && (!file_exists($this->getCacheFolder()) || !file_exists($stream_playlist_url))) {
                TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Breaking loop for playlist dump of {$this->unique_id}, playlist removed");
                break;
            }

            // download playlist every loop
            $playlist = file_get_contents($stream_playlist_url);

            file_put_contents($this->getCacheFolder() . DIRECTORY_SEPARATOR . 'playlist.m3u8', $playlist);

            // extract all chunks
            $playlist_lines = explode("\n", $playlist);

            /** @var Chunk[] $chunks */
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
                    $chunk_obj = new Chunk();
                    $chunk_obj->chunk_num = substr($line, 0, -3);
                    $chunk_obj->filename = $line;
                    $chunk_obj->full_path = $this->getCacheFolder() . DIRECTORY_SEPARATOR . $chunk_obj->filename;
                    $chunk_obj->full_url = $basepath . '/' . $chunk_obj->filename;
                    $chunk_obj->duration = substr(substr($playlist_lines[$i - 1], 8), 0, -1);

                    $chunks[] = $chunk_obj;
                }
            }

            file_put_contents($this->getCacheFolder() . DIRECTORY_SEPARATOR . 'chunks.json', json_encode($chunks));

            TwitchHelper::log(TwitchHelper::LOG_DEBUG, count($chunks) . " chunks read for {$this->unique_id}");

            if (count($chunks) > 0) {
                $last_chunk = $chunks[count($chunks) - 1];
                // file_put_contents($total_chunks_file, $last_chunk->chunk_num);
            }

            $new_chunks = [];

            // download chunks
            foreach ($chunks as $chunk) {

                /** @var Chunk $chunk */

                // don't download old chunks
                if (file_exists($chunk->full_path) || $chunk->chunk_num <= $last_chunk_appended) { // hm
                    continue;
                }

                $last_chunk_num = $chunk->chunk_num;

                // regular php download, maybe handle this with aria some day
                TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Download chunk {$chunk->filename} for {$this->unique_id}");
                $chunk_data = file_get_contents($chunk->full_url);
                if (strlen($chunk_data) == 0) {
                    TwitchHelper::log(TwitchHelper::LOG_ERROR, "Empty chunk {$chunk->filename} for {$this->unique_id}");
                    break;
                }
                file_put_contents($chunk->full_path, $chunk_data);
                $num_new_chunks++;
                $new_chunks[] = $chunk;
                $chunk_data = null;
                $last_downloaded_chunk = $chunk;
            }

            // exit out if no new files, test
            TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Compare for first run: {$last_chunk_num} == {$last_chunk_appended}");
            if ($last_chunk_num == $last_chunk_appended) {
                if ($first_run) {
                    TwitchHelper::log(TwitchHelper::LOG_WARNING, "No new chunks found for {$this->unique_id}");
                    throw new \Exception("First run, no new chunks for {$this->unique_id}");
                }
            }

            // concat into massive file
            if ($num_new_chunks > 0) {

                TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Concat new chunks for {$this->unique_id} ({$num_new_chunks})");

                // $concat_file = $download_path . DIRECTORY_SEPARATOR . $concat_filename;

                // build concat list
                $chunks_to_append = [];
                // $concat_list = '';
                foreach ($chunks as $chunk) {
                    /** @var Chunk $chunk */
                    if ($chunk->chunk_num > $last_chunk_appended) { // duplicate last err
                        if (!file_exists($chunk->full_path)) {
                            throw new \Exception("Chunk {$chunk} does not exist for {$this->unique_id}");
                        }
                        $chunks_to_append[] = $chunk;
                        // $concat_list .= "file '" . realpath($chunk_path) . "'\n"; // unsafe
                        // $concat_list .= "file '" . $chunk->filename . "'\n";
                        // TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Append chunk {$chunk->filename} to all.ts for {$unique_id}");
                    }
                }

                TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Append " . count($chunks_to_append) . " chunks to {$output_basename} for {$this->unique_id}");

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

                // write every ts file to the big one, flush after every write to keep memory down
                $handle = fopen($this->output_file, 'a');
                foreach ($chunks_to_append as $chunk) {
                    /** @var Chunk $chunk */
                    $chunk_data = file_get_contents($chunk->full_path);
                    fwrite($handle, $chunk_data);
                    fflush($handle);
                    $chunk_data = null;
                }
                fclose($handle);

                if (!file_exists($this->output_file) || filesize($this->output_file) == 0) {
                    throw new \Exception("File could not be concat for {$this->unique_id}");
                }

                // remove old chunks
                $removed_chunks = 0;
                foreach ($chunks as $chunk) {
                    /** @var Chunk $chunk */
                    if ($chunk->chunk_num >= $last_deleted_chunk && $chunk->chunk_num <= $last_chunk_num && file_exists($chunk->full_path)) {
                        unlink($chunk->full_path);
                        // TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Remove chunk {$chunk->filename} for {$unique_id}");
                        $last_deleted_chunk = $chunk->chunk_num;
                        $removed_chunks++;
                    }
                }

                TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Removed {$removed_chunks} chunks for {$this->unique_id}");

                // save last chunk name to file
                $last_chunk_appended = $last_chunk_num;
                file_put_contents($last_chunk_appended_file, $last_chunk_appended);
                // unlink($concat_list_file);
            }

            TwitchHelper::log(TwitchHelper::LOG_DEBUG, "{$num_new_chunks} new chunks downloaded, sleep for {$new_chunks_timeout} seconds for {$this->unique_id}");

            if ($num_new_chunks == 0) {
                TwitchHelper::log(TwitchHelper::LOG_DEBUG, "No new chunks downloaded, try #{$num_new_chunks}");
                $tries++;
            }

            file_put_contents($capture_info_file, json_encode([
                'time_started' => $time_started,
                'chunks' => $chunks,
                'total_chunks' => $last_chunk->chunk_num,
                'last_downloaded_chunk' => $last_downloaded_chunk,
                'stream_urls' => $stream_urls['streams'],
                'tries' => $tries,
                'pid' => getmypid()
            ]));

            sleep($new_chunks_timeout);

            $first_run = false;
        } while ($num_new_chunks > 0 && $tries < $amount_of_tries);

        TwitchHelper::log(TwitchHelper::LOG_INFO, "No more playlist chunks to download for {$this->unique_id}");

        if (file_exists($run_file)) unlink($run_file);

        if (!file_exists($this->output_file) || filesize($this->output_file) == 0) {
            return false;
        }

        return $this->output_file;
    }
}
