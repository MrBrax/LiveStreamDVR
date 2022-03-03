import { differenceInSeconds, format, parse } from 'date-fns';
import fs from 'fs';
import path from 'path';
import { TwitchChannel } from './TwitchChannel';
import { LOGLEVEL, TwitchHelper } from './TwitchHelper';
import { PHPDateTimeProxy } from './types';
import { MediaInfo } from '../../client-vue/src/mediainfo';
import { TwitchVODChapter } from './TwitchVODChapter';
import { TwitchConfig } from './TwitchConfig';
import { TwitchVODSegment } from './TwitchVODSegment';
import { PHPDateTime } from './PHPDateTime';

export interface TwitchVODJSON {
	meta: any;
	twitch_vod_exists: boolean | null;
	twitch_vod_attempted: boolean | null;
	twitch_vod_neversaved: boolean | null;
	twitch_vod_muted: boolean | null;
	stream_resolution: string;
	streamer_name: string;
	streamer_id: string;
	streamer_login: string;
	chapters: TwitchVODChapterJSON[];
	segments_raw: string[];
	segments: TwitchVODSegmentJSON[];
	// ads: any[];
	is_capturing: boolean;
	is_converting: boolean;
	is_finalized: boolean;
	duration_seconds: number;
	video_metadata: MediaInfo;
	video_fail2: boolean;
	force_record: boolean;
	automator_fail: boolean;
	saved_at: PHPDateTimeProxy;
	dt_capture_started: PHPDateTimeProxy;
	dt_conversion_started: PHPDateTimeProxy;
	dt_started_at: PHPDateTimeProxy;
	dt_ended_at: PHPDateTimeProxy;
	capture_id: string;
	twitch_vod_id: number;
	twitch_vod_url: string;
	twitch_vod_duration: number;
	twitch_vod_title: string;
	twitch_vod_date: string; // Date
}

export interface TwitchVODChapterJSON {
	/** Date, 2022-02-23T00:47:32Z */
	time: string; 
	dt_started_at: PHPDateTimeProxy;
	game_id: string;
	game_name: string;
	title: string;
	is_mature: boolean;
	online: boolean;
	viewer_count: number;
	datetime: PHPDateTimeProxy;
	favourite: boolean;
	offset: number;
	strings: Record<string, string>;
	box_art_url: string;
	duration: number;
	width: number;
}

export interface TwitchVODSegmentJSON {
	filename: string;
	basename: string;
	filesize: number;
	strings: Record<string, string>;
}

/*
export interface TwitchVODSegment {
    filename: string;
    basename: string;
    filesize: number;
    deleted: boolean;
}
*/

export class TwitchVOD {
    
    capture_id: string | undefined;
    filename: string | undefined;
    basename: string | undefined;
    directory: string | undefined;

    json: TwitchVODJSON | undefined;
    meta: any;

    streamer_name: string | undefined;
    streamer_id: string | undefined;
    streamer_login: string | undefined;

    segments_raw: string[] = [];
    segments: TwitchVODSegment[] = [];

	chapters: TwitchVODChapter[] = [];

	dt_started_at: Date | undefined;
	dt_ended_at: Date | undefined;
	saved_at: Date | undefined;
	dt_capture_started: Date | undefined;
	dt_conversion_started: Date | undefined;

	twitch_vod_id: number | undefined;
	twitch_vod_url: string | undefined;
	twitch_vod_duration: number | undefined;
	twitch_vod_title: string | undefined;
	twitch_vod_date: string | undefined;
	twitch_vod_exists: boolean | null | undefined;
	twitch_vod_neversaved: boolean | null | undefined;
	twitch_vod_attempted: boolean | null | undefined;
	twitch_vod_muted: boolean | null | undefined;

	stream_title: string | undefined;
	video_fail2: boolean | undefined;
	video_metadata: MediaInfo | undefined;

	/** @deprecated 3.2.0 use $is_capturing instead */
	is_recording = false;
	is_converted = false;
	is_capturing = false;
	is_converting = false;
	is_finalized = false;

	game_offset: number | undefined;

	duration_seconds: number | undefined;
	total_size: number = 0;
	
