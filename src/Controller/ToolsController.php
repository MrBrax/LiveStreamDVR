<?php

declare(strict_types=1);

namespace App\Controller;

use Slim\Psr7\Request;
use Slim\Psr7\Response;

use App\TwitchAutomator;
use App\TwitchConfig;
use App\TwitchHelper;
use App\TwitchAutomatorJob;
use Slim\Views\Twig;

use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\Process;

class ToolsController
{

	/**
	 * @var Twig
	 */
	private $twig;

	private $logs = [];

	public function __construct(Twig $twig)
	{
		$this->twig = $twig;
	}

	public function tools(Request $request, Response $response, array $args)
	{

		$saved_vods = [];
		$saved_vods_raw = glob(TwitchHelper::$public_folder . DIRECTORY_SEPARATOR . "saved_vods" . DIRECTORY_SEPARATOR . "*.mp4");
		foreach ($saved_vods_raw as $v) {
			$saved_vods[] = [
				'name' => basename($v),
				'size' => filesize($v)
			];
		}

		/*
		$current_jobs_raw = glob(TwitchHelper::$pids_folder . DIRECTORY_SEPARATOR . "*.pid");
		$current_jobs = [];
		foreach ($current_jobs_raw as $v) {
			$pid = file_get_contents($v);
			$status = TwitchHelper::getPidfileStatus(basename($v, ".pid"));
			$current_jobs[] = [
				'name' => basename($v, ".pid"),
				'pid' => $pid,
				'status' => $status !== false
			];
		}
		*/
		$current_jobs_raw = glob(TwitchHelper::$pids_folder . DIRECTORY_SEPARATOR . "*.json");
        $current_jobs = [];
        foreach ($current_jobs_raw as $v) {
            // $pid = file_get_contents($v);
			$job = new TwitchAutomatorJob(basename($v, ".json"));
			$job->load();
            $current_jobs[] = $job;
		}
		
		// if( $current_jobs_raw ) $current_jobs = array_map( 'basename', $current_jobs_raw );

		return $this->twig->render($response, 'tools.twig', [
			'saved_vods' => $saved_vods,
			'current_jobs' => $current_jobs,
			'twitch_quality' => TwitchHelper::$twitchQuality
		]);
	}

	// TODO: unify these functions for all classes
	private function downloadChat($video_id, $destination)
	{

		if (!TwitchHelper::path_tcd()) return false;

		$cmd = [];

		if (TwitchConfig::cfg('pipenv_enabled')) {
			$cmd[] = 'pipenv run tcd';
		} else {
			$cmd[] = TwitchHelper::path_tcd();
		}

		$cmd[] = '--settings-file';
		$cmd[] = TwitchHelper::$config_folder . DIRECTORY_SEPARATOR . 'tcd_settings.json';

		$cmd[] = '--video';
		$cmd[] = $video_id;

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
		$cmd[] = TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . 'tools';

		// $capture_output = shell_exec( $cmd );

		$process = new Process($cmd, TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . 'tools', null, null, null);
		$process->start();

		//$pidfile = TwitchHelper::$pids_folder . DIRECTORY_SEPARATOR . 'tools_chat_download_' . $video_id . '.pid';
		//file_put_contents($pidfile, $process->getPid());
		$tools_chat_downloadJob = new TwitchAutomatorJob("tools_chat_download_{$video_id}");
		$tools_chat_downloadJob->setPid($process->getPid());
		$tools_chat_downloadJob->setProcess($process);
		$tools_chat_downloadJob->save();

		$process->wait();

		//if (file_exists($pidfile)) unlink($pidfile);
		$tools_chat_downloadJob->clear();

		$tcd_filename = TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . 'tools' . DIRECTORY_SEPARATOR . $video_id . '.json';

		$this->logs['tcd']['stdout'] = $process->getOutput();
		$this->logs['tcd']['stderr'] = $process->getErrorOutput();

		if (file_exists($tcd_filename)) {
			rename($tcd_filename, $destination);
		}

		$successful = file_exists($destination) && filesize($destination) > 0;

		return $successful;
	}

