<?php

namespace App\Controller;

use App\TwitchConfig;
use App\TwitchHelper;
use Slim\Psr7\Request;
use Slim\Psr7\Response;
use Slim\Views\Twig;

class AboutController
{

    /**
     * @var Twig
     */
    private $twig;

    public function __construct(Twig $twig)
    {
        $this->twig = $twig;
    }

    public function about(Request $request, Response $response, array $args)
    {
        $bins = [];

        $bins['ffmpeg'] = [];
        $bins['ffmpeg']['path'] = TwitchConfig::cfg("ffmpeg_path");
        if (file_exists(TwitchConfig::cfg("ffmpeg_path"))) {
            $out = shell_exec(TwitchConfig::cfg("ffmpeg_path") . " -version");
            $out = explode("\n", $out)[0];
            $bins['ffmpeg']['status'] = $out;
        } else {
            $bins['ffmpeg']['status'] = 'Not installed.';
        }


        $bins['tcd'] = [];
        $bins['tcd']['path'] = TwitchHelper::path_tcd();
        if (file_exists(TwitchHelper::path_tcd())) {
            $out = shell_exec(TwitchHelper::path_tcd() . " --version");
            $bins['tcd']['status'] = $out;
        } else {
            $bins['tcd']['status'] = 'Not installed.';
        }


        $bins['streamlink'] = [];
        $bins['streamlink']['path'] = TwitchHelper::path_streamlink();
        if (file_exists(TwitchHelper::path_streamlink())) {
            $out = shell_exec(TwitchHelper::path_streamlink() . " --version");
            $bins['streamlink']['status'] = trim($out);
        } else {
            $bins['streamlink']['status'] = 'Not installed.';
        }


        $bins['youtubedl'] = [];
        $bins['youtubedl']['path'] = TwitchHelper::path_youtubedl();
        if (file_exists(TwitchHelper::path_youtubedl())) {
            $out = shell_exec(TwitchHelper::path_youtubedl() . " --version");
            $bins['youtubedl']['status'] = trim($out);
        } else {
            $bins['youtubedl']['status'] = 'Not installed.';
        }


        $bins['pipenv'] = [];
        $bins['pipenv']['path'] = TwitchHelper::path_pipenv();
        if (file_exists(TwitchHelper::path_pipenv())) {
            $out = shell_exec(TwitchHelper::path_pipenv() . " --version");
            $bins['pipenv']['status'] = trim($out);
        } else {
            $bins['pipenv']['status'] = 'Not installed';
        }
        $bins['pipenv']['status'] .= TwitchConfig::cfg('pipenv') ? ', <em>enabled</em>.' : ', <em>not enabled</em>.';

        return $this->twig->render($response, 'about.twig', [
            'bins' => $bins
        ]);

    }
}