	path_chat: string | undefined;
	path_downloaded_vod: string | undefined;
	path_losslesscut: string | undefined;
	path_chatrender: string | undefined;
	path_chatmask: string | undefined;
	path_chatburn: string | undefined;
	path_chatdump: string | undefined;
	path_adbreak: string | undefined;
	path_playlist: string | undefined;
	// associatedFiles: string[] | undefined;
	
	force_record: boolean = false;
	automator_fail: boolean = false;
	stream_resolution: string | undefined;

	duration_live: number | undefined;

	// is_chat_downloaded: any;
	// is_vod_downloaded: any;
	// is_lossless_cut_generated: any;
	// is_chatdump_captured: any;
	// is_capture_paused: any;
	// is_chat_rendered: any;
	// is_chat_burned: any;

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

    static async load(filename: string, api = false): Promise<TwitchVOD> {
        
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

		vod.json = json;

		vod.setupDates();
		vod.setupBasic();
		await vod.setupUserData();
		vod.setupProvider();
		await vod.setupAssoc();
		vod.setupFiles();

		// $vod.webpath = TwitchConfig.cfg('basepath') . '/vods/' . (TwitchConfig.cfg("channel_folders") && $vod.streamer_login ? $vod.streamer_login : '');

		// if (api) {
		// 	vod.setupApiHelper();
		// }

		TwitchHelper.logAdvanced(LOGLEVEL.DEBUG, "vodclass", `VOD Class for ${vod.basename} with api ${api ? 'enabled' : 'disabled'}!`);

        return vod;
        
    }

	setupDates() {

		if (!this.json){
			TwitchHelper.logAdvanced(LOGLEVEL.ERROR, "vodclass", "No JSON loaded for date setup!");
			return;
		}
		
		if (this.json.dt_started_at) this.dt_started_at = parse(this.json.dt_started_at.date, TwitchHelper.PHP_DATE_FORMAT, new Date());
		if (this.json.dt_ended_at) this.dt_ended_at = parse(this.json.dt_ended_at.date, TwitchHelper.PHP_DATE_FORMAT, new Date());
		if (this.json.saved_at) this.saved_at = parse(this.json.saved_at.date, TwitchHelper.PHP_DATE_FORMAT, new Date());

		if (this.json.dt_capture_started) this.dt_capture_started = parse(this.json.dt_capture_started.date, TwitchHelper.PHP_DATE_FORMAT, new Date());
		if (this.json.dt_conversion_started) this.dt_conversion_started = parse(this.json.dt_conversion_started.date, TwitchHelper.PHP_DATE_FORMAT, new Date());

	}
	setupBasic() {

		if (!this.json){
			throw new Error("No JSON loaded for basic setup!");
		}

		// $this->is_recording = file_exists($this->directory . DIRECTORY_SEPARATOR . $this->basename . '.ts');
		// $this->is_converted = file_exists($this->directory . DIRECTORY_SEPARATOR . $this->basename . '.mp4');

		// $this->is_capturing 	= isset($this->json['is_capturing']) ? $this->json['is_capturing'] : false;
		// $this->is_converting 	= isset($this->json['is_converting']) ? $this->json['is_converting'] : false;
		// $this->is_finalized 	= isset($this->json['is_finalized']) ? $this->json['is_finalized'] : false;
		this.is_capturing = this.json.is_capturing;
		this.is_converting = this.json.is_converting;
		this.is_finalized = this.json.is_finalized;

		// $this->force_record				= isset($this->json['force_record']) ? $this->json['force_record'] : false;
		// $this->automator_fail			= isset($this->json['automator_fail']) ? $this->json['automator_fail'] : false;
		this.force_record = this.json.force_record;
		this.automator_fail = this.json.automator_fail;

		// $this->stream_resolution		= isset($this->json['stream_resolution']) && gettype($this->json['stream_resolution']) == 'string' ? $this->json['stream_resolution'] : '';
		this.stream_resolution = this.json.stream_resolution;

		// $this->duration 			= $this->json['duration'];
		// $this->duration_seconds 	= $this->json['duration_seconds'] ? (int)$this->json['duration_seconds'] : null;
		this.duration_seconds = this.json.duration_seconds;

		const dur = this.getDurationLive();
		this.duration_live = dur === false ? -1 : dur;
	
	}

