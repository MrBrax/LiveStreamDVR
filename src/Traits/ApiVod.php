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
                "message" => $th->getMessage(),
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

            try {
                $chat_downloaded = $vodclass->downloadChat();
            } catch (\Throwable $th) {
                $response->getBody()->write(json_encode([
                    "message" => "Chat download fatal error: {$th->getMessage()}",
                    "status" => "ERROR"
                ]));
                return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
            }

            if ($chat_downloaded) {
                $payload = json_encode([
                    'message' => 'Chat downloaded',
                    'status' => 'OK'
                ]);
            } else {
                $payload = json_encode([
                    'message' => 'Chat download unsuccessful',
                    'status' => 'ERROR'
                ]);
            }
        } else {
            $payload = json_encode([
                'message' => 'VOD has no ID',
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
                'message' => 'VOD downloaded',
                'status' => 'OK'
            ]);
        } else {
            $payload = json_encode([
                'message' => 'VOD could not be downloaded',
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
            $response->getBody()->write(json_encode([
                'message' => 'VOD does not have an ID',
                'status' => 'ERROR'
            ]));
            return $response->withStatus(403)->withHeader('Content-Type', 'application/json');
        } else {

            try {
                $isMuted = $vodclass->checkMutedVod(true);
            } catch (\Throwable $th) {
                $response->getBody()->write(json_encode([
                    "message" => "VOD mute check error: {$th->getMessage()}",
                    "status" => "ERROR"
                ]));
                return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
            }

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
                'message' => "Chat doesn't exist!",
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
            'message' => 'VOD burned',
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
            'message' => 'VOD deleted',
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
            'message' => 'VOD saved',
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
            'message' => "Exporter returned: " . implode(", ", $output),
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
        $username = explode("_", $vod)[0];

        $vodclass = new TwitchVOD();
        $vodclass->load(TwitchHelper::vodFolder($username) . DIRECTORY_SEPARATOR . $vod . '.json');

        $second_start   = (int)$_POST['time_in'];
        $second_end     = (int)$_POST['time_out'];
        $name           = $_POST['name'];

        if (!$second_start || $second_start > $second_end) {
            $response->getBody()->write(json_encode([
                "message" => "Invalid start time ({$second_start})",
                "status" => "ERROR"
            ]));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        if (!$second_end || $second_end < $second_start) {
            $response->getBody()->write(json_encode([
                "message" => "Invalid end time ({$second_end})",
                "status" => "ERROR"
            ]));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        $filename_in = TwitchHelper::vodFolder($username) . DIRECTORY_SEPARATOR . $vod . '.mp4';

        $out_basename = $vod . '-cut-' . $second_start . '-' . $second_end . ($name ? '-' . $name : '');
        $filename_out = TwitchHelper::$public_folder . DIRECTORY_SEPARATOR . "saved_clips" . DIRECTORY_SEPARATOR . $out_basename . '.mp4';

        /*
        if (file_exists($filename_out)) {
            $response->getBody()->write(json_encode([
                "message" => "Output file already exists",
                "status" => "ERROR"
            ]));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }
        */
        if (!file_exists($filename_out)) {

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

            $vod_cutJob->clear();

            TwitchHelper::appendLog("ffmpeg_{$vod}-cut-{$second_start}-{$second_end}_" . time() . "_stdout.log", "$ " . implode(" ", $cmd) . "\n" . $process->getOutput());
            TwitchHelper::appendLog("ffmpeg_{$vod}-cut-{$second_start}-{$second_end}_" . time() . "_stderr.log", "$ " . implode(" ", $cmd) . "\n" . $process->getErrorOutput());

            $success = file_exists($filename_out) && filesize($filename_out) > 0;

            if (!$success) {
                $response->getBody()->write(json_encode([
                    "message" => "Cut failed, please check the logs",
                    "status" => "ERROR"
                ]));
                return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
            }
        }

        // shift all comments
        if ($vodclass->is_chat_downloaded || $vodclass->is_chatdump_captured) {
            // ini_set('memory_limit', '1024M');  
            $path_chat = $vodclass->is_chat_downloaded ? $vodclass->path_chat : $vodclass->path_chatdump;

            try {
                $json_contents = file_get_contents($path_chat);
            } catch (\Throwable $th) {
                $response->getBody()->write(json_encode([
                    "message" => $th->getMessage(),
                    "status" => "ERROR"
                ]));
                return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
            }

            try {
                $chatcontents = json_decode($json_contents, false, 512, JSON_THROW_ON_ERROR);
            } catch (\Throwable $th) {
                $response->getBody()->write(json_encode([
                    "message" => $th->getMessage(),
                    "status" => "ERROR"
                ]));
                return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
            }

            unset($json_contents);
            /*
            $new_chatcontents = [
                'comments' => [],
                'video' => $old_chatcontents->video
            ];
            */

            // update end time
            $chatcontents->video->duration = TwitchHelper::getTwitchDuration(abs($second_start - $second_end));

            foreach ($chatcontents->comments as $i => $comment) {
                if ($comment->content_offset_seconds < $second_start) {
                    unset($chatcontents->comments[$i]);
                    continue; // cut off start
                }
                if ($comment->content_offset_seconds > $second_end) {
                    unset($chatcontents->comments[$i]);
                    continue; // cut off end
                }
                // $comment['created_at'] = null;
                // $comment['updated_at'] = null;
                $comment->content_offset_seconds = round($comment->content_offset_seconds - $second_start, 3);
                // $new_chatcontents['comments'][] = $comment;
            }
            // $old_chatcontents = null;
            $json_out = json_encode($chatcontents, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            unset($chatcontents);
            file_put_contents(
                TwitchHelper::$public_folder . DIRECTORY_SEPARATOR . "saved_clips" . DIRECTORY_SEPARATOR . $out_basename . '.trimmed.chat',
                $json_out,
            );
            unset($json_out);
        }

        $response->getBody()->write(json_encode([
            "data" => [
                // "log_stdout" => $process->getOutput(),
                // "log_stderr" => $process->getErrorOutput(),
                "file_output" => $filename_out
            ],
            "message" => "Done",
            "status" => "OK"
        ]));
        return $response->withStatus(200)->withHeader('Content-Type', 'application/json');
    }
}
