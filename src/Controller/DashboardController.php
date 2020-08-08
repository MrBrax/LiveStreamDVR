<?php

namespace App\Controller;

use App\TwitchConfig;
use App\TwitchHelper;
use App\TwitchVOD;
use Slim\Psr7\Request;
use Slim\Psr7\Response;
use Slim\Views\Twig;

class DashboardController
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
        $total_size = 0;

        $streamerListStatic = TwitchConfig::getStreamers();
        $streamerList = [];

        $is_a_vod_deleted = false;

        $checkvod = isset($_GET['checkvod']);

        foreach ($streamerListStatic as $streamer) {

            $data = $streamer;

            $data['vods_raw'] = glob(TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . $streamer['username'] . "_*.json");

            $data['vods_list'] = [];

            $data['vods_size'] = 0;

            foreach ($data['vods_raw'] as $k => $v) {

                $vodclass = new TwitchVOD();
                $vodclass->load($v);

                if ($vodclass->is_recording) $data['is_live'] = true;

                if ($checkvod && !$vodclass->is_recording) {
                    $isvalid = $vodclass->checkValidVod();
                    if (!$isvalid) {
                        $is_a_vod_deleted = true;
                        echo '<!-- deleted: ' . $vodclass->basename . ' -->';
                    }
                }

                if ($vodclass->segments) {
                    foreach ($vodclass->segments as $s) {
                        $data['vods_size'] += filesize(TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . basename($s));
                    }
                }

                $data['vods_list'][] = $vodclass;

            }

            $streamerList[] = $data;

        }

        return $this->twig->render($response, 'dashboard.twig', [
            'streamerList' => $streamerList,
            'clips' => glob(TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . "clips" . DIRECTORY_SEPARATOR . "*.mp4"),
            'total_size' => $total_size,
            'is_a_vod_deleted' => $is_a_vod_deleted,
            'checkvod' => $checkvod
        ]);

    }

}