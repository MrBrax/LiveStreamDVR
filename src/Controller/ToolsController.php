<?php

namespace App\Controller;

use Slim\Psr7\Request;
use Slim\Psr7\Response;

use App\TwitchAutomator;
use App\TwitchConfig;
use App\TwitchHelper;
use Slim\Views\Twig;

use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\Process;

class ToolsController {

    /**
     * @var Twig
     */
    private $twig;

    private $logs = [];

    public function __construct(Twig $twig) {
        $this->twig = $twig;
    }

    public function tools(Request $request, Response $response, array $args) {
	
		$saved_vods = glob( TwitchHelper::$public_folder . DIRECTORY_SEPARATOR . "saved_vods" . DIRECTORY_SEPARATOR . "*.mp4");
		
        return $this->twig->render($response, 'tools.twig', [
			'saved_vods' => $saved_vods
        ]);

    }

    private function mediainfo( $filename ){

		$output = shell_exec( TwitchHelper::path_mediainfo() . ' --Full --Output=JSON ' . escapeshellarg($filename) );

		if( $output ){
			
			$json = json_decode( $output, true );
			
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

    private function downloadChat( $video_id, $destination ){

        if( !TwitchHelper::path_tcd() ) return false;	

		$cmd = [];

		if( TwitchConfig::cfg('pipenv') ){
			$cmd[] = 'pipenv run tcd';
		}else{
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
		
		if( TwitchConfig::cfg('debug', false) || TwitchConfig::cfg('app_verbose', false) ){
			$cmd[] = '--verbose';
			$cmd[] = '--debug';
		}

		$cmd[] = '--output';
		$cmd[] = TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . 'tools';

		// $capture_output = shell_exec( $cmd );

		$process = new Process( $cmd, TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . 'tools', null, null, null );
        $process->run();
        
        $tcd_filename = TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . 'tools' . DIRECTORY_SEPARATOR . $video_id . '.json';

        $this->logs['tcd']['stdout'] = $process->getOutput();
        $this->logs['tcd']['stderr'] = $process->getErrorOutput();

		if( file_exists( $tcd_filename ) ){
			rename( $tcd_filename, $destination );
		}

		$successful = file_exists( $destination ) && filesize( $destination ) > 0;

		return $successful;

	}

    private function downloadVod( $video_id, $destination, $quality ){
        
        if( !TwitchHelper::path_streamlink() ) return false;		

        $video_url = 'https://www.twitch.tv/videos/' . $video_id;

        $cmd = [];

        if( TwitchConfig::cfg('pipenv') ){
            $cmd[] = 'pipenv run streamlink';
        }else{
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

        $process = new Process( $cmd, dirname($destination), null, null, null );
        $process->run();

        $this->logs['streamlink']['stdout'] = $process->getOutput();
        $this->logs['streamlink']['stderr'] = $process->getErrorOutput();

        $successful = file_exists( $destination ) && filesize( $destination ) > 0;

        return $successful;
        
    }

    private function remuxMp4( $source, $destination ){

        $cmd = [];

		$cmd[] = TwitchHelper::path_ffmpeg();
		
		$cmd[] = '-i';
		$cmd[] = $source; // input filename
		
		$cmd[] = '-codec';
		$cmd[] = 'copy'; // use same codec

		$cmd[] = '-bsf:a';
		$cmd[] = 'aac_adtstoasc'; // fix audio sync in ts
		
		if( TwitchConfig::cfg('debug', false) || TwitchConfig::cfg('app_verbose', false) ){
			$cmd[] = '-loglevel';
			$cmd[] = 'repeat+level+verbose';
		}

		$cmd[] = $destination; // output filename

		$process = new Process( $cmd, dirname($source), null, null, null );
		$process->run();

        $this->logs['ffmpeg']['stdout'] = $process->getOutput();
        $this->logs['ffmpeg']['stderr'] = $process->getErrorOutput();

		if( file_exists( $source ) && file_exists($destination) && filesize( $destination) > 0 ){
			unlink( $source );
		}

        $successful = file_exists( $destination ) && filesize( $destination ) > 0;

        return $successful;
        
    }

    private function renderChat( $video_id, $video_filename, $chat_filename, $destination ){

		if( !TwitchHelper::path_twitchdownloader() || !file_exists( TwitchHelper::path_twitchdownloader() ) ){
			throw new \Exception('TwitchDownloaderCLI not installed');
			return false;
		}

		if( !TwitchHelper::path_mediainfo() ){
			throw new \Exception('Mediainfo not installed');
			return false;
		}

		// $chat_filename = $this->directory . DIRECTORY_SEPARATOR . $this->basename . '.chat';
		// $video_filename = $this->directory . DIRECTORY_SEPARATOR . $this->basename . '_chat.mp4';
        
		$mediainfo = $this->mediainfo( $video_filename );
		
		if(!$mediainfo){
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
		$cmd[] = realpath( $chat_filename );
		
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

		// $cmd[] = TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . 'tools' . DIRECTORY_SEPARATOR . $video_id . '_chat.mp4';
		// $cmd[] = ' 2>&1'; // console output
		
		$env = [
			// 'DOTNET_BUNDLE_EXTRACT_BASE_DIR' => __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "cache",
			'PATH' => dirname( TwitchHelper::path_ffmpeg() ),
            'TEMP' => TwitchHelper::$cache_folder,
            'TMP' => TwitchHelper::$cache_folder,
		];

		$process = new Process( $cmd, TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . 'tools', $env, null, null );

		$process->run();
		
        $this->logs['td_chat']['stdout'] = $process->getOutput();
        $this->logs['td_chat']['stderr'] = $process->getErrorOutput();
    

		if( strpos( $process->getErrorOutput(), "Unhandled exception") !== false ){
			throw new \Exception('Error when running TwitchDownloaderCLI.');
			return false;
		}

		$successful = file_exists( $destination ) && filesize( $destination ) > 0;

		return $successful;

    }

    private function burnChat( $video_id, $video_filename, $chatrender_filename, $destination ){

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

		$process = new Process( $cmd, dirname($video_filename), null, null, null );

		$process->run();

        $this->logs['td_burn']['stdout'] = $process->getOutput();
        $this->logs['td_burn']['stderr'] = $process->getErrorOutput();

		$successful = file_exists( $destination ) && filesize( $destination ) > 0;

		return $successful;

	}

    public function fullvodburn(Request $request, Response $response, array $args) {

        $url        = $_POST['url'];
        $quality    = $_POST['quality'];

        set_time_limit(0);

        preg_match("/\/videos\/([0-9]+)/", $url, $matches);

        if(!$matches){
            return $this->twig->render($response, 'dialog.twig', [
                'text' => 'No video found: ' . $url,
                'type' => 'error'
            ]);
        }

        $video_id = $matches[1];

        $response->getBody()->write( "Beginning download of " . $video_id );

        $basedir = TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . 'tools';
        if( !file_exists( $basedir ) ){
            mkdir( $basedir );
        }

        $srcfile        	= $basedir . DIRECTORY_SEPARATOR . $video_id . "_" . $quality . ".ts";
        $dstfile        	= $basedir . DIRECTORY_SEPARATOR . $video_id . "_" . $quality . ".mp4";
        $chatfile       	= $basedir . DIRECTORY_SEPARATOR . $video_id . "_" . $quality . "_chat.json";
		$chatrender     	= $basedir . DIRECTORY_SEPARATOR . $video_id . "_" . $quality . "_chat.mp4";
		$chatrender_mask	= str_replace(".mp4", "_mask.mp4", $chatrender);
        // $burned         	= $basedir . DIRECTORY_SEPARATOR . $video_id . "_burned.mp4";
        $burned        		= TwitchHelper::$public_folder . DIRECTORY_SEPARATOR . 'saved_vods' . DIRECTORY_SEPARATOR . $video_id . "_" . $quality . "_burned.mp4";

		if( file_exists( $burned ) ){
			$response->getBody()->write( "VOD has already been burned." );
			return $response;
		}

        if( !file_exists( $dstfile ) && !file_exists( $srcfile ) ){
            if( $this->downloadVod( $video_id, $srcfile, $quality ) ){
                $response->getBody()->write( "<br>VOD download successful" );
            }else{
				$response->getBody()->write( "<br>VOD download error" );
				$response->getBody()->write( "<pre>" . print_r( $this->logs, true ) . "</pre>" );
				return $response;
            }
        }

        if( !file_exists( $dstfile ) && file_exists( $srcfile ) ){
            if( $this->remuxMp4( $srcfile, $dstfile ) ){
                $response->getBody()->write( "<br>Remux successful" );
            }else{
				$response->getBody()->write( "<br>Remux error" );
				$response->getBody()->write( "<pre>" . print_r( $this->logs, true ) . "</pre>" );
				return $response;
            }
        }

        if( !file_exists( $chatfile ) ){
            if( $this->downloadChat( $video_id, $chatfile ) ){
                $response->getBody()->write( "<br>Chat download successful" );
            }else{
				$response->getBody()->write( "<br>Chat download error" );
				$response->getBody()->write( "<pre>" . print_r( $this->logs, true ) . "</pre>" );
				return $response;
            }
        }

        if( !file_exists( $chatrender ) ){
            if( $this->renderChat( $video_id, $dstfile, $chatfile, $chatrender ) ){
                $response->getBody()->write( "<br>Chat render successful" );
            }else{
				$response->getBody()->write( "<br>Chat render error" );
				$response->getBody()->write( "<pre>" . print_r( $this->logs, true ) . "</pre>" );
				return $response;
            }
        }

        if( !file_exists( $burned ) ){
            if( $this->burnChat( $video_id, $dstfile, $chatrender, $burned ) ){
                $response->getBody()->write( "<br>Chat burn successful" );
            }else{
				$response->getBody()->write( "<br>Chat burn error" );
				$response->getBody()->write( "<pre>" . print_r( $this->logs, true ) . "</pre>" );
				return $response;
            }
		}
		
		unlink($srcfile);
		unlink($dstfile);
		unlink($chatfile);
		unlink($chatrender);
		unlink($chatrender_mask);
        
        $response->getBody()->write( "<br>Done?" );

        $response->getBody()->write( "<pre>" . print_r( $this->logs, true ) . "</pre>" );

        return $response;

    }

}