	getDurationLive() {
		// if (!$this->dt_started_at) return false;
		// $now = new \DateTime();
		// return abs($this->dt_started_at->getTimestamp() - $now->getTimestamp());
		if (!this.dt_started_at) return false;
		const now = new Date();
		return Math.abs((this.dt_started_at.getTime() - now.getTime()) / 1000);
	}

	async setupUserData() {
		if (!this.json){
			TwitchHelper.logAdvanced(LOGLEVEL.ERROR, "vodclass", "No JSON loaded for user data setup!");
			return;
		}
		this.streamer_id = this.json.streamer_id;
		this.streamer_login = await TwitchChannel.channelLoginFromId(this.json.streamer_id) || "";
		this.streamer_name = await TwitchChannel.channelDisplayNameFromId(this.json.streamer_id) || "";
	}

	setupProvider()
	{

		if (!this.json){
			TwitchHelper.logAdvanced(LOGLEVEL.ERROR, "vodclass", "No JSON loaded for provider setup!");
			return;
		}

		this.twitch_vod_id 			= this.json.twitch_vod_id !== undefined ? this.json.twitch_vod_id : undefined;
		this.twitch_vod_url 		= this.json.twitch_vod_url !== undefined ? this.json.twitch_vod_url : undefined;
		this.twitch_vod_duration 	= this.json.twitch_vod_duration !== undefined ? this.json.twitch_vod_duration : undefined;
		this.twitch_vod_title 		= this.json.twitch_vod_title !== undefined ? this.json.twitch_vod_title : undefined;
		this.twitch_vod_date 		= this.json.twitch_vod_date !== undefined ? this.json.twitch_vod_date : undefined;
		this.twitch_vod_exists 		= this.json.twitch_vod_exists !== undefined ? this.json.twitch_vod_exists : undefined;
		this.twitch_vod_neversaved 	= this.json.twitch_vod_neversaved !== undefined ? this.json.twitch_vod_neversaved : undefined;
		this.twitch_vod_attempted 	= this.json.twitch_vod_attempted !== undefined ? this.json.twitch_vod_attempted : undefined;
		this.twitch_vod_muted 		= this.json.twitch_vod_muted !== undefined ? this.json.twitch_vod_muted : undefined;

		// legacy
		if (this.meta?.data[0]?.title) {
			this.stream_title = this.meta.data[0].title;
		}

		if (this.meta?.title) {
			this.stream_title = this.meta.title;
		}
	}

	async setupAssoc() {

		if (!this.json){
			TwitchHelper.logAdvanced(LOGLEVEL.ERROR, "vodclass", "No JSON loaded for assoc setup!");
			return;
		}

		this.video_fail2 		= this.json.video_fail2 !== undefined ? this.json.video_fail2 : false;
		this.video_metadata		= this.json.video_metadata !== undefined ? this.json.video_metadata : undefined;
		// this.filterMediainfo();

		// this.ads = this.json.ads !== undefined ? this.json.ads : [];

		if (this.json.chapters !== undefined && this.json.chapters.length > 0) {
			this.parseChapters(this.json.chapters);
		} else {
			TwitchHelper.logAdvanced(LOGLEVEL.ERROR, "vodclass", `No chapters on ${this.basename}!`);
		}

		this.segments_raw = this.json.segments_raw !== undefined ? this.json.segments_raw : [];

		if (this.is_finalized) {
			this.parseSegments(this.segments_raw);
			if (!this.duration_seconds) {
				TwitchHelper.logAdvanced(LOGLEVEL.DEBUG, "vodclass", `VOD ${this.basename} finalized but no duration, trying to fix`);
				this.getDuration(true);
			}
		}

		if (!this.video_metadata && this.is_finalized && this.segments_raw.length > 0 && !this.video_fail2 && TwitchHelper.path_mediainfo()) {
			TwitchHelper.logAdvanced(LOGLEVEL.DEBUG, "vodclass", `VOD ${this.basename} finalized but no metadata, trying to fix`);
			if (await this.getMediainfo()) {
				this.saveJSON('fix mediainfo');
			}
		}
	}

