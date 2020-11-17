<?php

declare(strict_types=1);

use App\TwitchChannel;
use App\TwitchConfig;
use App\TwitchHelper;
use App\TwitchVOD;
use PHPUnit\Framework\TestCase;
use GuzzleHttp\Client;

class ConfigTest extends TestCase
{

    private function getClient()
    {
        // create our http client (Guzzle)
        $client = new \GuzzleHttp\Client([
            'base_uri' => 'http://localhost:8080',
        ]);
        return $client;
    }

    public function test_generateConfig(): void
    {
        unlink(TwitchConfig::$configPath);

        $client = $this->getClient();

        $client->request('GET', 'http://localhost:8080');

        $this->assertFileExists(TwitchConfig::$configPath, 'config generated');

        // default
        $this->assertEquals(604800, TwitchConfig::cfg('sub_lease'), 'default config sub_lease set');
        $this->assertEquals(true, TwitchConfig::cfg('disable_ads'), 'default config disable_ads set');
        $this->assertEquals('UTC', TwitchConfig::cfg('timezone'), 'default config timezone set');
    }

    public function test_setInvalidConfig(): void
    {
        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('Setting does not exist: test');
        TwitchConfig::setConfig('test', 'test');
    }

    public function test_setValidConfig(): void
    {
        TwitchConfig::setConfig('sub_lease', 604800);
        $this->assertEquals(604800, TwitchConfig::cfg('sub_lease'), 'config sub_lease set');
    }

    public function test_correctConfigTypes(): void
    {
        $this->assertIsBool(TwitchConfig::cfg('disable_ads'), 'disable_ads bool');
        $this->assertIsString(TwitchConfig::cfg('timezone'), 'timezone string');
        $this->assertIsInt(TwitchConfig::cfg('sub_lease'), 'sub_lease int');
    }

}
