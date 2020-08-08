<?php

namespace App\Controller;

use Slim\Psr7\Request;
use Slim\Psr7\Response;

use App\TwitchAutomator;
use App\TwitchConfig;
use App\TwitchHelper;

class CutController
{

    /**
     * TODO: Make this POST
     *
     * @return void
     */
    public function cut( Request $request, Response $response, $args )
    {
        set_time_limit(0);

        $TwitchAutomator = new TwitchAutomator();

        if( isset( $_GET['vod'] ) ){

            $vod = mb_ereg_replace("([^\w\s\d\-_~,;\[\]\(\).])", '', $_GET['vod']);

            $json = json_decode(file_get_contents(TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . $vod . '.json'), true);

            $second_start = (int)$_GET['start'];
            $second_end = (int)$_GET['end'];

            $filename_in = TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . $vod . '.mp4';
            $filename_out = TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . 'clips' . DIRECTORY_SEPARATOR . $vod . '-cut-' . $second_start . '-' . $second_end . '.mp4';

            $cmd = TwitchConfig::cfg('ffmpeg_path');
            $cmd .= ' -i ' . escapeshellarg($filename_in); // input file
            $cmd .= ' -ss ' . escapeshellarg($second_start); // start timestamp
            $cmd .= ' -t ' . escapeshellarg($second_end - $second_start); // length
            $cmd .= ' -codec copy'; // remux
            $cmd .= ' ' . escapeshellarg($filename_out); // output file

            echo $cmd;

            $output = shell_exec($cmd);

            file_put_contents(__DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . 'logs' . DIRECTORY_SEPARATOR . 'ffmpeg_' . $vod . '-cut-' . $second_start . '-' . $second_end . '_' . time() . '.log', $output);

            echo 'done';

            $response->getBody()->write("Done");

        }else{

            $response->getBody()->write("No VOD supplied");

        }

        return $response;

    }
}