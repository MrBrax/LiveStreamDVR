<?php

declare(strict_types=1);

namespace App\Traits;

use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\Process;
use App\TwitchConfig;
use App\TwitchHelper;
use App\TwitchAutomatorJob;

trait SoftwareWrappers
{

	/**
	 * Execute a command, blocking
	 *
	 * @param array $cmd
	 * @param boolean $stderr
	 * @return string
	 */
	public static function exec(array $cmd, $stderr = false): string
	{
		TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Executing command: " . implode(" ", $cmd));
		$process = new Process($cmd);
		$process->run();
		return $process->getOutput() . ($stderr ? $process->getErrorOutput() : '');
	}

	/**
	 * Find out where a file is located on PATH
	 *
	 * @param string $name_linux
	 * @param string $name_windows
	 * @return string|false
	 */
	public static function whereis(string $name_linux, string $name_windows)
	{

		if (self::is_windows()) {

			$output = TwitchHelper::exec(['where', $name_windows]);

			if ($output) {
				$path = explode("\n", $output)[0];
				return trim($path);
			}
		} else {

			$output = TwitchHelper::exec(['whereis', $name_linux]);

			if ($output) {
				preg_match("/^[a-z]+\:\s([a-z\-\_\/\.]+)/", $output, $matches);
				if ($matches) {
					$path = $matches[1];
					return trim($path);
				}
			}
		}

		return false;
	}

	/**
	 * Run the mediainfo program on the file
	 *
	 * @param string $filename
	 * @return array|false
	 */
	public static function mediainfo(string $filename)
	{

		TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Run mediainfo on {$filename}");

		if (!$filename) {
			throw new \Exception('No filename supplied for mediainfo');
		}

		if (!file_exists($filename)) {
			throw new \Exception('File not found for mediainfo');
		}

		if (filesize($filename) == 0) {
			throw new \Exception('Filesize is 0 for mediainfo');
		}

		// $output = shell_exec( TwitchHelper::path_mediainfo() . ' --Full --Output=JSON ' . escapeshellarg($filename) );
		// $process = new Process( [TwitchHelper::path_mediainfo(), '--Full', '--Output=JSON', $filename] );
		// $process->run();
		$output = TwitchHelper::exec([TwitchHelper::path_mediainfo(), '--Full', '--Output=JSON', $filename]);

		if ($output) {

			$json = json_decode($output, true);

			$data = [];

			foreach ($json['media']['track'] as $track) {
				if ($track["@type"] == "General") {
					$data['general'] = $track;
				} else if ($track["@type"] == "Video") {
					$data['video'] = $track;
				} else if ($track["@type"] == "Audio") {
					$data['audio'] = $track;
				}
			}

			return $data;
		} else {

			return false;
		}
	}

	public static function remuxVideo( string $input, string $output, $delete_input = false ){

		$basename = basename($input);

		$cmd = [];

		$cmd[] = TwitchHelper::path_ffmpeg();

		$cmd[] = '-i';
		$cmd[] = $input; // input filename

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

		$cmd[] = $output; // output filename

		$process = new Process($cmd, dirname($input), null, null, null);
		$process->start();

		//$pidfile = TwitchHelper::$pids_folder . DIRECTORY_SEPARATOR . 'vod_convert_' . $this->basename . '.pid';
		//file_put_contents($pidfile, $process->getPid());
		$remuxVideoJob = TwitchAutomatorJob::load("remux_video_{$basename}");
		$remuxVideoJob->setPid($process->getPid());
		$remuxVideoJob->setProcess($process);
		$remuxVideoJob->save();

		$process->wait();

		//if (file_exists($pidfile)) unlink($pidfile);
		$remuxVideoJob->clear();

		TwitchHelper::appendLog("ffmpeg_remux_{$basename}_" . time() . "_stdout", "$ " . implode(" ", $cmd) . "\n" . $process->getOutput());
		TwitchHelper::appendLog("ffmpeg_remux_{$basename}_" . time() . "_stderr", "$ " . implode(" ", $cmd) . "\n" . $process->getErrorOutput());

		if (file_exists($input) && file_exists($output) && filesize($output) > 0) {
			if( $delete_input ){
				unlink($input);
			}
		}

		$successful = file_exists($output) && filesize($output) > 0;

		return $successful;

	}

}
