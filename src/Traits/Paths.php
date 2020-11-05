<?php

declare(strict_types=1);

namespace App\Traits;

use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\Process;
use App\TwitchConfig;
use App\TwitchHelper;

trait Paths
{

	// path helpers
	public static function is_windows(): bool
	{
		return strtoupper(mb_substr(PHP_OS, 0, 3)) === 'WIN';
	}

	/**
	 * Returns the path to ffmpeg
	 *
	 * @return string|bool
	 */
	public static function path_ffmpeg()
	{

		if (TwitchConfig::cfg('ffmpeg_path')) return TwitchConfig::cfg('ffmpeg_path');

		$path = self::whereis("ffmpeg", "ffmpeg.exe");
		if ($path) {
			TwitchConfig::setConfig('ffmpeg_path', $path);
			TwitchConfig::saveConfig("path resolver");
			return $path;
		}

		return false;
	}

	/**
	 * Returns path to mediainfo
	 *
	 * @return string|bool
	 */
	public static function path_mediainfo()
	{

		if (TwitchConfig::cfg('mediainfo_path')) return TwitchConfig::cfg('mediainfo_path');
		// if( file_exists("/usr/bin/mediainfo") ) return "/usr/bin/mediainfo";

		$path = self::whereis("mediainfo", "mediainfo.exe");
		if ($path) {
			TwitchConfig::setConfig('mediainfo_path', $path);
			TwitchConfig::saveConfig("path resolver");
			return $path;
		}

		return false;
	}

	public static function path_twitchdownloader()
	{

		if (TwitchConfig::cfg('twitchdownloader_path')) return TwitchConfig::cfg('twitchdownloader_path');

		$path = self::whereis("TwitchDownloaderCLI", "TwitchDownloaderCLI.exe");
		if ($path) {
			TwitchConfig::setConfig('twitchdownloader_path', $path);
			TwitchConfig::saveConfig("path resolver");
			return $path;
		}

		return false;
	}

	public static function find_bin_dir()
	{
		if (self::is_windows()) {
			TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Windows system, requesting bin dir from path...");
			$out = TwitchHelper::exec(["where", "streamlink.exe"]);
			if ($out) {
				$path = explode("\n", $out)[0];
				TwitchConfig::setConfig('bin_dir', pathinfo($path, PATHINFO_DIRNAME));
				TwitchConfig::saveConfig("bin path resolver");
				return $path;
			}
		} else {
			TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Linux system, requesting bin dir from path...");
			$out = TwitchHelper::exec(["whereis", "streamlink"]);
			if ($out) {
				preg_match("/^[a-z]+\:\s([a-z\-\_\/\.]+)/", $out, $matches);
				if ($matches) {
					$path = $matches[1];
					TwitchConfig::setConfig('bin_dir', pathinfo($path, PATHINFO_DIRNAME));
					TwitchConfig::saveConfig("bin path resolver");
					return $path;
				}
			}
		}
		return false;
	}

	public static function path_streamlink()
	{
		$path = TwitchConfig::cfg('bin_dir') . DIRECTORY_SEPARATOR . "streamlink" . (self::is_windows() ? '.exe' : '');
		return file_exists($path) ? $path : false;
	}

	public static function path_youtubedl()
	{
		$path = TwitchConfig::cfg('bin_dir') . DIRECTORY_SEPARATOR . "youtube-dl" . (TwitchConfig::cfg('youtube_dlc') ? 'c' : '') . (self::is_windows() ? '.exe' : '');
		return file_exists($path) ? $path : false;
	}

	public static function path_tcd()
	{
		$path = TwitchConfig::cfg('bin_dir') . DIRECTORY_SEPARATOR . "tcd" . (self::is_windows() ? '.exe' : '');
		return file_exists($path) ? $path : false;
	}

	public static function path_pipenv()
	{
		$path = TwitchConfig::cfg('bin_dir') . DIRECTORY_SEPARATOR . "pipenv" . (self::is_windows() ? '.exe' : '');
		return file_exists($path) ? $path : false;
	}
}
