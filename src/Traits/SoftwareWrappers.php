<?php

namespace App\Traits;

use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\Process;
use App\TwitchConfig;
use App\TwitchHelper;

trait SoftwareWrappers {

    public static function whereis( $name_linux, $name_windows ){

		if( self::is_windows() ){
           
            $process = new Process( ['where', $name_windows] );
            $process->run();

			if($process->getOutput()){
				$path = explode("\n", $process->getOutput())[0];
				return $path;
            }
            
		}else{
            
            $process = new Process( ['whereis', $name_linux] );
            $process->run();

			if($process->getOutput()){
				preg_match("/^[a-z]+\:\s([a-z\-\_\/\.]+)/", $process->getOutput(), $matches);
				if($matches){
					$path = $matches[1];
					return $path;
				}
            }
            
		}

		return false;

	}

	public static function mediainfo( $filename ){

		TwitchHelper::log( TwitchHelper::LOG_DEBUG, "Run mediainfo on " . $filename );

        // $output = shell_exec( TwitchHelper::path_mediainfo() . ' --Full --Output=JSON ' . escapeshellarg($filename) );
        $process = new Process( [TwitchHelper::path_mediainfo(), '--Full', '--Output=JSON', $filename] );
        $process->run();

		if( $process->getOutput() ){
			
			$json = json_decode( $process->getOutput(), true );
			
			$data = [];

			foreach( $json['media']['track'] as $track ){
				if( $track["@type"] == "General"){
					$data['general'] = $track;
				}else if( $track["@type"] == "Video"){
					$data['video'] = $track;
				}else if( $track["@type"] == "Audio"){
					$data['audio'] = $track;
				}
			}

			return $data;

		}else{

            return false;
            
		}

    }
    
}