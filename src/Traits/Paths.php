<?php declare(strict_types=1);

namespace App\Traits;

use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\Process;
use App\TwitchConfig;
use App\TwitchHelper;

trait Paths {

    // path helpers
	public static function is_windows() : bool {
		return strtoupper(substr(PHP_OS, 0, 3)) === 'WIN';
	}

	public static function path_ffmpeg() {		
		
		if( TwitchConfig::cfg('ffmpeg_path') ) return TwitchConfig::cfg('ffmpeg_path');

		/*
		if( self::is_windows() ){
			TwitchHelper::log( TwitchHelper::LOG_DEBUG, "Windows system, requesting ffmpeg binary from path...");
			$out = shell_exec("where ffmpeg.exe");
			if($out){
				$path = explode("\n", $out)[0];
				TwitchConfig::$config['ffmpeg_path'] = $path;
				TwitchConfig::saveConfig("path resolver");
				return $path;
			}
		}else{
			TwitchHelper::log( TwitchHelper::LOG_DEBUG, "Linux system, requesting ffmpeg binary from path...");
			$out = shell_exec("whereis ffmpeg");
			if($out){
				preg_match("/^[a-z]+\:\s([a-z\-\_\/\.]+)/", $out, $matches);
				if($matches){
					$path = $matches[1];
					TwitchConfig::$config['ffmpeg_path'] = $path;
					TwitchConfig::saveConfig("path resolver");
					return $path;
				}
			}
		}*/
		
		$path = self::whereis("ffmpeg", "ffmpeg.exe");
		if($path){
			TwitchConfig::$config['ffmpeg_path'] = $path;
			TwitchConfig::saveConfig("path resolver");
			return $path;
		}

		return false;

	}

	public static function path_mediainfo(){
		
		if( TwitchConfig::cfg('mediainfo_path') ) return TwitchConfig::cfg('mediainfo_path');
		// if( file_exists("/usr/bin/mediainfo") ) return "/usr/bin/mediainfo";

		/*
		// TODO: merge these two
		if( self::is_windows() ){
			TwitchHelper::log( TwitchHelper::LOG_DEBUG, "Windows system, requesting mediainfo binary from path...");
			$out = shell_exec("where mediainfo.exe");
			if($out){
				$path = explode("\n", $out)[0];
				TwitchConfig::$config['mediainfo_path'] = $path;
				TwitchConfig::saveConfig("path resolver");
				return $path;
			}
		}else{
			TwitchHelper::log( TwitchHelper::LOG_DEBUG, "Linux system, requesting mediainfo binary from path...");
			$out = shell_exec("whereis mediainfo");
			if($out){
				preg_match("/^[a-z]+\:\s([a-z\-\_\/\.]+)/", $out, $matches);
				if($matches){
					$path = $matches[1];
					TwitchConfig::$config['mediainfo_path'] = $path;
					TwitchConfig::saveConfig("path resolver");
					return $path;
				}
			}
		}

		return false;
		*/

		$path = self::whereis("mediainfo", "mediainfo.exe");
		if($path){
			TwitchConfig::$config['mediainfo_path'] = $path;
			TwitchConfig::saveConfig("path resolver");
			return $path;
		}

		return false;

	}

	public static function path_twitchdownloader(){
		
		if( TwitchConfig::cfg('twitchdownloader_path') ) return TwitchConfig::cfg('twitchdownloader_path');

		/*
		// TODO: merge these two
		if( self::is_windows() ){
			TwitchHelper::log( TwitchHelper::LOG_DEBUG, "Windows system, requesting TwitchDownloaderCLI binary from path...");
			$out = shell_exec("where TwitchDownloaderCLI.exe");
			if($out){
				$path = explode("\n", $out)[0];
				TwitchConfig::$config['twitchdownloader_path'] = $path;
				TwitchConfig::saveConfig("path resolver");
				return $path;
			}
		}else{
			TwitchHelper::log( TwitchHelper::LOG_DEBUG, "Linux system, requesting TwitchDownloaderCLI binary from path...");
			$out = shell_exec("whereis TwitchDownloaderCLI");
			if($out){
				preg_match("/^[A-Za-z]+\:\s([A-Za-z\-\_\/\.]+)/", $out, $matches);
				if($matches){
					$path = $matches[1];
					TwitchConfig::$config['twitchdownloader_path'] = $path;
					TwitchConfig::saveConfig("path resolver");
					return $path;
				}
				TwitchHelper::log( TwitchHelper::LOG_DEBUG, "No matches from TwitchDownloaderCLI whereis (" . implode(", ", $matches) . ")...");
			}else{
				TwitchHelper::log( TwitchHelper::LOG_DEBUG, "No output from TwitchDownloaderCLI whereis...");
			}
		}
		return false;
		*/

		$path = self::whereis("TwitchDownloaderCLI", "TwitchDownloaderCLI.exe");
		if($path){
			TwitchConfig::$config['twitchdownloader_path'] = $path;
			TwitchConfig::saveConfig("path resolver");
			return $path;
		}

		return false;
		
	}

	public static function find_bin_dir(){
		if( self::is_windows() ){
			TwitchHelper::log( TwitchHelper::LOG_DEBUG, "Windows system, requesting bin dir from path...");
			$out = TwitchHelper::exec( ["where", "streamlink.exe"] );
			if($out){
				$path = explode("\n", $out)[0];
				TwitchConfig::$config['bin_dir'] = pathinfo($path, PATHINFO_DIRNAME);
				TwitchConfig::saveConfig("bin path resolver");
				return $path;
			}
		}else{
			TwitchHelper::log( TwitchHelper::LOG_DEBUG, "Linux system, requesting bin dir from path...");
			$out = TwitchHelper::exec( ["whereis", "streamlink"] );
			if($out){
				preg_match("/^[a-z]+\:\s([a-z\-\_\/\.]+)/", $out, $matches);
				if($matches){
					$path = $matches[1];
					TwitchConfig::$config['bin_dir'] = pathinfo($path, PATHINFO_DIRNAME);
					TwitchConfig::saveConfig("bin path resolver");
					return $path;
				}
			}
		}
		return false;
	}

	public static function path_streamlink(){
		$path = TwitchConfig::cfg('bin_dir') . DIRECTORY_SEPARATOR . "streamlink" . ( self::is_windows() ? '.exe' : '' );
		return file_exists($path) ? $path : false;
	}

	public static function path_youtubedl(){
		$path = TwitchConfig::cfg('bin_dir') . DIRECTORY_SEPARATOR . "youtube-dl" . ( TwitchConfig::cfg('youtube_dlc') ? 'c' : '' ) . ( self::is_windows() ? '.exe' : '' );
		return file_exists($path) ? $path : false;
	}

	public static function path_tcd(){
		$path = TwitchConfig::cfg('bin_dir') . DIRECTORY_SEPARATOR . "tcd" . ( self::is_windows() ? '.exe' : '' );
		return file_exists($path) ? $path : false;
	}

	public static function path_pipenv(){
		$path = TwitchConfig::cfg('bin_dir') . DIRECTORY_SEPARATOR . "pipenv" . ( self::is_windows() ? '.exe' : '' );
		return file_exists($path) ? $path : false;
	}


}