	private function downloadVod($video_id, $destination, $quality)
	{

		if (!TwitchHelper::path_streamlink()) return false;

		$video_url = 'https://www.twitch.tv/videos/' . $video_id;

		$cmd = [];

		if (TwitchConfig::cfg('pipenv_enabled')) {
			$cmd[] = 'pipenv run streamlink';
		} else {
			$cmd[] = TwitchHelper::path_streamlink();
		}

		$cmd[] = '-o';
		$cmd[] = $destination; // output file

		$cmd[] = '--hls-segment-threads';
		$cmd[] = 10;

		$cmd[] = '--url';
		$cmd[] = $video_url; // stream url

		$cmd[] = '--default-stream';
		$cmd[] = $quality; // twitch url and quality

		$process = new Process($cmd, dirname($destination), null, null, null);
		$process->start();

		//$pidfile = TwitchHelper::$pids_folder . DIRECTORY_SEPARATOR . 'tools_vod_download_' . $video_id . '.pid';
		//file_put_contents($pidfile, $process->getPid());
		$tools_vod_downloadJob = new TwitchAutomatorJob("tools_vod_download_{$video_id}");
		$tools_vod_downloadJob->setPid($process->getPid());
		$tools_vod_downloadJob->setProcess($process);
		$tools_vod_downloadJob->save();

		$process->wait();

		//if (file_exists($pidfile)) unlink($pidfile);
		$tools_vod_downloadJob->clear();

		$this->logs['streamlink']['stdout'] = $process->getOutput();
		$this->logs['streamlink']['stderr'] = $process->getErrorOutput();

		$successful = file_exists($destination) && filesize($destination) > 0;

		return $successful;
	}

	private function convertVod($video_id, $source, $destination)
	{

		$cmd = [];

		$cmd[] = TwitchHelper::path_ffmpeg();

		$cmd[] = '-i';
		$cmd[] = $source; // input filename

		if (TwitchConfig::cfg('fix_corruption')) {
			// $cmd[] = '-map';
			// $cmd[] = '0';
			// $cmd[] = '-ignore_unknown';
			// $cmd[] = '-copy_unknown';
		}

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

		$cmd[] = $destination; // output filename

		$process = new Process($cmd, dirname($source), null, null, null);
		$process->start();

		//$pidfile = TwitchHelper::$pids_folder . DIRECTORY_SEPARATOR . 'tools_vod_convert_' . $video_id . '.pid';
		//file_put_contents($pidfile, $process->getPid());
		$tools_vod_convertJob = new TwitchAutomatorJob("tools_vod_convert_{$video_id}");
		$tools_vod_convertJob->setPid($process->getPid());
		$tools_vod_convertJob->setProcess($process);
		$tools_vod_convertJob->save();

		$process->wait();

		//if (file_exists($pidfile)) unlink($pidfile);
		$tools_vod_convertJob->clear();

		$this->logs['ffmpeg']['stdout'] = $process->getOutput();
		$this->logs['ffmpeg']['stderr'] = $process->getErrorOutput();

		if (file_exists($source) && file_exists($destination) && filesize($destination) > 0) {
			unlink($source);
		}

		$successful = file_exists($destination) && filesize($destination) > 0;

		return $successful;
	}

