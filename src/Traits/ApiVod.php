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

        try {
            $vodclass = TwitchVOD::load(TwitchHelper::vodFolder($username) . DIRECTORY_SEPARATOR . $vod . '.json', true);
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

        $vodclass = TwitchVOD::load(TwitchHelper::vodFolder($username) . DIRECTORY_SEPARATOR . $vod . '.json');

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

        $vodclass = TwitchVOD::load(TwitchHelper::vodFolder($username) . DIRECTORY_SEPARATOR . $vod . '.json');

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

        $vodclass = TwitchVOD::load(TwitchHelper::vodFolder($username) . DIRECTORY_SEPARATOR . $vod . '.json');

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

        $vodclass = TwitchVOD::load(TwitchHelper::vodFolder($username) . DIRECTORY_SEPARATOR . $vod . '.json');

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

    public function vod_delete(Request $request, Response $response, $args)
    {

        $vod = $args['vod'];
        // $vod = mb_ereg_replace("([^\w\s\d\-_~,;\[\]\(\).])", '', $_GET['vod']);
        $username = explode("_", $vod)[0];

        $vodclass = TwitchVOD::load(TwitchHelper::vodFolder($username) . DIRECTORY_SEPARATOR . $vod . '.json');
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

        $vodclass = TwitchVOD::load(TwitchHelper::vodFolder($username) . DIRECTORY_SEPARATOR . $vod . '.json');
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

        $vodclass = TwitchVOD::load(TwitchHelper::vodFolder($username) . DIRECTORY_SEPARATOR . $vod . '.json');

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

        $vodclass = TwitchVOD::load(TwitchHelper::vodFolder($username) . DIRECTORY_SEPARATOR . $vod . '.json');

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
            $vod_cutJob = TwitchAutomatorJob::create("vod_cut_{$vod}");
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



    public function vod_renderwizard(Request $request, Response $response, $args)
    {

        $vod = $args['vod'];
        $username = explode("_", $vod)[0];
        $vodclass = TwitchVOD::load(TwitchHelper::vodFolder($username) . DIRECTORY_SEPARATOR . $vod . '.json');

        $data = $request->getParsedBody();
        $chat_width = isset($data['chatWidth']) ? (int)$data['chatWidth'] : 300;
        $chat_height = isset($data['chatHeight']) ? (int)$data['chatHeight'] : 1080;
        $render_chat = isset($data['renderChat']) && $data['renderChat'];
        $burn_chat = isset($data['burnChat']) && $data['burnChat'];
        $vod_source = isset($data['vodSource']) ? $data['vodSource'] : 'captured';
        $chat_source = isset($data['chatSource']) ? $data['chatSource'] : 'captured';
        $chat_font = isset($data['chatFont']) ? $data['chatFont'] : 'Inter';
        $chat_font_size = isset($data['chatFontSize']) ? (int)$data['chatFontSize'] : 12;
        $burn_horizontal = isset($data['burnHorizontal']) ? $data['burnHorizontal'] : 'left';
        $burn_vertical = isset($data['burnVertical']) ? $data['burnVertical'] : 'top';
        $ffmpeg_preset = isset($data['ffmpegPreset']) ? $data['ffmpegPreset'] : 'slow';
        $ffmpeg_crf = isset($data['ffmpegCrf']) ? (int)$data['ffmpegCrf'] : 26;

        $status_renderchat = false;
        $status_burnchat = false;

        TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "vodclass", "Start render wizard for vod {$vod}");
        TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "vodclass", "chat_width: {$chat_width}");
        TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "vodclass", "chat_height: {$chat_height}");
        TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "vodclass", "render_chat: {$render_chat}");
        TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "vodclass", "burn_chat: {$burn_chat}");
        TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "vodclass", "vod_source: {$vod_source}");
        TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "vodclass", "chat_source: {$chat_source}");

        if ($render_chat) {
            try {
                $status_renderchat = $vodclass->renderChat($chat_width, $chat_height, $chat_font, $chat_font_size, $chat_source == "downloaded", true);
            } catch (\Throwable $th) {
                $response->getBody()->write(json_encode([
                    "message" => $th->getMessage(),
                    "status" => "ERROR"
                ]));
                return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
            }
            
        }

        if ($burn_chat) {
            try {
                $status_burnchat = $vodclass->burnChat($burn_horizontal, $burn_vertical, $ffmpeg_preset, $ffmpeg_crf, $vod_source == "downloaded", true);
            } catch (\Throwable $th) {
                $response->getBody()->write(json_encode([
                    "message" => $th->getMessage(),
                    "status" => "ERROR"
                ]));
                return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
            }
            
        }

        $response->getBody()->write(json_encode([
            "data" => [
                "status_renderchat" => $status_renderchat,
                "status_burnchat" => $status_burnchat,
            ],
            "status" => "OK"
        ]));
        return $response->withStatus(200)->withHeader('Content-Type', 'application/json');

    }
}
