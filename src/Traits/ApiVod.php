<?php


namespace App\Traits;

use Slim\Psr7\Request;
use Slim\Psr7\Response;

use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\Process;
use App\TwitchConfig;
use App\TwitchHelper;
use App\TwitchVOD;
use App\TwitchAutomatorJob;
use App\Exporters\YouTubeExporter;

trait ApiVod
{

    /**
     * @todo: make responses more automated
     */

    public function vod(Request $request, Response $response, $args)
    {

        $vod = $args['vod'];

        $username = explode("_", $vod)[0];

        $vodclass = new TwitchVOD();
        
        try {
            $vodclass->load(TwitchHelper::vodFolder($username) . DIRECTORY_SEPARATOR . $vod . '.json');
        } catch (\Throwable $th) {
            $response->getBody()->write(json_encode([
                "data" => $th->getMessage(),
                "status" => "ERROR"
            ]));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json'); 
        } 

        $data = $vodclass;

        $payload = json_encode([
            'data' => $data,
            'status' => 'OK'
        ]);
        $response->getBody()->write($payload);
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function vod_search_chatdump(Request $request, Response $response, $args)
    {

        $vod = $args['vod'];

        $username = explode("_", $vod)[0];

        $vodclass = new TwitchVOD();
        $vodclass->load(TwitchHelper::vodFolder($username) . DIRECTORY_SEPARATOR . $vod . '.json');

        if (!isset($_GET['words'])) {

            $payload = json_encode([
                'message' => 'No words provided',
                'status' => 'ERROR'
            ]);
        } else {

            $words = explode(",", $_GET['words']);

            $data = $vodclass->searchChatDump($words);

            $payload = json_encode([
                'data' => $data,
                'status' => 'OK'
            ]);
        }

        $response->getBody()->write($payload);
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function vod_download_chat(Request $request, Response $response, $args)
    {

        set_time_limit(0);

        $vod = $args['vod'];
        // $vod = mb_ereg_replace("([^\w\s\d\-_~,;\[\]\(\).])", '', $_GET['vod']);
        $username = explode("_", $vod)[0];

        $vodclass = new TwitchVOD();
        $vodclass->load(TwitchHelper::vodFolder($username) . DIRECTORY_SEPARATOR . $vod . '.json');

        if ($vodclass->twitch_vod_id) {

            if ($vodclass->downloadChat()) {
                $payload = json_encode([
                    'data' => 'Chat downloaded',
                    'status' => 'OK'
                ]);
            } else {
                $payload = json_encode([
                    'data' => 'Chat download unsuccessful',
                    'status' => 'ERROR'
                ]);
            }
        } else {
            $payload = json_encode([
                'error' => 'VOD has no ID',
                'status' => 'ERROR'
            ]);
        }

        $response->getBody()->write($payload);
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function vod_download(Request $request, Response $response, $args)
    {

        $vod = $args['vod'];
        // $vod = mb_ereg_replace("([^\w\s\d\-_~,;\[\]\(\).])", '', $_GET['vod']);
        $username = explode("_", $vod)[0];

        $vodclass = new TwitchVOD();
        $vodclass->load(TwitchHelper::vodFolder($username) . DIRECTORY_SEPARATOR . $vod . '.json');

        if ($vodclass->downloadVod()) {
            $payload = json_encode([
                'data' => 'VOD downloaded',
                'status' => 'OK'
            ]);
        } else {
            $payload = json_encode([
                'error' => 'VOD could not be downloaded',
                'status' => 'ERROR'
            ]);
        }

        $response->getBody()->write($payload);
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function vod_check_mute(Request $request, Response $response, $args)
    {

        $vod = $args['vod'];
        // $vod = mb_ereg_replace("([^\w\s\d\-_~,;\[\]\(\).])", '', $_GET['vod']);
        $username = explode("_", $vod)[0];

        $vodclass = new TwitchVOD();
        $vodclass->load(TwitchHelper::vodFolder($username) . DIRECTORY_SEPARATOR . $vod . '.json');

        if (!$vodclass->twitch_vod_id) {
            $payload = json_encode([
                'data' => 'VOD does not have an ID',
                'status' => 'ERROR'
            ]);
            // $response->getBody()->write("VOD does not have an ID");
            // $response->getBody()->write($payload);
            // return $response->withHeader('Content-Type', 'application/json');
        } else {

            $isMuted = $vodclass->checkMutedVod(true);

            $payload = json_encode([
                'data' => [
                    'vod' => $vod,
                    'muted' => $isMuted
                ],
                'status' => 'OK'
            ]);
        }

        $response->getBody()->write($payload);
        return $response->withHeader('Content-Type', 'application/json');
    }


    public function vod_render_chat(Request $request, Response $response, $args)
    {

        set_time_limit(0);

        $vod = $args['vod'];
        // $vod = mb_ereg_replace("([^\w\s\d\-_~,;\[\]\(\).])", '', $_GET['vod']);
        $username = explode("_", $vod)[0];

        $vodclass = new TwitchVOD();
        $vodclass->load(TwitchHelper::vodFolder($username) . DIRECTORY_SEPARATOR . $vod . '.json');

        $use_vod = isset($_GET['use_vod']);

        if ($vodclass->is_chat_downloaded) {
            $response->getBody()->write("Rendering");
            if ($vodclass->renderChat()) {
                $vodclass->burnChat(300, $use_vod);
            }
        } else {
            $response->getBody()->write("VOD has no chat downloaded");
        }

        return $response;
    }

    public function vod_full_burn(Request $request, Response $response, $args)
    {

        set_time_limit(0);

        $vod = $args['vod'];
        // $vod = mb_ereg_replace("([^\w\s\d\-_~,;\[\]\(\).])", '', $_GET['vod']);
        $username = explode("_", $vod)[0];

        $vodclass = new TwitchVOD();
        $vodclass->load(TwitchHelper::vodFolder($username) . DIRECTORY_SEPARATOR . $vod . '.json');

        if ($vodclass->is_chat_burned) {
            $response->getBody()->write("Chat already burned!");
            return $response;
        }

        $is_muted = $vodclass->checkMutedVod(true);

        // download chat if not downloaded
        if (!$vodclass->is_chat_downloaded) {
            $vodclass->downloadChat();
            // $response->getBody()->write("Chat downloaded<br>");
        }

        if (!$vodclass->is_chat_downloaded) {
            $payload = json_encode([
                'error' => "Chat doesn't exist!",
                'status' => 'ERROR'
            ]);
            return $response->withHeader('Content-Type', 'application/json');
        }

        if ($is_muted) { // if vod is muted, use captured one

            if ($vodclass->renderChat()) {
                $vodclass->burnChat();
                // $response->getBody()->write("Chat rendered and burned<br>");
            }
        } else { // if vod is not muted, use it

            // download vod if not downloaded already
            if (!$vodclass->is_vod_downloaded) {
                $vodclass->downloadVod();
                // $response->getBody()->write("VOD downloaded<br>");
            }

            // render and burn
            if ($vodclass->renderChat()) {
                $vodclass->burnChat(300, true);
                // $response->getBody()->write("Chat rendered and burned<br>");
            }
        }

        $payload = json_encode([
            'data' => 'VOD burned',
            'status' => 'OK'
        ]);

        $response->getBody()->write($payload);
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function vod_delete(Request $request, Response $response, $args)
    {

        $vod = $args['vod'];
        // $vod = mb_ereg_replace("([^\w\s\d\-_~,;\[\]\(\).])", '', $_GET['vod']);
        $username = explode("_", $vod)[0];

        $vodclass = new TwitchVOD();
        $vodclass->load(TwitchHelper::vodFolder($username) . DIRECTORY_SEPARATOR . $vod . '.json');
        $vodclass->delete();

        $payload = json_encode([
            'data' => 'VOD deleted',
            'status' => 'OK'
        ]);

        $response->getBody()->write($payload);
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function vod_save(Request $request, Response $response, $args)
    {

        $vod = $args['vod'];
        // $vod = mb_ereg_replace("([^\w\s\d\-_~,;\[\]\(\).])", '', $_GET['vod']);
        $username = explode("_", $vod)[0];

        $vodclass = new TwitchVOD();
        $vodclass->load(TwitchHelper::vodFolder($username) . DIRECTORY_SEPARATOR . $vod . '.json');
        $vodclass->save();

        $payload = json_encode([
            'data' => 'VOD saved',
            'status' => 'OK'
        ]);

        $response->getBody()->write($payload);
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function vod_export(Request $request, Response $response, $args)
    {

        $vod = $args['vod'];
        // $vod = mb_ereg_replace("([^\w\s\d\-_~,;\[\]\(\).])", '', $_GET['vod']);
        $username = explode("_", $vod)[0];

        $vodclass = new TwitchVOD();
        $vodclass->load(TwitchHelper::vodFolder($username) . DIRECTORY_SEPARATOR . $vod . '.json');

        
        $destination = isset($_POST['destination']) ? $_POST['destination'] : null;

        $exporter = null;
        switch ($destination) {
            case 'YouTube':
                $exporter = new YouTubeExporter();
                break;
        }

        if (!$exporter) {
            throw new \Exception("No exporter");
        }

        $exporter->setVod($vodclass);

        $output = null;

        if (isset($_GET['segment'])) {
            $output = $exporter->exportSegment($vodclass->segment, 0, 1);
        } else {
            $output = $exporter->exportAllSegments();
        }

        $payload = json_encode([
            'data' => "Exporter returned: " . implode(", ", $output),
            'status' => 'OK'
        ]);

        $response->getBody()->write($payload);
        return $response->withHeader('Content-Type', 'application/json');
    }

    /**
     * Cut up the vod
     *
     * @return void
     */
    public function vod_cut(Request $request, Response $response, $args)
    {

        set_time_limit(0);

        $vod = $args['vod'];
        // $vod = mb_ereg_replace("([^\w\s\d\-_~,;\[\]\(\).])", '', $_GET['vod']);
        $username = explode("_", $vod)[0];

        // $json = json_decode(file_get_contents(TwitchHelper::vodFolder($username) . DIRECTORY_SEPARATOR . $vod . '.json'), true);

        $second_start   = (int)$_POST['time_in'];
        $second_end     = (int)$_POST['time_out'];
        $name           = $_POST['name'];

        if (!$second_start || $second_start > $second_end) {
            $response->getBody()->write(json_encode([
                "data" => "Invalid start time ({$second_start})",
                "status" => "ERROR"
            ]));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        if (!$second_end || $second_end < $second_start) {
            $response->getBody()->write(json_encode([
                "data" => "Invalid end time ({$second_end})",
                "status" => "ERROR"
            ]));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        $filename_in = TwitchHelper::vodFolder($username) . DIRECTORY_SEPARATOR . $vod . '.mp4';
        $filename_out = TwitchHelper::$public_folder . DIRECTORY_SEPARATOR . "saved_clips" . DIRECTORY_SEPARATOR . $vod . '-cut-' . $second_start . '-' . $second_end . ($name ? '-' . $name : '') . '.mp4';

        if (file_exists($filename_out)) {
            $response->getBody()->write(json_encode([
                "data" => "Output file already exists",
                "status" => "ERROR"
            ]));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
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

        $process = new Process($cmd, TwitchHelper::vodFolder($username), $env, null, null);
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

        // $response->getBody()->write("$ " . implode(" ", $cmd));

        TwitchHelper::appendLog("ffmpeg_{$vod}-cut-{$second_start}-{$second_end}_" . time() . "_stdout.log", "$ " . implode(" ", $cmd) . "\n" . $process->getOutput());
        TwitchHelper::appendLog("ffmpeg_{$vod}-cut-{$second_start}-{$second_end}_" . time() . "_stderr.log", "$ " . implode(" ", $cmd) . "\n" . $process->getErrorOutput());

        // $response->getBody()->write("<pre>" . $process->getOutput() . "</pre>");
        // $response->getBody()->write("<pre>" . $process->getErrorOutput() . "</pre>");

        // $response->getBody()->write("Done");
        
        $success = file_exists($filename_out) && filesize($filename_out) > 0;

        if(!$success){
            $response->getBody()->write(json_encode([
                "message" => "Cut failed, please check the logs",
                "status" => "ERROR"
            ]));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        $response->getBody()->write(json_encode([
            "data" => [
                "log_stdout" => $process->getOutput(),
                "log_stderr" => $process->getErrorOutput(),
                "file_output" => $filename_out
            ],
            "message" => "Done",
            "status" => "OK"
        ]));
        return $response->withStatus(200)->withHeader('Content-Type', 'application/json');

    }

}
