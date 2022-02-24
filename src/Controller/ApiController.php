<?php

declare(strict_types=1);

namespace App\Controller;

use Slim\Psr7\Request;
use Slim\Psr7\Response;

use App\TwitchConfig;
use App\TwitchPlaylistAutomator;

use App\Traits\ApiFavourites;

class ApiController
{

    use ApiFavourites;

    use Helpers\StreamerList;

    /**
     * @var Twig
     */
    private $twig;

    /*
    public function __construct(Twig $twig)
    {
        $this->twig = $twig;
    }
    */



    /*
    public function render_menu(Request $request, Response $response, $args)
    {

        list($streamerList, $total_size) = $this->generateStreamerList();

        return $this->twig->render($response, 'components/menu.twig', [
            'streamerList' => $streamerList
        ]);
    }

    public function render_log(Request $request, Response $response, $args)
    {

        $log_lines = [];

        $current_log = date("Y-m-d");
        if (isset($args['filename'])) $current_log = $args['filename'];

        $filter = isset($_GET['filter']) ? $_GET['filter'] : null;

        $log_path = TwitchHelper::$logs_folder . DIRECTORY_SEPARATOR . $current_log . ".log.json";

        if (file_exists($log_path)) {

            $json = json_decode(file_get_contents($log_path), true);

            if ($json) {

                foreach ($json as $line) {

                    if (!TwitchConfig::cfg("debug") && $line["level"] == 'DEBUG') continue;

                    // filter
                    if (isset($filter) && isset($line['module']) && $filter != $line['module']) {
                        continue;
                    }

                    if ($line["date"]) {
                        $dt = \DateTime::createFromFormat("U.u", (string)$line["date"]);
                        if (!$dt) $dt = \DateTime::createFromFormat("U", (string)$line["date"]);
                        if ($dt) {
                            $dt->setTimezone(TwitchConfig::$timezone);
                            $line['date_string'] = $dt->format("Y-m-d H:i:s.v");
                        } else {
                            $line['date_string'] = "ERROR:" . $line["date"];
                        }
                    } else {
                        $line['date_string'] = '???';
                    }

                    $log_lines[] = $line;
                }
            }
        }

        return $this->twig->render($response, 'components/logviewer.twig', [
            'log_lines' => $log_lines
        ]);
    }

    public function render_streamer(Request $request, Response $response, $args)
    {

        $username = $args['username'];

        $data = new TwitchChannel();
        $data->load($username);

        return $this->twig->render($response, 'components/streamer.twig', [
            'streamer' => $data
        ]);
    }
    */

    public function check_vods(Request $request, Response $response, $args)
    {

        list($streamerList, $total_size) = $this->generateStreamerList();

        $data = [];

        foreach ($streamerList as $streamer) {

            foreach ($streamer->vods_list as $vod) {

                $check = $vod->checkValidVod(true);

                if ($vod->twitch_vod_id && !$check) {
                    // notify
                }

                $data[] = [
                    'basename' => $vod->basename,
                    'finalized' => $vod->is_finalized,
                    'vod_id' => $vod->twitch_vod_id,
                    'exists' => $check,
                    'deleted' => $vod->twitch_vod_id && !$check,
                    'never_saved' => $vod->twitch_vod_neversaved
                ];
            }
        }

        $payload = json_encode([
            'data' => $data,
            'status' => 'OK'
        ]);
        $response->getBody()->write($payload);
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function playlist_dump(Request $request, Response $response, $args)
    {

        $username = $args['username'];

        $pa = new TwitchPlaylistAutomator();
        $pa->setup($username, isset($_GET['quality']) ? $_GET['quality'] : 'best');

        // $output = TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . 'playlist' . DIRECTORY_SEPARATOR . $username . 'vod.ts';

        $pa->output_file = $pa->getCacheFolder() . DIRECTORY_SEPARATOR . $pa->username . '-' . $pa->video_id . '.ts';

        try {
            $data = $pa->downloadLatest();
        } catch (\Throwable $th) {
            $response->getBody()->write(json_encode([
                'error' => $th->getMessage(),
                'status' => 'ERROR'
            ]));
            return $response->withHeader('Content-Type', 'application/json');
        }

        $payload = json_encode([
            'data' => $data,
            'status' => 'OK'
        ]);
        $response->getBody()->write($payload);
        return $response->withHeader('Content-Type', 'application/json');
    }

}
