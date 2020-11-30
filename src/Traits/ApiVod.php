<?php


namespace App\Traits;

use Slim\Psr7\Request;
use Slim\Psr7\Response;

use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\Process;
use App\TwitchConfig;
use App\TwitchHelper;
use App\TwitchVOD;

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
        $vodclass->load(TwitchHelper::vodFolder($username) . DIRECTORY_SEPARATOR . $vod . '.json');

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
}
