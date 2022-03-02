import fs from 'fs';
import path from 'path';

export interface TwitchVODSegment {
    filename: string;
    basename: string;
    filesize: number;
    deleted: boolean;
}

export class TwitchVOD {
    
    capture_id: string | undefined;
    filename: string | undefined;
    basename: string | undefined;
    directory: string | undefined;

    json: any;
    meta: any;

    streamer_name: string | undefined;
    streamer_id: string | undefined;
    streamer_login: string | undefined;

    segments_raw: string[] = [];
    segments: TwitchVODSegment[] = [];

    /*
    public $vod_path = 'vods';

	public string $capture_id = '';
	public string $filename = '';
	public string $basename = '';

	/** Base directory of all related files *
	public string $directory = '';

	public array $json = [];
	public array $meta = [];

	/** 
	 * Streamer display name.
	 * Do NOT use display name for file naming
	 *
	public ?string $streamer_name = null;

	/** Streamer user id *
	public ?string $streamer_id = null;

	/** Streamer login *
	public ?string $streamer_login = null;

	public array $segments = [];

	/**
	 * An array of strings containing the file paths of the segments.
	 * @var string[]
	 * *
	public array $segments_raw = [];

	/**
	 * Chapters
	 *
	 * @var [ 'time', 'game_id', 'game_name', 'viewer_count', 'title', 'datetime', 'offset', 'duration' ]
	 *
	public array $chapters = [];

	public array $ads = [];

	/** @deprecated 3.4.0 *
	public $started_at = null;
	/** @deprecated 3.4.0 *
	public $ended_at = null;

	public ?int $duration_seconds = null;
	public ?int $duration_live = null;

	public ?int $game_offset = null;

	public string $stream_resolution = '';
	public string $stream_title = '';

	public ?int $total_size = null;

	/** @todo: make these into an array instead **
	public ?int $twitch_vod_id = null;
	public ?string $twitch_vod_url = null;
	public ?int $twitch_vod_duration = null;
	public ?string $twitch_vod_title = null;
	public ?string $twitch_vod_date = null;
	public ?bool $twitch_vod_exists = null;
	public ?bool $twitch_vod_attempted = null;
	public ?bool $twitch_vod_neversaved = null;
	public ?bool $twitch_vod_muted = null;

	/** @deprecated 3.2.0 use $is_capturing instead *
	public bool $is_recording = false;
	public bool $is_converted = false;
	public bool $is_capturing = false;
	public bool $is_converting = false;
	public bool $is_finalized = false;

	public bool $video_fail2 = false;
	private array $video_metadata = [];
	public array $video_metadata_public = [];

	public bool $is_chat_downloaded = false;
	public bool $is_vod_downloaded = false;
	public bool $is_chat_rendered = false;
	public bool $is_chat_burned = false;
	public bool $is_lossless_cut_generated = false;
	public bool $is_chatdump_captured = false;
	public bool $is_capture_paused = false;

	public ?\DateTime $dt_saved_at = null;
	public ?\DateTime $dt_started_at = null;
	public ?\DateTime $dt_ended_at = null;
	public ?\DateTime $dt_capture_started = null;
	public ?\DateTime $dt_conversion_started = null;

	public ?string $json_hash = null;

	/** Recently created? *
	public bool $created = false;
	/** Manually started? *
	public bool $force_record = false;

	public bool $automator_fail = false;

	public ?string $path_chat = null;
	public ?string $path_downloaded_vod = null;
	public ?string $path_losslesscut = null;
	public ?string $path_chatrender = null;
	public ?string $path_chatburn = null;
	public ?string $path_chatdump = null;
	public ?string $path_chatmask = null;
	public ?string $path_adbreak = null;
	public ?string $path_playlist = null;

	private array $associatedFiles = [];

	public ?bool $api_hasFavouriteGame = null;
	public ?array $api_getUniqueGames = null;
	public ?string $api_getWebhookDuration = null;
	public ?int $api_getDuration = null;
	public $api_getCapturingStatus = null;
	public ?int $api_getRecordingSize = null;
	public ?int $api_getChatDumpStatus = null;
	public ?int $api_getDurationLive = null;

	/** /basepath/vod/username *
	public ?string $webpath = null;

	private $pid_cache = [];
    */

    constructor() {
        // this.capture_id = "";
        // this.filename = "";
        // this.basename = "";
        // this.directory = "";
    }

    static load(filename: string, api = false): TwitchVOD {
        
        // check if file exists
        if (!fs.existsSync(filename)) {
            throw new Error("VOD JSON does not exist: " + filename);
        }

        // load file
        const data = fs.readFileSync(filename, 'utf8');
        if (data.length == 0) {
            throw new Error("File is empty: " + filename);
        }

        // parse file
        const json = JSON.parse(data);

        // create object
        const vod = new TwitchVOD();
        vod.capture_id = json.capture_id;
        vod.filename = filename;
        vod.basename = path.basename(filename);
        vod.directory = path.dirname(filename);

        return vod;
        
    }
}