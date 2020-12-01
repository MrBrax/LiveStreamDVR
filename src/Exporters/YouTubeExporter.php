<?php

namespace App;

class YouTubeExporter extends BaseExporter
{

    function exportSegment(array $segment, int $part, int $total_parts)
    {
        $full_title = $this->makeTitle($segment, $part, $total_parts);

        // upload via youtube api

    }
}
