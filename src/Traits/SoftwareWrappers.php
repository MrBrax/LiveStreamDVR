<?php

declare(strict_types=1);

namespace App\Traits;

use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\Process;
use App\TwitchConfig;
use App\TwitchHelper;

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
				return $path;
			}
		} else {

			$output = TwitchHelper::exec(['whereis', $name_linux]);

			if ($output) {
				preg_match("/^[a-z]+\:\s([a-z\-\_\/\.]+)/", $output, $matches);
				if ($matches) {
					$path = $matches[1];
					return $path;
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

		TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Run mediainfo on " . $filename);

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
}
