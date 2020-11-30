<?php

declare(strict_types=1);

namespace App\Controller;

use App\TwitchConfig;
use App\TwitchHelper;
use Slim\Psr7\Request;
use Slim\Psr7\Response;
use Slim\Views\Twig;

use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\Process;

/**
 * About page
 */
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

        $pip_requirements = [];
        $requirements_file = __DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'requirements.txt';
        if(file_exists($requirements_file)){
            $requirements_data = file_get_contents($requirements_file);
            $lines = explode("\n", $requirements_data);
            foreach($lines as $line){
                preg_match("/^([a-z_-]+)([=<>]+)(.*)$/", $line, $matches);
                if($matches){
                    $pip_requirements[ trim($matches[1]) ] = [
                        'comparator' => trim($matches[2]),
                        'version' => trim($matches[3])
                    ];
                }
            }
        }

        $bins['ffmpeg'] = [];
        $bins['ffmpeg']['path'] = TwitchHelper::path_ffmpeg();
        if (TwitchHelper::path_ffmpeg() && file_exists(TwitchHelper::path_ffmpeg())) {
            $out = TwitchHelper::exec([TwitchHelper::path_ffmpeg(), "-version"]);
            $out = explode("\n", $out)[0];
            $bins['ffmpeg']['status'] = $out;
        } else {
            $bins['ffmpeg']['status'] = 'Not installed.';
        }

        $bins['mediainfo'] = [];
        $bins['mediainfo']['path'] = TwitchHelper::path_mediainfo();
        if (TwitchHelper::path_mediainfo() && file_exists(TwitchHelper::path_mediainfo())) {
            $out = TwitchHelper::exec([TwitchHelper::path_mediainfo(), "--Version"]);
            if ($out) {
                $out = explode("\n", $out)[1];
                $bins['mediainfo']['status'] = $out;
            } else {
                $bins['mediainfo']['status'] = 'Output error.';
            }
        } else {
            $bins['mediainfo']['status'] = 'Not installed.';
        }

        // tcd
        $bins['tcd'] = [];
        $bins['tcd']['path'] = TwitchHelper::path_tcd();
        if (TwitchHelper::path_tcd() && file_exists(TwitchHelper::path_tcd())) {
            $out = TwitchHelper::exec([TwitchHelper::path_tcd(), "--version", "--settings-file", TwitchHelper::$config_folder . DIRECTORY_SEPARATOR . "tcd_settings.json"]);
            $bins['tcd']['status'] = $out;
            $bins['tcd']['installed'] = true;

            $version = trim(substr($bins['tcd']['status'], 23));
            if(version_compare($version, $pip_requirements['tcd']['version'], $pip_requirements['tcd']['comparator'])){
                $bins['tcd']['update'] = 'Version OK';
            }else{
                $bins['tcd']['update'] = 'Please update to at least ' . $pip_requirements['tcd']['version'];
            }
        } else {
            $bins['tcd']['status'] = 'Not installed.';
        }


        // streamlink
        $bins['streamlink'] = [];
        $bins['streamlink']['path'] = TwitchHelper::path_streamlink();
        if (TwitchHelper::path_streamlink() && file_exists(TwitchHelper::path_streamlink())) {
            $out = TwitchHelper::exec([TwitchHelper::path_streamlink(), "--version"]);
            $bins['streamlink']['status'] = trim($out);
            $bins['streamlink']['installed'] = true;

            $version = trim(substr($bins['streamlink']['status'], 11));
            if(version_compare($version, $pip_requirements['streamlink']['version'], $pip_requirements['streamlink']['comparator'])){
                $bins['streamlink']['update'] = 'Version OK';
            }else{
                $bins['streamlink']['update'] = 'Please update to at least ' . $pip_requirements['streamlink']['version'];
            }
        } else {
            $bins['streamlink']['status'] = 'Not installed.';
        }

        // youtube-dl
        $bins['youtubedl'] = [];
        $bins['youtubedl']['path'] = TwitchHelper::path_youtubedl();
        if (TwitchHelper::path_youtubedl() && file_exists(TwitchHelper::path_youtubedl())) {
            $out = TwitchHelper::exec([TwitchHelper::path_youtubedl(), "--version"]);
            $bins['youtubedl']['status'] = trim($out);
            $bins['youtubedl']['installed'] = true;

            if(version_compare(trim($out), $pip_requirements['youtube-dl']['version'], $pip_requirements['youtube-dl']['comparator'])){
                $bins['youtubedl']['update'] = 'Version OK';
            }else{
                $bins['youtubedl']['update'] = 'Please update to at least ' . $pip_requirements['youtube-dl']['version'];
            }
        } else {
            $bins['youtubedl']['status'] = 'Not installed.';
        }

        $bins['twitchdownloader'] = [];
        $bins['twitchdownloader']['path'] = TwitchHelper::path_twitchdownloader();
        if (TwitchHelper::path_twitchdownloader() && file_exists(TwitchHelper::path_twitchdownloader())) {
            $out = TwitchHelper::exec([TwitchHelper::path_twitchdownloader(), "--version"], true);
            $bins['twitchdownloader']['status'] = trim($out);
            $bins['twitchdownloader']['installed'] = true;
        } else {
            $bins['twitchdownloader']['status'] = 'Not installed';
        }


        $bins['pipenv'] = [];
        $bins['pipenv']['path'] = TwitchHelper::path_pipenv();
        if (TwitchHelper::path_pipenv() && file_exists(TwitchHelper::path_pipenv())) {
            $out = TwitchHelper::exec([TwitchHelper::path_pipenv(), "--version"]);
            $bins['pipenv']['status'] = trim($out);
            $bins['pipenv']['installed'] = true;
        } else {
            $bins['pipenv']['status'] = 'Not installed';
        }
        $bins['pipenv']['status'] .= TwitchConfig::cfg('pipenv_enabled') ? ', <em>enabled</em>.' : ', <em>not enabled</em>.';


        $bins['python'] = [];
        $out = TwitchHelper::exec(["python", "--version"]);
        $bins['python']['version'] = trim($out);

        $bins['python3'] = [];
        $out = TwitchHelper::exec(["python3", "--version"]);
        $bins['python3']['version'] = trim($out);

        $bins['php'] = [];
        $bins['php']['version'] = phpversion();
        $bins['php']['platform'] = PHP_OS;
        $bins['php']['platform_family'] = PHP_OS_FAMILY;
        $bins['php']['sapi'] = PHP_SAPI;
        $bins['php']['user'] = get_current_user();
        $bins['php']['pid'] = getmypid();
        $bins['php']['uid'] = getmyuid();
        $bins['php']['gid'] = getmygid();

        return $this->twig->render($response, 'about.twig', [
            'bins' => $bins,
            // 'envs' => TwitchConfig::cfg('debug') ? getenv() : null
        ]);
    }
}