	public async getDuration(save = false)
	{

		if (this.duration_seconds) {
			// TwitchHelper.log(LOGLEVEL.DEBUG, "Returning saved duration for " . this.basename . ": " . this.duration_seconds );
			return this.duration_seconds;
		}

		if (this.video_metadata) {

			if (this.video_metadata.general.FileSize && this.video_metadata.general.FileSize == '0') {
				TwitchHelper.logAdvanced(LOGLEVEL.ERROR, "vodclass", "Invalid video metadata for {this.basename}!");
				return null;
			}

			if (this.video_metadata.general.Duration) {
				TwitchHelper.logAdvanced(LOGLEVEL.DEBUG, "vodclass", `No duration_seconds but metadata exists for ${this.basename}: ${this.video_metadata.general.Duration}`);
				this.duration_seconds = parseInt(this.video_metadata.general.Duration);
				return this.duration_seconds;
			}

			TwitchHelper.logAdvanced(LOGLEVEL.ERROR, "vodclass", "Video metadata for {this.basename} does not include duration!");

			return null;
		}

		if (this.is_capturing) {
			TwitchHelper.logAdvanced(LOGLEVEL.DEBUG, "vodclass", "Can't request duration because {this.basename} is still recording!");
			return null;
		}

		if (!this.is_converted || this.is_converting) {
			TwitchHelper.logAdvanced(LOGLEVEL.DEBUG, "vodclass", "Can't request duration because {this.basename} is converting!");
			return null;
		}

		if (!this.is_finalized) {
			TwitchHelper.logAdvanced(LOGLEVEL.DEBUG, "vodclass", "Can't request duration because {this.basename} is not finalized!");
			return null;
		}

		if (!this.segments_raw || this.segments_raw.length == 0) {
			TwitchHelper.logAdvanced(LOGLEVEL.ERROR, "vodclass", "No video file available for duration of {this.basename}");
			return null;
		}

		TwitchHelper.logAdvanced(LOGLEVEL.DEBUG, "vodclass", "No mediainfo for getDuration of {this.basename}");
		
		const file = await this.getMediainfo();

		if (!file) {
			TwitchHelper.logAdvanced(LOGLEVEL.ERROR, "vodclass", "Could not find duration of {this.basename}");
			return null;
		} else {

			// this.duration 			= $file['playtime_string'];
			this.duration_seconds 	= parseInt(file.general.Duration);

			if (save) {
				TwitchHelper.logAdvanced(LOGLEVEL.SUCCESS, "vodclass", "Saved duration for {this.basename}");
				this.saveJSON('duration save');
			}

			TwitchHelper.logAdvanced(LOGLEVEL.DEBUG, "vodclass", "Duration fetched for {this.basename}: {this.duration_seconds}");

			return this.duration_seconds;
		}

		TwitchHelper.logAdvanced(LOGLEVEL.ERROR, "vodclass", "Reached end of getDuration for {this.basename}, this shouldn't happen!");
	}

	async getMediainfo(): Promise<false | MediaInfo> {
		throw new Error('Method getMediaInfo not implemented.');
	}

	saveJSON(reason: string) {
		throw new Error('Method saveJSON not implemented.');
	}

	private realpath(expanded_path: string): string {
		return path.normalize(expanded_path);
	}

	setupFiles()
	{

		if (!this.directory) {
			throw new Error('No directory set!');
		}
		
		this.path_chat 				= this.realpath(path.join(this.directory, `${this.basename}.chat`));
		this.path_downloaded_vod 	= this.realpath(path.join(this.directory, `${this.basename}_vod.mp4`));
		this.path_losslesscut 		= this.realpath(path.join(this.directory, `${this.basename}-llc-edl.csv`));
		this.path_chatrender		= this.realpath(path.join(this.directory, `${this.basename}_chat.mp4`));
		this.path_chatmask			= this.realpath(path.join(this.directory, `${this.basename}_chat_mask.mp4`));
		this.path_chatburn			= this.realpath(path.join(this.directory, `${this.basename}_burned.mp4`));
		this.path_chatdump			= this.realpath(path.join(this.directory, `${this.basename}.chatdump`));
		this.path_adbreak			= this.realpath(path.join(this.directory, `${this.basename}.adbreak`));
		this.path_playlist			= this.realpath(path.join(this.directory, `${this.basename}.m3u8`));

		// this.is_chat_downloaded 			= file_exists(this.path_chat);
		// this.is_vod_downloaded 			= file_exists(this.path_downloaded_vod);
		// this.is_lossless_cut_generated 	= file_exists(this.path_losslesscut);
		// this.is_chatdump_captured 		= file_exists(this.path_chatdump);
		// this.is_capture_paused 			= file_exists(this.path_adbreak);
		// this.is_chat_rendered 			= file_exists(this.path_chatrender);
		// this.is_chat_burned 				= file_exists(this.path_chatburn);

	}