	private function renderChat($video_id, $video_filename, $chat_filename, $destination)
	{

		if (!TwitchHelper::path_twitchdownloader() || !file_exists(TwitchHelper::path_twitchdownloader())) {
			throw new \Exception('TwitchDownloaderCLI not installed');
			return false;
		}

		if (!TwitchHelper::path_mediainfo()) {
			throw new \Exception('Mediainfo not installed');
			return false;
		}

		// $chat_filename = $this->directory . DIRECTORY_SEPARATOR . $this->basename . '.chat';
		// $video_filename = $this->directory . DIRECTORY_SEPARATOR . $this->basename . '_chat.mp4';

		$mediainfo = TwitchHelper::mediainfo($video_filename);

		if (!$mediainfo) {
			throw new \Exception('No mediainfo returned');
			return false;
		}

		$chat_width = 300;
		$chat_height = $mediainfo['video']['Height'];

		$cmd = [];

		$cmd[] = TwitchHelper::path_twitchdownloader();

		$cmd[] = '--mode';
		$cmd[] = 'ChatRender';

		$cmd[] = '--input';
		$cmd[] = realpath($chat_filename);

		$cmd[] = '--chat-height';
		$cmd[] = $chat_height;

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
		$cmd[] = $destination;

		$env = [
			// 'DOTNET_BUNDLE_EXTRACT_BASE_DIR' => __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "cache",
			'PATH' => dirname(TwitchHelper::path_ffmpeg()),
			'TEMP' => TwitchHelper::$cache_folder,
			'TMP' => TwitchHelper::$cache_folder,
		];

		$process = new Process($cmd, TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . 'tools', $env, null, null);
		$process->start();

		//$pidfile = TwitchHelper::$pids_folder . DIRECTORY_SEPARATOR . 'tools_chat_render_' . $video_id . '.pid';
		//file_put_contents($pidfile, $process->getPid());
		$tools_chat_renderJob = new TwitchAutomatorJob("tools_chat_render_{$video_id}");
		$tools_chat_renderJob->setPid($process->getPid());
		$tools_chat_renderJob->setProcess($process);
		$tools_chat_renderJob->save();

		$process->wait();

		//if (file_exists($pidfile)) unlink($pidfile);
		$tools_chat_renderJob->clear();

		$this->logs['td_chat']['stdout'] = $process->getOutput();
		$this->logs['td_chat']['stderr'] = $process->getErrorOutput();


		if (mb_strpos($process->getErrorOutput(), "Unhandled exception") !== false) {
			throw new \Exception('Error when running TwitchDownloaderCLI.');
			return false;
		}

		$successful = file_exists($destination) && filesize($destination) > 0;

		return $successful;
	}

	private function burnChat($video_id, $video_filename, $chatrender_filename, $destination)
	{

		$chat_width = 300;

		// $chat_filename = $this->directory . DIRECTORY_SEPARATOR . $this->basename . '_chat.mp4';

		$mask_filename = str_replace(".mp4", "_mask.mp4", $chatrender_filename);

		// $final_filename = $this->directory . DIRECTORY_SEPARATOR . $this->basename . '_burned.mp4';

		// $chat_x = $this->video_metadata['video']['Width'] - $chat_width;

		$cmd = [];

		$cmd[] = TwitchHelper::path_ffmpeg();

		// chat render
		$cmd[] = '-i';
		$cmd[] = $chatrender_filename;


		// chat mask
		$cmd[] = '-i';
		$cmd[] = $mask_filename;

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

		$cmd[] = $destination;

		$process = new Process($cmd, dirname($video_filename), null, null, null);
		$process->start();

		//$pidfile = TwitchHelper::$pids_folder . DIRECTORY_SEPARATOR . 'tools_chat_burn_' . $video_id . '.pid';
		//file_put_contents($pidfile, $process->getPid());
		$tools_chat_burnJob = new TwitchAutomatorJob("tools_chat_burn_{$video_id}");
		$tools_chat_burnJob->setPid($process->getPid());
		$tools_chat_burnJob->setProcess($process);
		$tools_chat_burnJob->save();

		$process->wait();

		//if (file_exists($pidfile)) unlink($pidfile);
		$tools_chat_burnJob->clear();

		$this->logs['td_burn']['stdout'] = $process->getOutput();
		$this->logs['td_burn']['stderr'] = $process->getErrorOutput();

		$successful = file_exists($destination) && filesize($destination) > 0;

		return $successful;
	}

