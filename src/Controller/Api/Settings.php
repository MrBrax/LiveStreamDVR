<?php

namespace App\Controller\Api;

use Slim\Psr7\Request;
use Slim\Psr7\Response;

use App\TwitchConfig;
use App\TwitchHelper;

class Settings
{

    public function settings_list(Request $request, Response $response, array $args)
    {

        // main config
        $config = [];
        foreach (TwitchConfig::$config as $key => $value) {
            if (isset(TwitchConfig::getSettingField($key)['secret']) /* || $key == 'streamers' || $key == 'favourites'*/) {
                continue;
            }
            $config[$key] = $value;
        }

        // field for config
        $fields = [];
        foreach (TwitchConfig::$settingsFields as $key => $value) {
            $fields[$value['key']] = $value;
        }

        $fields['timezone']['choices'] = \DateTimeZone::listIdentifiers(); // static

        // version
        $package_path = __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "package.json";
        if (file_exists($package_path)) {
            $version = json_decode(file_get_contents($package_path))->version;
        } else {
            $version = '?';
        }

        $payload = json_encode([
            'data' => [
                'config' => $config,
                'channels' => TwitchConfig::$channels_config,
                'fields' => $fields,
                'version' => $version,
                'server' => 'php-server',
            ],
            'status' => 'OK'
        ]);

        $response->getBody()->write($payload);
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function settings_save(Request $request, Response $response, array $args)
    {

        $formdata = $request->getParsedBody();

        $force_new_token = false;
        if (TwitchConfig::cfg('api_client_id') !== $formdata['api_client_id']) {
            $force_new_token = true;
        }

        $fields = 0;
        foreach (TwitchConfig::$settingsFields as $setting) {

            $key = $setting['key'];

            if ($setting['type'] == "boolean") {

                TwitchConfig::setConfig($key, isset($formdata[$key]));
                $fields += isset($formdata[$key]) ? 1 : 0;
            } else {

                if (isset($setting['secret'])) {
                    if ($formdata[$key]) {
                        TwitchConfig::setConfig($key, $formdata[$key]);
                        $fields += 1;
                    }
                } else {
                    TwitchConfig::setConfig($key, $formdata[$key]);
                    $fields += 1;
                }
            }
        }

        if ($fields == 0 || count($formdata) == 0) {
            $response->getBody()->write(json_encode([
                "message" => "No settings updated.",
                "status" => "ERROR"
            ]));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        if (TwitchConfig::cfg('app_url')) {

            $full_url = TwitchConfig::cfg('app_url') . '/api/v0/hook';

            if (TwitchConfig::cfg('instance_id')) {
                $full_url .= '?instance=' . TwitchConfig::cfg('instance_id');
            }

            $client = new \GuzzleHttp\Client([
                "verify" => TwitchConfig::cfg('ca_path') ?: true,
            ]);

            try {
                $resp = $client->request('GET', $full_url, ['connect_timeout' => 10, 'timeout' => 10]);
            } catch (\GuzzleHttp\Exception\BadResponseException $th) {
                $response->getBody()->write(json_encode([
                    "message" => "External app url could not be contacted on '{$full_url}' due to a bad response: {$th->getMessage()}",
                    "status" => "ERROR"
                ]));
                return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
            } catch (\GuzzleHttp\Exception\ConnectException $th) {
                $response->getBody()->write(json_encode([
                    "message" => "External app url could not be contacted on '{$full_url}' due to a connection error: {$th->getMessage()}",
                    "status" => "ERROR"
                ]));
                return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
            } catch (\GuzzleHttp\Exception\GuzzleException $th) {
                $response->getBody()->write(json_encode([
                    "message" => "External app url could not be contacted on '{$full_url}' due to a Guzzle error: {$th->getMessage()}",
                    "status" => "ERROR"
                ]));
                return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
            }

            // response returned by the hook when no arguments are supplied
            if ($resp->getBody()->getContents() !== 'No data supplied') {
                $response->getBody()->write(json_encode([
                    "message" => "External app url could be contacted but didn't get the expected response ({$full_url}).",
                    "status" => "ERROR"
                ]));
                return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
            }
        }

        TwitchConfig::saveConfig("settings/save");

        if ($force_new_token) {
            TwitchHelper::getAccessToken(true);
        }

        $response->getBody()->write(json_encode([
            "message" => "Settings saved.",
            "status" => "OK"
        ]));
        return $response->withStatus(200)->withHeader('Content-Type', 'application/json');
    }
}