	get is_chat_downloaded(){ return this.path_chat && fs.existsSync(this.path_chat); }
	get is_vod_downloaded(){ return this.path_downloaded_vod && fs.existsSync(this.path_downloaded_vod); }
	get is_lossless_cut_generated(){ return this.path_losslesscut && fs.existsSync(this.path_losslesscut); }
	get is_chatdump_captured(){ return this.path_chatdump && fs.existsSync(this.path_chatdump); }
	get is_capture_paused(){ return this.path_adbreak && fs.existsSync(this.path_adbreak); }
	get is_chat_rendered(){ return this.path_chatrender && fs.existsSync(this.path_chatrender); }
	get is_chat_burned(){ return this.path_chatburn && fs.existsSync(this.path_chatburn); }

	get associatedFiles() {

		if (!this.directory) return [];
		
		let base = [
			`${this.basename}.json`,
			`${this.basename}.chat`,
			`${this.basename}_vod.mp4`,
			`${this.basename}-llc-edl.csv`,
			`${this.basename}_chat.mp4`,
			`${this.basename}_burned.mp4`,
			`${this.basename}.chatdump`,
			`${this.basename}.chatdump.txt`,
			`${this.basename}.chatdump.line`,
			`${this.basename}.m3u8`,
			`${this.basename}.adbreak`,
		];

		if (this.segments_raw) {
			for (let seg of this.segments_raw) {
				base.push(path.basename(seg));
			}
		}

		return base.filter(f => fs.existsSync(this.realpath(path.join(this.directory || "", f))));

	}

	setupApiHelper() {
		throw new Error('Method apihelper not implemented.');
	}

	async parseChapters(raw_chapters: TwitchVODChapterJSON[]) {

		if (!raw_chapters || raw_chapters.length == 0) {
			TwitchHelper.logAdvanced(LOGLEVEL.ERROR, "vodclass", `No chapter data found for ${this.basename}`);
			return false;
		}

		let chapters: TwitchVODChapter[] = [];

		// $data = isset(this.json['chapters']) ? this.json['chapters'] : this.json['games']; // why

		for (let chapter_data of raw_chapters) {

			let new_chapter = new TwitchVODChapter(chapter_data);

			let game_data;
			if (chapter_data.game_id) {
				game_data = await TwitchHelper.getGameData(parseInt(chapter_data.game_id));
			} else {
				game_data = null;
			}

			// $entry = array_merge($game_data, $entry); // is this a good idea?

			new_chapter.datetime = parse(chapter_data.time, TwitchHelper.TWITCH_DATE_FORMAT, new Date());

			// @todo: fix
			// if (null !== TwitchConfig.cfg('favourites') && TwitchConfig.cfg('favourites').length) > 0) {
			// 	$entry['favourite'] = isset(TwitchConfig.cfg('favourites')[$entry['game_id']]);
			// }

			// offset
			if (this.dt_started_at) {
				new_chapter.offset = (new_chapter.datetime.getTime() - this.dt_started_at.getTime()) / 1000;
			}

			// if (this.is_finalized && this.getDuration() !== false && this.getDuration() > 0 && chapter_data.duration) {
			// 	$entry['width'] = ($entry['duration'] / this.getDuration()) * 100; // temp
			// }

			// strings for templates
			new_chapter.strings = {};
			if (this.dt_started_at) {
				// $diff = $entry['datetime'].diff(this.dt_started_at);
				// $entry['strings']['started_at'] = $diff.format('%H:%I:%S');
				
				// diff datetime and dt_started at with date-fns
				let diff = differenceInSeconds(new_chapter.datetime, this.dt_started_at);
				new_chapter.strings.started_at = format(new_chapter.datetime, 'HH:mm:ss');

			} else {
				// $entry['strings']['started_at'] = $entry['datetime'].format("Y-m-d H:i:s");
				new_chapter.strings.started_at = format(new_chapter.datetime, 'YYYY-MM-DD HH:mm:ss');
			}

			if (chapter_data.duration) {
				new_chapter.strings.duration = TwitchHelper.getNiceDuration(chapter_data.duration);
			}

			// box art
			if (game_data && game_data.box_art_url) {

				let box_art_width = Math.round(140 * 0.5); // 14
				let box_art_height = Math.round(190 * 0.5); // 19

				// $img_url = $game_data['box_art_url'];
				// $img_url = str_replace("{width}", (string)$box_art_width, $img_url);
				// $img_url = str_replace("{height}", (string)$box_art_height, $img_url);
				// $entry['box_art_url'] = $img_url;

				new_chapter.box_art_url = game_data.box_art_url.replace("{width}", box_art_width.toString()).replace("{height}", box_art_height.toString());

			}

			chapters.push(new_chapter);
		}

		/*
		$i = 0;
		foreach ($chapters as $chapter) {

			if (isset($chapters[$i + 1]) && $chapters[$i + 1]) {
				$chapters[$i]['duration'] = $chapters[$i + 1]['datetime'].getTimestamp() - $chapter['datetime'].getTimestamp();
			}

			if ($i == 0) {
				this.game_offset = $chapter['offset'];
			}

			if ($i == sizeof($chapters) - 1 && this.dt_ended_at) {
				$chapters[$i]['duration'] = this.dt_ended_at.getTimestamp() - $chapter['datetime']->getTimestamp();
			}

			$i++;
		}
		*/

		this.chapters.forEach((chapter, index) => {

			const nextChapter = this.chapters[index + 1];
			
			// calculate duration from next chapter
			if (nextChapter && nextChapter.datetime && chapter.datetime) {
				chapter.duration = nextChapter.datetime.getTime() - chapter.datetime.getTime();
			}

			// can't remember why this is here
			if (index == 0) {
				this.game_offset = chapter.offset;
			}

			// final chapter, make duration to end of vod
			if (index == chapters.length - 1 && this.dt_ended_at && chapter.datetime) {
				chapter.duration = this.dt_ended_at.getTime() - chapter.datetime.getTime();
			}
		});

		this.chapters = chapters;
	}

