<?php

declare(strict_types=1);

use App\TwitchHelper;
use App\TwitchVOD;
use PHPUnit\Framework\TestCase;

class TwitchVODTest extends TestCase
{

    public function test_attributes(): void
    {

        $username = 'xQcOW';
        $vod = 'xQcOW_2020-09-25T18_50_44Z_39850132270';
        $vod_path = TwitchHelper::vodFolder($username) . DIRECTORY_SEPARATOR . $vod . '.json';

        $this->assertFileExists($vod_path, 'vod exists');

        $vodclass = new TwitchVOD();
        $vodclass->load($vod_path);

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
}