	public function page_fullvodburn(Request $request, Response $response, array $args)
	{

		$url        = $_POST['url'];
		$quality    = $_POST['quality'];

		set_time_limit(0);

		preg_match("/\/videos\/([0-9]+)/", $url, $matches);

		if (!$matches) {
			return $this->twig->render($response, 'dialog.twig', [
				'text' => 'No video found: ' . $url,
				'type' => 'error'
			]);
		}

		$video_id = (int)$matches[1];

		$response->getBody()->write("Beginning download of {$video_id}");

		$basedir = TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . 'tools';
		if (!file_exists($basedir)) {
			mkdir($basedir);
		}

		$metadata = TwitchHelper::getVideo($video_id);

		if (!$metadata) {
			$response->getBody()->write("VOD not found.");
			return $response;
		}

		$basename = $metadata['user_name'] . '_' . $video_id;

		$srcfile        	= $basedir . DIRECTORY_SEPARATOR . $basename . "_" . $quality . ".ts";
		$dstfile        	= $basedir . DIRECTORY_SEPARATOR . $basename . "_" . $quality . ".mp4";
		$chatfile       	= $basedir . DIRECTORY_SEPARATOR . $basename . "_" . $quality . "_chat.json";
		$chatrender     	= $basedir . DIRECTORY_SEPARATOR . $basename . "_" . $quality . "_chat.mp4";
		$chatrender_mask	= str_replace(".mp4", "_mask.mp4", $chatrender);
		$vod_downloaded     = TwitchHelper::$public_folder . DIRECTORY_SEPARATOR . 'saved_vods' . DIRECTORY_SEPARATOR . $basename . "_" . $quality . ".mp4";
		$burned        		= TwitchHelper::$public_folder . DIRECTORY_SEPARATOR . 'saved_vods' . DIRECTORY_SEPARATOR . $basename . "_" . $quality . "_burned.mp4";
		$metafile        	= TwitchHelper::$public_folder . DIRECTORY_SEPARATOR . 'saved_vods' . DIRECTORY_SEPARATOR . $basename . ".info.json";
		$no_delete = false;

		if (file_exists($burned)) {
			$response->getBody()->write("VOD has already been burned.");
			return $response;
		}

		if (file_exists($vod_downloaded)) {
			$dstfile = $vod_downloaded;
			$no_delete = true;
			$response->getBody()->write("<br>VOD downloaded via other tool already");
		}

		if (!file_exists($dstfile) && !file_exists($srcfile)) {
			if ($this->downloadVod($video_id, $srcfile, $quality)) {
				$response->getBody()->write("<br>VOD download successful");
			} else {
				$response->getBody()->write("<br>VOD download error");
				$response->getBody()->write("<pre>" . print_r($this->logs, true) . "</pre>");
				return $response;
			}
		}

		if (!file_exists($dstfile) && file_exists($srcfile)) {
			if ($this->convertVod($video_id, $srcfile, $dstfile)) {
				$response->getBody()->write("<br>Remux successful");
			} else {
				$response->getBody()->write("<br>Remux error");
				$response->getBody()->write("<pre>" . print_r($this->logs, true) . "</pre>");
				return $response;
			}
		}

		if (!file_exists($chatfile)) {
			if ($this->downloadChat($video_id, $chatfile)) {
				$response->getBody()->write("<br>Chat download successful");
			} else {
				$response->getBody()->write("<br>Chat download error");
				$response->getBody()->write("<pre>" . print_r($this->logs, true) . "</pre>");
				return $response;
			}
		}

		if (!file_exists($chatrender)) {
			if ($this->renderChat($video_id, $dstfile, $chatfile, $chatrender)) {
				$response->getBody()->write("<br>Chat render successful");
			} else {
				$response->getBody()->write("<br>Chat render error");
				$response->getBody()->write("<pre>" . print_r($this->logs, true) . "</pre>");
				return $response;
			}
		}

		if (!file_exists($burned)) {
			if ($this->burnChat($video_id, $dstfile, $chatrender, $burned)) {
				$response->getBody()->write("<br>Chat burn successful");
			} else {
				$response->getBody()->write("<br>Chat burn error");
				$response->getBody()->write("<pre>" . print_r($this->logs, true) . "</pre>");
				return $response;
			}
		}

		file_put_contents($metafile, json_encode($metadata));

		unlink($srcfile);
		if (!$no_delete) unlink($dstfile);
		unlink($chatfile);
		unlink($chatrender);
		unlink($chatrender_mask);

		$response->getBody()->write("<br>Done?");

		$response->getBody()->write("<pre>" . print_r($this->logs, true) . "</pre>");

		return $response;
	}