	public parseSegments(array: string[])
	{

		if (!this.directory) {
			throw new Error('TwitchVOD.parseSegments: directory is not set');
		}

		if (!array) {
			TwitchHelper.logAdvanced(LOGLEVEL.ERROR, "vodclass", `No segment data supplied on ${this.basename}`);

			if (!this.segments_raw) {
				TwitchHelper.logAdvanced(LOGLEVEL.ERROR, "vodclass", `No segment_raw data on ${this.basename}, calling rebuild...`);
				this.rebuildSegmentList();
			}

			return false;
		}

		let segments: TwitchVODSegment[] = [];

		for (let raw_segment of array) {

			if (typeof raw_segment !== 'string') {
				TwitchHelper.logAdvanced(LOGLEVEL.ERROR, "vodclass", `Segment list containing invalid data for ${this.basename}, rebuilding...`);
				this.rebuildSegmentList();
				return;
			}

			const segment = new TwitchVODSegment();

			// segment.filename = realpath($this.directory . DIRECTORY_SEPARATOR . basename($v));
			// segment.basename = basename($v);
			segment.filename = path.join(this.directory, path.basename(raw_segment));
			segment.basename = path.basename(raw_segment);

			/*
			if (isset($segment['filename']) && $segment['filename'] != false && file_exists($segment['filename']) && filesize($segment['filename']) > 0) {
				$segment['filesize'] = filesize($segment['filename']);
				$this.total_size += $segment['filesize'];
			} else {
				$segment['deleted'] = true;
			}
			*/
			if (segment.filename && fs.existsSync(segment.filename) && fs.statSync(segment.filename).size > 0) {
				segment.filesize = fs.statSync(segment.filename).size;
				this.total_size += segment.filesize;
			}

			segment.strings = {};
			// $diff = $this.started_at.diff($this.ended_at);
			// $segment['strings']['webhook_duration'] = $diff.format('%H:%I:%S') . '</li>';

			segments.push(segment);
		}

		this.segments = segments;
	}

	rebuildSegmentList() {
		throw new Error('Method rebuild segment list not implemented.');
	}

}