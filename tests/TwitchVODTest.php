<?php

declare(strict_types=1);

use App\TwitchChannel;
use App\TwitchConfig;
use App\TwitchHelper;
use App\TwitchVOD;
use PHPUnit\Framework\TestCase;

class TwitchVODTest extends TestCase
{

    private function findFirstVod(): TwitchVOD
    {
        $streamers = TwitchConfig::getStreamers();
        $vodclass = null;
        foreach ($streamers as $sc) {
            $streamer = new TwitchChannel();
            $streamer->load($sc['username']);
            if ($streamer->vods_list) {
                return $streamer->vods_list[0];
            }
        }

        return null;
    }

    public function test_attributes(): void
    {

        $vodclass = $this->findFirstVod();

        $this->assertNotNull($vodclass, 'vox test exists');

        // $vodclass = new TwitchVOD();
        // $vodclass->load($vod_path);

        $this->assertIsString($vodclass->filename, 'filename wrong type');
        $this->assertIsString($vodclass->basename, 'basename wrong type');
        $this->assertIsString($vodclass->directory, 'directory wrong type');
        $this->assertIsArray($vodclass->json, 'json wrong type');
        $this->assertIsArray($vodclass->meta, 'meta wrong type');
        $this->assertIsString($vodclass->streamer_name, 'streamer_name wrong type');
        $this->assertIsInt($vodclass->streamer_id, 'steamer_id wrong type');
        $this->assertIsArray($vodclass->segments, 'segments wrong type');
        $this->assertIsArray($vodclass->segments_raw, 'segments_raw wrong type');
        $this->assertIsArray($vodclass->chapters, 'chapters wrong type');
        $this->assertIsInt($vodclass->game_offset, 'game_offset wrong type');
        $this->assertIsString($vodclass->stream_resolution, 'stream_resolution wrong type');
        $this->assertIsString($vodclass->stream_title, 'stream_title wrong type');
        $this->assertIsInt($vodclass->total_size, 'total_size wrong type');
        $this->assertGreaterThan(0, $vodclass->duration_seconds, 'correct capture duration');
    }

    public function test_vod_download()
    {

        $vodclass = $this->findFirstVod();
        $this->assertNotNull($vodclass, 'vod test does not exist');

        $vod_path = $vodclass->directory . DIRECTORY_SEPARATOR . $vodclass->basename . '_vod.mp4';

        // if (file_exists($vod_path)) throw new Exception('VOD file already exists: ' . $vod_path);
        if (file_exists($vod_path)){
            unlink($vod_path);
            $vodclass->refreshJSON();
        }

        $vodclass->downloadVod();

        $this->assertFileExists($vod_path);
    }

    public function test_chat_download()
    {

        $vodclass = $this->findFirstVod();
        $this->assertNotNull($vodclass, 'vod test does not exist');

        $chat_path = $vodclass->directory . DIRECTORY_SEPARATOR . $vodclass->basename . '.chat';

        // if (file_exists($chat_path)) throw new Exception('Chat file already exists: ' . $chat_path);
        if (file_exists($chat_path)){
            unlink($chat_path);
            $vodclass->refreshJSON();
        }

        $vodclass->downloadChat();

        $this->assertFileExists($chat_path);
    }
}
