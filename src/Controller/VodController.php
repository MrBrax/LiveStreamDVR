<?php

declare(strict_types=1);

namespace App\Controller;

use Slim\Psr7\Request;
use Slim\Psr7\Response;

use App\TwitchAutomator;
use App\TwitchConfig;
use App\TwitchHelper;
use App\TwitchVOD;
use App\TwitchAutomatorJob;
use Slim\Views\Twig;

use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\Process;

class VodController
{

    /**
     * @var Twig
     */
    private $twig;

    public function __construct(Twig $twig)
    {
        $this->twig = $twig;
    }

    /**
     * Cut up the vod
     *
     * @return void
     */
    public function cut(Request $request, Response $response, $args)
    {

        set_time_limit(0);

        // $TwitchAutomator = new TwitchAutomator();

        if (isset($_POST['vod'])) {

            $vod = mb_ereg_replace("([^\w\s\d\-_~,;\[\]\(\).])", '', $_POST['vod']);

            $username = explode("_", $vod)[0];

            // $json = json_decode(file_get_contents(TwitchHelper::vodFolder($username) . DIRECTORY_SEPARATOR . $vod . '.json'), true);

            $second_start   = (int)$_POST['start'];
            $second_end     = (int)$_POST['end'];
            $name           = $_POST['name'];

            if (!$second_start || $second_start > $second_end) {
                $response->getBody()->write("Invalid start time ({$second_start})");
                return $response;
            }

            if (!$second_end || $second_end < $second_start) {
                $response->getBody()->write("Invalid end time ({$second_end})");
                return $response;
            }


            $filename_in = TwitchHelper::vodFolder($username) . DIRECTORY_SEPARATOR . $vod . '.mp4';
            $filename_out = TwitchHelper::$public_folder . DIRECTORY_SEPARATOR . "saved_clips" . DIRECTORY_SEPARATOR . $vod . '-cut-' . $second_start . '-' . $second_end . ($name ? '-' . $name : '') . '.mp4';

            if (file_exists($filename_out)) {
                $response->getBody()->write("Output file already exists");
                return $response;
            }

            $cmd = [];

            $cmd[] = TwitchConfig::cfg('ffmpeg_path');

            $cmd[] = '-i';
            $cmd[] = $filename_in; // input file

            $cmd[] = '-ss';
            $cmd[] = $second_start; // start timestamp

            $cmd[] = '-t';
            $cmd[] = $second_end - $second_start; // length

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
                $cmd[] = 'copy'; // remux
            }

            $cmd[] = $filename_out; // output file

            $env = [
                // 'DOTNET_BUNDLE_EXTRACT_BASE_DIR' => __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "cache",
                'PATH' => dirname(TwitchHelper::path_ffmpeg()),
                'TEMP' => TwitchHelper::$cache_folder
            ];

            $process = new Process($cmd, $this->directory, $env, null, null);
            $process->start();

            // $pidfile = TwitchHelper::$pids_folder . DIRECTORY_SEPARATOR . 'vod_cut_' . $vod . '.pid';
            // file_put_contents($pidfile, $process->getPid());
            $vod_cutJob = new TwitchAutomatorJob("vod_cut_{$vod}");
            $vod_cutJob->setPid($process->getPid());
            $vod_cutJob->setProcess($process);
            $vod_cutJob->save();
        
            $process->wait();

            // if (file_exists($pidfile)) unlink($pidfile);
            $vod_cutJob->clear();

            $response->getBody()->write("$ " . implode(" ", $cmd));

            TwitchHelper::appendLog("ffmpeg_{$vod}-cut-{$second_start}-{$second_end}_" . time() . "_stdout.log", "$ " . implode(" ", $cmd) . "\n" . $process->getOutput());
            TwitchHelper::appendLog("ffmpeg_{$vod}-cut-{$second_start}-{$second_end}_" . time() . "_stderr.log", "$ " . implode(" ", $cmd) . "\n" . $process->getErrorOutput());

            $response->getBody()->write("<pre>" . $process->getOutput() . "</pre>");
            $response->getBody()->write("<pre>" . $process->getErrorOutput() . "</pre>");

            $response->getBody()->write("Done");
        } else {

            $response->getBody()->write("No VOD supplied");
        }

        return $response;
    }

    /*
    public function convert(Request $request, Response $response, $args)
    {

        $vod = $args['vod'];
        // $vod = mb_ereg_replace("([^\w\s\d\-_~,;\[\]\(\).])", '', $_GET['vod']);
        $username = explode("_", $vod)[0];

        $vodclass = new TwitchVOD();
        $vodclass->load(TwitchHelper::vodFolder($username) . DIRECTORY_SEPARATOR . $vod . '.json');
        $vodclass->convert();

        $response->getBody()->write("VOD converted");

        return $response;
    }
    */

    public function troubleshoot(Request $request, Response $response, $args)
    {

        $vod = $args['vod'];
        // $vod = mb_ereg_replace("([^\w\s\d\-_~,;\[\]\(\).])", '', $_GET['vod']);
        $username = explode("_", $vod)[0];

        $vodclass = new TwitchVOD();
        $vodclass->load(TwitchHelper::vodFolder($username) . DIRECTORY_SEPARATOR . $vod . '.json');

        $issue = $vodclass->troubleshoot(isset($_GET['fix']));
        if ($issue) {
            $response->getBody()->write($issue['text']);
        } else {
            $response->getBody()->write("found nothing wrong");
        }

        if (isset($_GET['fix']) && $issue['fixable']) {
            $response->getBody()->write("<br>trying to fix!");
        }

        return $response;
    }
}
