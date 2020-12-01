<?php

namespace App\Exporters;

use App\TwitchVOD;
use App\TwitchHelper;

class BaseExporter
{

    private TwitchVOD $vodclass;

    /**
     * Load VOD file by name instead of injecting
     *
     * @param string $username
     * @param string $basename
     * @return TwitchVOD
     */
    function inputVodByName(string $username, string $basename)
    {
        $this->vodclass = new TwitchVOD();
        $this->vodclass->load(TwitchHelper::vodFolder($username) . DIRECTORY_SEPARATOR . $basename . '.json');
        return $this->vodclass;
    }

    /**
     * Load VOD file by class
     *
     * @param TwitchVOD $vodclass
     * @return void
     */
    function setVod(TwitchVOD $vodclass)
    {
        $this->vodclass = $vodclass;
    }

    /**
     * Call this
     *
     * @return array
     */
    function exportAllSegments() : array
    {
        $output = [];
        foreach ($this->vodclass->segments as $i => $segment) {
            $output[] = $this->exportSegment($segment, $i, count($this->vodclass->segments));
        }
        return $output;
    }

    /**
     * Generate a title
     *
     * @param array $segment
     * @param integer $part
     * @param integer $total_parts
     * @return string
     */
    function makeTitle(array $segment, int $part, int $total_parts)
    {

        $streamer_name = $this->vodclass->streamer_name;
        $stream_resolution = $this->vodclass->stream_resolution;
        $stream_title = $this->vodclass->stream_title;
        $filename = $segment['filename'];
        $date = $this->vodclass->dt_started_at->format("Y-m-d");

        return "[{$streamer_name}][{$date}] {$stream_title} ({$part}/{$total_parts})";
    }

    /**
     * Extend this
     *
     * @param array $segment
     * @param integer $part
     * @param integer $total_parts
     * @return void
     */
    function exportSegment(array $segment, int $part, int $total_parts)
    {
        $full_title = $this->makeTitle($segment, $part, $total_parts);
        throw new \Exception("Not implemented");
    }
}