	public function page_voddownload(Request $request, Response $response, array $args)
	{

		$url        = $_POST['url'];
		$quality    = $_POST['quality'];

		set_time_limit(0);

		preg_match("/\/videos\/([0-9]+)/", $url, $matches);

		if (!$matches) {
			return $this->twig->render($response, 'dialog.twig', [
				'text' => 'No video found: ' . $url,
				'type' => 'error'
			]);
		}

		$video_id = (int)$matches[1];

		$response->getBody()->write("Beginning download of {$video_id}");

		$basedir = TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . 'tools';
		if (!file_exists($basedir)) {
			mkdir($basedir);
		}

		$metadata = TwitchHelper::getVideo($video_id);

		if (!$metadata) {
			$response->getBody()->write("VOD not found.");
			return $response;
		}

		$basename = $metadata['user_name'] . '_' . $video_id;

		$srcfile        	= $basedir . DIRECTORY_SEPARATOR . $basename . "_" . $quality . ".ts";
		$dstfile        	= TwitchHelper::$public_folder . DIRECTORY_SEPARATOR . 'saved_vods' . DIRECTORY_SEPARATOR . $basename . "_" . $quality . ".mp4";
		$metafile        	= TwitchHelper::$public_folder . DIRECTORY_SEPARATOR . 'saved_vods' . DIRECTORY_SEPARATOR . $basename . ".info.json";

		if (!file_exists($dstfile)) {

			if (!file_exists($dstfile) && !file_exists($srcfile)) {
				if ($this->downloadVod($video_id, $srcfile, $quality)) {
					$response->getBody()->write("<br>VOD download successful");
				} else {
					$response->getBody()->write("<br>VOD download error");
					$response->getBody()->write("<pre>" . print_r($this->logs, true) . "</pre>");
					return $response;
				}
			}

			if (!file_exists($dstfile) && file_exists($srcfile)) {
				if ($this->convertVod($video_id, $srcfile, $dstfile)) {
					$response->getBody()->write("<br>Remux successful");
				} else {
					$response->getBody()->write("<br>Remux error");
					$response->getBody()->write("<pre>" . print_r($this->logs, true) . "</pre>");
					return $response;
				}
			}

			if (file_exists($srcfile)) unlink($srcfile);
		}

		if (!file_exists($metafile)) {
			file_put_contents($metafile, json_encode($metadata));
		}

		$response->getBody()->write("<br>Done?");

		$response->getBody()->write("<pre>" . print_r($this->logs, true) . "</pre>");

		return $response;
	}

	public function page_chatdownload(Request $request, Response $response, array $args)
	{

		$url = $_POST['url'];

		set_time_limit(0);

		preg_match("/\/videos\/([0-9]+)/", $url, $matches);

		if (!$matches) {
			return $this->twig->render($response, 'dialog.twig', [
				'text' => 'No video found: ' . $url,
				'type' => 'error'
			]);
		}

		$video_id = (int)$matches[1];

		$response->getBody()->write("Beginning download of chat {$video_id}");

		/*
        $basedir = TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . 'tools';
        if( !file_exists( $basedir ) ){
            mkdir( $basedir );
		}
		*/

		$metadata = TwitchHelper::getVideo($video_id);

		if (!$metadata) {
			$response->getBody()->write("VOD not found.");
			return $response;
		}

		$basename = $metadata['user_name'] . '_' . $video_id;

		$chatfile = TwitchHelper::$public_folder . DIRECTORY_SEPARATOR . 'saved_vods' . DIRECTORY_SEPARATOR . $basename . "_chat.json";
		$metafile = TwitchHelper::$public_folder . DIRECTORY_SEPARATOR . 'saved_vods' . DIRECTORY_SEPARATOR . $basename . ".info.json";

		if (!file_exists($chatfile)) {
			if ($this->downloadChat($video_id, $chatfile)) {
				$response->getBody()->write("<br>Chat download successful");
			} else {
				$response->getBody()->write("<br>Chat download error");
				$response->getBody()->write("<pre>" . print_r($this->logs, true) . "</pre>");
				return $response;
			}
		}

		if (!file_exists($chatfile)) {
			$response->getBody()->write("<br>Error while downloading chat");
			return $response;
		}

		if (!file_exists($metafile)) {
			file_put_contents($metafile, json_encode($metadata));
		}

		$response->getBody()->write("<br>Done?");

		$response->getBody()->write("<pre>" . print_r($this->logs, true) . "</pre>");

		return $response;
	}
}
