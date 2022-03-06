import { differenceInSeconds, format, parse } from 'date-fns';
import fs from 'fs';
import path from 'path';
import { TwitchChannel } from './TwitchChannel';
import { TwitchHelper } from './TwitchHelper';
import { PHPDateTimeProxy } from '../types';
import { MediaInfo } from '../../../client-vue/src/mediainfo';
import { TwitchVODChapter, TwitchVODChapterJSON, TwitchVODChapterMinimalJSON } from './TwitchVODChapter';
import { TwitchConfig, VideoQuality } from './TwitchConfig';
import { TwitchVODSegment } from './TwitchVODSegment';
import { PHPDateTime } from '../PHPDateTime';
import { TwitchGame } from './TwitchGame';
import { LOGLEVEL, TwitchLog } from './TwitchLog';
import { Videos, Video } from '@/TwitchAPI/Video';
import { BaseConfigFolder } from './BaseConfig';
import { spawn } from 'child_process';

export interface TwitchVODJSON {
	meta: any;

	stream_resolution: string;

	streamer_name: string;
	streamer_id: string;
	streamer_login: string;

	chapters_raw: TwitchVODChapterMinimalJSON[];
	chapters: TwitchVODChapterJSON[];

	segments_raw: string[];
	segments: TwitchVODSegmentJSON[];

	// ads: any[];
	is_capturing: boolean;
	is_converting: boolean;
	is_finalized: boolean;
	duration_seconds: number | null;
	video_metadata?: MediaInfo;
	video_fail2?: boolean;
	force_record?: boolean;
	automator_fail?: boolean;
	saved_at?: PHPDateTimeProxy;
	dt_capture_started?: PHPDateTimeProxy;
	dt_conversion_started?: PHPDateTimeProxy;
	dt_started_at?: PHPDateTimeProxy;
	dt_ended_at?: PHPDateTimeProxy;
	capture_id: string | undefined;

	twitch_vod_id: number | undefined;
	twitch_vod_url: string | undefined;
	twitch_vod_duration: number | undefined;
	twitch_vod_title: string | undefined;
	twitch_vod_date: string | undefined; // Date
	twitch_vod_exists?: boolean | null;
	twitch_vod_attempted?: boolean | null;
	twitch_vod_neversaved?: boolean | null;
	twitch_vod_muted?: boolean | null;
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

	static vods: TwitchVOD[] = [];

	vod_path: string = "vods";

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

	chapters_raw: TwitchVODChapterJSON[] = [];
	chapters: TwitchVODChapter[] = [];

	dt_started_at: Date | undefined;
	dt_ended_at: Date | undefined;
	// saved_at: Date | undefined;
	dt_saved_at: Date | undefined;
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
	created: boolean = false;
	webpath: any;

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

		const basename = path.basename(filename);

		const cached_vod = this.getVod(basename);
		if (cached_vod) {
			console.log(`[TwitchVOD] Returning cached vod ${basename}`);
			return cached_vod;
		}

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

		TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "vodclass", `VOD Class for ${vod.basename} with api ${api ? 'enabled' : 'disabled'}!`);

		// vod.saveJSON();

		// add to cache
		this.addVod(vod);

		return vod;

	}

	static addVod(vod: TwitchVOD): boolean {

		if (!vod.basename)
			throw new Error("VOD basename is not set!");

		if (this.hasVod(vod.basename))
			throw new Error(`VOD ${vod.basename} is already in cache!`);

		this.vods.push(vod);

		return this.hasVod(vod.basename);
	}

	static hasVod(basename: string): boolean {
		return this.vods.findIndex(vod => vod.basename == basename) != -1;
	}

	static getVod(basename: string): TwitchVOD | undefined {
		if (TwitchVOD.hasVod(basename)) {
			return TwitchVOD.vods.find(vod => vod.basename == basename);
		}
	}

	/**
	 * Create an empty VOD object
	 * @param filename 
	 * @returns Empty VOD
	 */
	public static create(filename: string): TwitchVOD {
		TwitchLog.logAdvanced(LOGLEVEL.INFO, "vodclass", "Create VOD JSON: " + path.basename(filename) + " @ " + path.dirname(filename));

		const vod = new TwitchVOD();
		vod.created = true;
		vod.filename = filename;
		vod.basename = path.basename(filename, '.json');
		vod.saveJSON('create json');
		return vod;
	}

	setupDates() {

		if (!this.json) {
			TwitchLog.logAdvanced(LOGLEVEL.ERROR, "vodclass", "No JSON loaded for date setup!");
			return;
		}

		if (this.json.dt_started_at) this.dt_started_at = parse(this.json.dt_started_at.date, TwitchHelper.PHP_DATE_FORMAT, new Date());
		if (this.json.dt_ended_at) this.dt_ended_at = parse(this.json.dt_ended_at.date, TwitchHelper.PHP_DATE_FORMAT, new Date());
		if (this.json.saved_at) this.dt_saved_at = parse(this.json.saved_at.date, TwitchHelper.PHP_DATE_FORMAT, new Date());

		if (this.json.dt_capture_started) this.dt_capture_started = parse(this.json.dt_capture_started.date, TwitchHelper.PHP_DATE_FORMAT, new Date());
		if (this.json.dt_conversion_started) this.dt_conversion_started = parse(this.json.dt_conversion_started.date, TwitchHelper.PHP_DATE_FORMAT, new Date());

	}

	setupBasic() {

		if (!this.json) {
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
		this.force_record = this.json.force_record == true;
		this.automator_fail = this.json.automator_fail == true;

		// $this->stream_resolution		= isset($this->json['stream_resolution']) && gettype($this->json['stream_resolution']) == 'string' ? $this->json['stream_resolution'] : '';
		this.stream_resolution = this.json.stream_resolution;

		// $this->duration 			= $this->json['duration'];
		// $this->duration_seconds 	= $this->json['duration_seconds'] ? (int)$this->json['duration_seconds'] : null;
		this.duration_seconds = this.json.duration_seconds ?? undefined;

		const dur = this.getDurationLive();
		this.duration_live = dur === false ? -1 : dur;

		this.webpath = `${TwitchConfig.cfg('basepath')}/vods/${TwitchConfig.cfg("channel_folders") && this.streamer_login ? this.streamer_login : ''}`;

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
		if (!this.json) {
			TwitchLog.logAdvanced(LOGLEVEL.ERROR, "vodclass", "No JSON loaded for user data setup!");
			return;
		}
		this.streamer_id = this.json.streamer_id;
		this.streamer_login = await TwitchChannel.channelLoginFromId(this.json.streamer_id) || "";
		this.streamer_name = await TwitchChannel.channelDisplayNameFromId(this.json.streamer_id) || "";
	}

	setupProvider() {

		if (!this.json) {
			TwitchLog.logAdvanced(LOGLEVEL.ERROR, "vodclass", "No JSON loaded for provider setup!");
			return;
		}

		this.twitch_vod_id = this.json.twitch_vod_id !== undefined ? this.json.twitch_vod_id : undefined;
		this.twitch_vod_url = this.json.twitch_vod_url !== undefined ? this.json.twitch_vod_url : undefined;
		this.twitch_vod_duration = this.json.twitch_vod_duration !== undefined ? this.json.twitch_vod_duration : undefined;
		this.twitch_vod_title = this.json.twitch_vod_title !== undefined ? this.json.twitch_vod_title : undefined;
		this.twitch_vod_date = this.json.twitch_vod_date !== undefined ? this.json.twitch_vod_date : undefined;
		this.twitch_vod_exists = this.json.twitch_vod_exists !== undefined ? this.json.twitch_vod_exists : undefined;
		this.twitch_vod_neversaved = this.json.twitch_vod_neversaved !== undefined ? this.json.twitch_vod_neversaved : undefined;
		this.twitch_vod_attempted = this.json.twitch_vod_attempted !== undefined ? this.json.twitch_vod_attempted : undefined;
		this.twitch_vod_muted = this.json.twitch_vod_muted !== undefined ? this.json.twitch_vod_muted : undefined;

		// legacy
		if (this.meta?.data[0]?.title) {
			this.stream_title = this.meta.data[0].title;
		}

		if (this.meta?.title) {
			this.stream_title = this.meta.title;
		}
	}

	async setupAssoc() {

		if (!this.json) {
			TwitchLog.logAdvanced(LOGLEVEL.ERROR, "vodclass", "No JSON loaded for assoc setup!");
			return;
		}

		this.video_fail2 = this.json.video_fail2 !== undefined ? this.json.video_fail2 : false;
		this.video_metadata = this.json.video_metadata !== undefined ? this.json.video_metadata : undefined;
		// this.filterMediainfo();

		// this.ads = this.json.ads !== undefined ? this.json.ads : [];
		if (this.json.chapters_raw !== undefined && this.json.chapters_raw.length > 0) {
			this.parseChapters(this.json.chapters_raw);
		} else if (this.json.chapters !== undefined && this.json.chapters.length > 0) {
			this.parseChapters(this.json.chapters); // old method
		} else {
			TwitchLog.logAdvanced(LOGLEVEL.ERROR, "vodclass", `No chapters on ${this.basename}!`);
		}

		this.segments_raw = this.json.segments_raw !== undefined ? this.json.segments_raw : [];

		if (this.is_finalized) {
			this.parseSegments(this.segments_raw);
			if (!this.duration_seconds) {
				TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "vodclass", `VOD ${this.basename} finalized but no duration, trying to fix`);
				this.getDuration(true);
			}
		}

		if (!this.video_metadata && this.is_finalized && this.segments_raw.length > 0 && !this.video_fail2 && TwitchHelper.path_mediainfo()) {
			TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "vodclass", `VOD ${this.basename} finalized but no metadata, trying to fix`);
			if (await this.getMediainfo()) {
				this.saveJSON('fix mediainfo');
			}
		}
	}

	public async getDuration(save = false) {

		if (this.duration_seconds) {
			// TwitchHelper.log(LOGLEVEL.DEBUG, "Returning saved duration for " . this.basename . ": " . this.duration_seconds );
			return this.duration_seconds;
		}

		if (this.video_metadata) {

			if (this.video_metadata.general.FileSize && this.video_metadata.general.FileSize == '0') {
				TwitchLog.logAdvanced(LOGLEVEL.ERROR, "vodclass", "Invalid video metadata for {this.basename}!");
				return null;
			}

			if (this.video_metadata.general.Duration) {
				TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "vodclass", `No duration_seconds but metadata exists for ${this.basename}: ${this.video_metadata.general.Duration}`);
				this.duration_seconds = parseInt(this.video_metadata.general.Duration);
				return this.duration_seconds;
			}

			TwitchLog.logAdvanced(LOGLEVEL.ERROR, "vodclass", "Video metadata for {this.basename} does not include duration!");

			return null;
		}

		if (this.is_capturing) {
			TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "vodclass", "Can't request duration because {this.basename} is still recording!");
			return null;
		}

		if (!this.is_converted || this.is_converting) {
			TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "vodclass", "Can't request duration because {this.basename} is converting!");
			return null;
		}

		if (!this.is_finalized) {
			TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "vodclass", "Can't request duration because {this.basename} is not finalized!");
			return null;
		}

		if (!this.segments_raw || this.segments_raw.length == 0) {
			TwitchLog.logAdvanced(LOGLEVEL.ERROR, "vodclass", "No video file available for duration of {this.basename}");
			return null;
		}

		TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "vodclass", "No mediainfo for getDuration of {this.basename}");

		const file = await this.getMediainfo();

		if (!file) {
			TwitchLog.logAdvanced(LOGLEVEL.ERROR, "vodclass", "Could not find duration of {this.basename}");
			return null;
		} else {

			// this.duration 			= $file['playtime_string'];
			this.duration_seconds = parseInt(file.general.Duration);

			if (save) {
				TwitchLog.logAdvanced(LOGLEVEL.SUCCESS, "vodclass", "Saved duration for {this.basename}");
				this.saveJSON('duration save');
			}

			TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "vodclass", "Duration fetched for {this.basename}: {this.duration_seconds}");

			return this.duration_seconds;
		}

		TwitchLog.logAdvanced(LOGLEVEL.ERROR, "vodclass", "Reached end of getDuration for {this.basename}, this shouldn't happen!");
	}

	async getMediainfo(): Promise<false | MediaInfo> {
		throw new Error('Method getMediaInfo not implemented.');
	}

	private realpath(expanded_path: string): string {
		return path.normalize(expanded_path);
	}

	setupFiles() {

		if (!this.directory) {
			throw new Error('No directory set!');
		}

		this.path_chat = this.realpath(path.join(this.directory, `${this.basename}.chat`));
		this.path_downloaded_vod = this.realpath(path.join(this.directory, `${this.basename}_vod.mp4`));
		this.path_losslesscut = this.realpath(path.join(this.directory, `${this.basename}-llc-edl.csv`));
		this.path_chatrender = this.realpath(path.join(this.directory, `${this.basename}_chat.mp4`));
		this.path_chatmask = this.realpath(path.join(this.directory, `${this.basename}_chat_mask.mp4`));
		this.path_chatburn = this.realpath(path.join(this.directory, `${this.basename}_burned.mp4`));
		this.path_chatdump = this.realpath(path.join(this.directory, `${this.basename}.chatdump`));
		this.path_adbreak = this.realpath(path.join(this.directory, `${this.basename}.adbreak`));
		this.path_playlist = this.realpath(path.join(this.directory, `${this.basename}.m3u8`));

		// this.is_chat_downloaded 			= file_exists(this.path_chat);
		// this.is_vod_downloaded 			= file_exists(this.path_downloaded_vod);
		// this.is_lossless_cut_generated 	= file_exists(this.path_losslesscut);
		// this.is_chatdump_captured 		= file_exists(this.path_chatdump);
		// this.is_capture_paused 			= file_exists(this.path_adbreak);
		// this.is_chat_rendered 			= file_exists(this.path_chatrender);
		// this.is_chat_burned 				= file_exists(this.path_chatburn);

	}

	get is_chat_downloaded() { return this.path_chat && fs.existsSync(this.path_chat); }
	get is_vod_downloaded() { return this.path_downloaded_vod && fs.existsSync(this.path_downloaded_vod); }
	get is_lossless_cut_generated() { return this.path_losslesscut && fs.existsSync(this.path_losslesscut); }
	get is_chatdump_captured() { return this.path_chatdump && fs.existsSync(this.path_chatdump); }
	get is_capture_paused() { return this.path_adbreak && fs.existsSync(this.path_adbreak); }
	get is_chat_rendered() { return this.path_chatrender && fs.existsSync(this.path_chatrender); }
	get is_chat_burned() { return this.path_chatburn && fs.existsSync(this.path_chatburn); }

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

	async parseChapters(raw_chapters: TwitchVODChapterJSON[] | TwitchVODChapterMinimalJSON[]) {

		if (!raw_chapters || raw_chapters.length == 0) {
			TwitchLog.logAdvanced(LOGLEVEL.ERROR, "vodclass", `No chapter data found for ${this.basename}`);
			return false;
		}

		let chapters: TwitchVODChapter[] = [];

		// $data = isset(this.json['chapters']) ? this.json['chapters'] : this.json['games']; // why

		for (let chapter_data of raw_chapters) {

			let new_chapter = new TwitchVODChapter(chapter_data);

			/*
			let game_data;
			if (chapter_data.game_id) {
				game_data = await TwitchGame.getGameDataAsync(chapter_data.game_id);
				if (game_data) new_chapter.game = game_data;
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
				new_chapter.strings.started_at = format(new_chapter.datetime, 'yyyy-MM-dd HH:mm:ss');
			}

			if (chapter_data.duration) {
				new_chapter.strings.duration = TwitchHelper.getNiceDuration(chapter_data.duration);
			}

			// box art
			if (game_data && game_data.box_art_url) {
				let box_art_width = Math.round(140 * 0.5); // 14
				let box_art_height = Math.round(190 * 0.5); // 19
				new_chapter.box_art_url = game_data.getBoxArtUrl(box_art_width, box_art_height);
			}
			*/
			chapters.push(new_chapter);
		}

		this.chapters.forEach((chapter, index) => {

			const nextChapter = this.chapters[index + 1];

			// calculate duration from next chapter
			if (nextChapter && nextChapter.datetime && chapter.datetime) {
				chapter.duration = nextChapter.datetime.getTime() - chapter.datetime.getTime();
			} else {
				console.warn(`Could not calculate duration for chapter ${chapter.title}`);
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

		// console.log("Chapters:", chapters);

		// this.chapters_raw = raw_chapters;
		this.chapters = chapters;

	}

	generateChaptersRaw() {
		let raw_chapters: TwitchVODChapterMinimalJSON[] = [];
		for (let chapter of this.chapters) {
			let raw_chapter = chapter.getRawChapter();
			if (raw_chapter) raw_chapters.push(raw_chapter);
		}
		return raw_chapters;
	}

	addChapter(chapter: TwitchVODChapter) {
		this.chapters.push(chapter);
	}

	public parseSegments(array: string[]) {

		if (!this.directory) {
			throw new Error('TwitchVOD.parseSegments: directory is not set');
		}

		if (!array) {
			TwitchLog.logAdvanced(LOGLEVEL.ERROR, "vodclass", `No segment data supplied on ${this.basename}`);

			if (!this.segments_raw) {
				TwitchLog.logAdvanced(LOGLEVEL.ERROR, "vodclass", `No segment_raw data on ${this.basename}, calling rebuild...`);
				this.rebuildSegmentList();
			}

			return false;
		}

		let segments: TwitchVODSegment[] = [];

		for (let raw_segment of array) {

			if (typeof raw_segment !== 'string') {
				TwitchLog.logAdvanced(LOGLEVEL.ERROR, "vodclass", `Segment list containing invalid data for ${this.basename}, rebuilding...`);
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

	public addSegment(segment: string) {
		this.segments_raw.push(segment);
	}

	rebuildSegmentList() {
		throw new Error('Method rebuild segment list not implemented.');
	}

	public async finalize() {
		TwitchLog.logAdvanced(LOGLEVEL.INFO, "vodclass", `Finalize ${this.basename} @ ${this.directory}`);

		if (this.path_playlist && fs.existsSync(this.path_playlist)) {
			fs.unlinkSync(this.path_playlist);
		}

		await this.getMediainfo();
		this.saveLosslessCut();
		// this.matchProviderVod(); // @todo: implement
		// this.checkMutedVod(); // initially not muted when vod is published
		this.is_finalized = true;

		return true;
	}

	public saveLosslessCut() {
		if (!this.directory) {
			throw new Error('TwitchVOD.saveLosslessCut: directory is not set');
		}

		if (!this.chapters || this.chapters.length == 0) {
			// throw new Error('TwitchVOD.saveLosslessCut: chapters are not set');
			return false;
		}

		// $csv_path = $this->directory . DIRECTORY_SEPARATOR . $this->basename . '-llc-edl.csv';
		const csv_path = path.join(this.directory, `${this.basename}-llc-edl.csv`);

		TwitchLog.logAdvanced(LOGLEVEL.INFO, "vodclass", `Saving lossless cut csv for ${this.basename} to ${csv_path}`);

		let data = "";

		/*
		for (let i in this.chapters) {
			let chapter = this.chapters[i];

			let offset = chapter.offset;
			if (!offset) continue;

			offset -= this.chapters[0].offset || 0;

			data += offset + ',';

			if (i < this.chapters.length - 1) {
				$data .= ($offset + $chapter['duration']) . ',';
			} else {
				$data .= ',';
			}

			$data .= $chapter['game_name'] ?: $chapter['game_id'];
			$data .= "\n";
		}
		*/

		this.chapters.forEach((chapter, i) => {
			let offset = chapter.offset;
			if (!offset) return;

			offset -= this.chapters[0].offset || 0;

			data += offset + ',';

			if (i < this.chapters.length - 1) {
				data += (offset + (chapter.duration || 0)) + ',';
			} else {
				data += ',';
			}

			data += chapter.game_name || chapter.game_id;
			data += "\n";
		});

		// file_put_contents($csv_path, $data);
		fs.writeFileSync(csv_path, data);
		// $this->setPermissions();

		return fs.existsSync(csv_path);
	}

	toJSON() {
		return {
			vod_path: this.vod_path,
			capture_id: this.capture_id,
			filename: this.filename,
			basename: this.basename,
			directory: this.directory,
			json: this.json,
			meta: this.meta,
			streamer_name: this.streamer_name,
			streamer_id: this.streamer_id,
			streamer_login: this.streamer_login,

			segments: this.segments,
			segments_raw: this.segments_raw,

			chapters: this.chapters,
			chapters_raw: this.generateChaptersRaw(),

			// ads: this.ads,
			// started_at: null,
			// ended_at: null,
			duration_seconds: this.duration_seconds,
			duration_live: this.duration_live,
			game_offset: this.game_offset,
			stream_resolution: this.stream_resolution,
			stream_title: this.stream_title,
			total_size: this.total_size,
			twitch_vod_id: this.twitch_vod_id,
			twitch_vod_url: this.twitch_vod_url,
			twitch_vod_duration: this.twitch_vod_duration,
			twitch_vod_title: this.twitch_vod_title,
			twitch_vod_date: this.twitch_vod_date,
			twitch_vod_exists: this.twitch_vod_exists,
			twitch_vod_attempted: this.twitch_vod_attempted,
			twitch_vod_neversaved: this.twitch_vod_neversaved,
			twitch_vod_muted: this.twitch_vod_muted,
			is_recording: this.is_recording,
			is_converted: this.is_converted,
			is_capturing: this.is_capturing,
			is_converting: this.is_converting,
			is_finalized: this.is_finalized,
			video_fail2: this.video_fail2,
			// video_metadata_public: [],
			is_chat_downloaded: this.is_chat_downloaded,
			is_vod_downloaded: this.is_vod_downloaded,
			is_chat_rendered: this.is_chat_rendered,
			is_chat_burned: this.is_chat_burned,
			is_lossless_cut_generated: this.is_lossless_cut_generated,
			is_chatdump_captured: this.is_chatdump_captured,
			is_capture_paused: this.is_capture_paused,
			dt_saved_at: this.dt_saved_at ? TwitchHelper.JSDateToPHPDate(this.dt_saved_at) : null,
			dt_started_at: this.dt_started_at ? TwitchHelper.JSDateToPHPDate(this.dt_started_at) : null,
			dt_ended_at: this.dt_ended_at ? TwitchHelper.JSDateToPHPDate(this.dt_ended_at) : null,
			dt_capture_started: this.dt_capture_started ? TwitchHelper.JSDateToPHPDate(this.dt_capture_started) : null,
			dt_conversion_started: this.dt_conversion_started ? TwitchHelper.JSDateToPHPDate(this.dt_conversion_started) : null,
			// json_hash: this.json_hash,
			created: this.created,
			force_record: this.force_record,
			automator_fail: this.automator_fail,
			path_chat: this.path_chat,
			path_downloaded_vod: this.path_downloaded_vod,
			path_losslesscut: this.path_losslesscut,
			path_chatrender: this.path_chatrender,
			path_chatburn: this.path_chatburn,
			path_chatdump: this.path_chatdump,
			path_chatmask: this.path_chatmask,
			path_adbreak: this.path_adbreak,
			path_playlist: this.path_playlist,
			// api_hasFavouriteGame:
			// api_getUniqueGames:
			// api_getWebhookDuration:
			// api_getDuration: this.getDuration(),
			api_getDuration: this.duration_seconds,
			// api_getCapturingStatus:
			// api_getRecordingSize:
			// api_getChatDumpStatus:
			// api_getDurationLive:
			webpath: this.webpath,
			// dt_started_at: this.dt_started_at ? TwitchHelper.JSDateToPHPDate(this.dt_started_at) : null,
			// dt_ended_at: this.dt_ended_at ? TwitchHelper.JSDateToPHPDate(this.dt_ended_at) : null,

		}
	}

	saveJSON(reason = "") {

		if (!this.filename) {
			throw new Error('Filename not set.');
		}

		if (fs.existsSync(this.filename)) {
			// $tmp = file_get_contents(this.filename);
			// if (md5($tmp) !== this.json_hash) {
			// 	TwitchLog.logAdvanced(LOGLEVEL.WARNING, "vodclass", "JSON has been changed since loading of {this.basename}");
			// }
		}

		if (!this.created && (this.is_capturing || this.is_converting || !this.is_finalized)) {
			TwitchLog.logAdvanced(LOGLEVEL.WARNING, "vodclass", `Saving JSON of ${this.basename} while not finalized!`);
		}

		if (!this.chapters || this.chapters.length == 0) {
			TwitchLog.logAdvanced(LOGLEVEL.WARNING, "vodclass", `Saving JSON of ${this.basename} with no chapters!!`);
		}

		if (!this.streamer_name && !this.created) {
			TwitchLog.logAdvanced(LOGLEVEL.FATAL, "vodclass", `Found no streamer name in class of ${this.basename}, not saving!`);
			return false;
		}

		// clone this.json
		let generated: TwitchVODJSON = JSON.parse(JSON.stringify(this.json));

		if (this.twitch_vod_id && this.twitch_vod_url) {
			generated.twitch_vod_id = this.twitch_vod_id;
			generated.twitch_vod_url = this.twitch_vod_url;
			generated.twitch_vod_duration = this.twitch_vod_duration ?? undefined;
			generated.twitch_vod_title = this.twitch_vod_title;
			generated.twitch_vod_date = this.twitch_vod_date;
		}

		generated.twitch_vod_exists = this.twitch_vod_exists;
		generated.twitch_vod_attempted = this.twitch_vod_attempted;
		generated.twitch_vod_neversaved = this.twitch_vod_neversaved;
		generated.twitch_vod_muted = this.twitch_vod_muted;

		generated.stream_resolution = this.stream_resolution ?? "";

		generated.streamer_name = this.streamer_name ?? "";
		generated.streamer_id = this.streamer_id ?? "";
		generated.streamer_login = this.streamer_login ?? "";

		// generated.started_at 		= this.started_at;
		// generated.ended_at 			= this.ended_at;

		generated.chapters_raw = this.generateChaptersRaw();
		generated.segments_raw = this.segments_raw;
		// generated.segments 			= this.segments;
		// generated.ads 				= this.ads;

		generated.is_capturing = this.is_capturing;
		generated.is_converting = this.is_converting;
		generated.is_finalized = this.is_finalized;

		// generated.duration 			= this.duration;
		generated.duration_seconds = this.duration_seconds ?? null;

		generated.video_metadata = this.video_metadata;
		generated.video_fail2 = this.video_fail2;

		generated.force_record = this.force_record;

		generated.automator_fail = this.automator_fail;

		generated.meta = this.meta;

		generated.saved_at = TwitchHelper.JSDateToPHPDate(new Date());

		if (this.dt_capture_started) generated.dt_capture_started = TwitchHelper.JSDateToPHPDate(this.dt_capture_started);
		if (this.dt_conversion_started) generated.dt_conversion_started = TwitchHelper.JSDateToPHPDate(this.dt_conversion_started);
		if (this.dt_started_at) generated.dt_started_at = TwitchHelper.JSDateToPHPDate(this.dt_started_at);
		if (this.dt_ended_at) generated.dt_ended_at = TwitchHelper.JSDateToPHPDate(this.dt_ended_at);

		generated.capture_id = this.capture_id;

		// if (!is_writable(this.filename)) { // this is not the function i want
		// 	// TwitchHelper::log(TwitchHelper::LOG_FATAL, "Saving JSON of " . this.basename . " failed, permissions issue?");
		// 	// return false;
		// }

		TwitchLog.logAdvanced(LOGLEVEL.SUCCESS, "vodclass", `Saving JSON of ${this.basename} ${(reason ? ' (' + reason + ')' : '')}`);

		//file_put_contents(this.filename, json_encode(generated));
		// this.setPermissions();

		console.log("GENERATED", generated);

		return generated;

	}

	public async refreshJSON(api = false) {
		if (!this.filename) {
			TwitchLog.logAdvanced(LOGLEVEL.ERROR, "vodclass", "Can't refresh vod, not found!");
			return false;
		}
		TwitchLog.logAdvanced(LOGLEVEL.INFO, "vodclass", "Refreshing JSON on {$this->basename} ({$this->filename}) @ {$this->directory}!");
		// $this->load($this->filename);
		// return static::load($this->filename, $api);
		return await TwitchVOD.load(this.filename, api);
	}

	public static async downloadVideo(video_id: string, quality: VideoQuality, filename: string) {

		TwitchLog.logAdvanced(LOGLEVEL.INFO, "channel", `Download VOD ${video_id}`);

		const video = await TwitchVOD.getVideo(video_id);

		if (!video) {
			TwitchLog.logAdvanced(LOGLEVEL.ERROR, "channel", `Failed to get video ${video_id}`);
			throw new Error(`Failed to get video ${video_id}`);
			return false;
		}

		// const basename = `${video.user_login}_${video.created_at.replace(":", "_")}_${video.stream_id}`;
		const basename = path.basename(filename);

		// $capture_filename = TwitchHelper::vodFolder($this->login) . DIRECTORY_SEPARATOR . $basename . ($vod_ext ? '_vod' : '') . '.ts';
		// $converted_filename = TwitchHelper::vodFolder($this->login) . DIRECTORY_SEPARATOR . $basename . ($vod_ext ? '_vod' : '') . '.mp4';
		const capture_filename = path.join(BaseConfigFolder.cache, `${video_id}.ts`);
		const converted_filename = filename;

		// download vod
		if (!fs.existsSync(capture_filename) && !fs.existsSync(converted_filename)) {

			const video_url = `https://www.twitch.tv/videos/${video_id}`;

			const streamlink_bin = TwitchHelper.path_streamlink();
			const ffmpeg_bin = TwitchHelper.path_ffmpeg();

			if (!streamlink_bin) {
				TwitchLog.logAdvanced(LOGLEVEL.ERROR, "channel", "Failed to find streamlink binary!");
				throw new Error("Failed to find streamlink binary!");
			}

			if (!ffmpeg_bin) {
				TwitchLog.logAdvanced(LOGLEVEL.ERROR, "channel", "Failed to find ffmpeg binary!");
				throw new Error("Failed to find ffmpeg binary!");
			}

			const cmd = [];

			cmd.push("--ffmpeg-ffmpeg", ffmpeg_bin);

			cmd.push('-o', capture_filename); // output file

			cmd.push('--hls-segment-threads', '10');

			cmd.push('--url', video_url); // stream url

			cmd.push('--default-stream', 'best'); // twitch url and quality

			// logging level
			if (TwitchConfig.cfg('debug', false)) {
				cmd.push('--loglevel', 'debug');
			} else if (TwitchConfig.cfg('app_verbose', false)) {
				cmd.push('--loglevel', 'info');
			}

			TwitchLog.logAdvanced(LOGLEVEL.INFO, "channel", `Downloading VOD ${video_id}...`);

			const ret = await TwitchHelper.execAdvanced(streamlink_bin, cmd, `download_vod_${video_id}`);

			TwitchLog.logAdvanced(LOGLEVEL.INFO, "channel", `Downloaded VOD ${video_id}...}`);

			if (ret.stdout.includes("error: Unable to find video:") || ret.stderr.includes("error: Unable to find video:")) {
				throw new Error("VOD on Twitch not found, is it deleted?");
			}
		}

		if (!fs.existsSync(converted_filename)) {

			TwitchLog.logAdvanced(LOGLEVEL.INFO, "vodclass", `Starting remux of ${basename}`);

			const ret = TwitchHelper.remuxFile(capture_filename, converted_filename);

			if (fs.existsSync(capture_filename) && fs.existsSync(converted_filename) && fs.statSync(converted_filename).size > 0) {
				TwitchLog.logAdvanced(LOGLEVEL.INFO, "vodclass", `Successfully remuxed ${basename}, removing ${capture_filename}`);
				fs.unlinkSync(capture_filename);
			} else {
				TwitchLog.logAdvanced(LOGLEVEL.INFO, "vodclass", `Failed to remux ${basename}`);
			}
		}

		const successful = fs.existsSync(converted_filename) && fs.statSync(converted_filename).size > 0;

		TwitchLog.logAdvanced(LOGLEVEL.INFO, "vodclass", `Download of ${basename} ${successful ? "successful" : "failed"}`);

		TwitchHelper.webhook({
			'action': 'video_download',
			'success': successful,
			'path': converted_filename,
		});

		return converted_filename;
	}

	static async getVideo(video_id: string): Promise<false | Video> {
		if (!video_id) throw new Error('No video id');

		let response;

		try {
			response = await TwitchHelper.axios.get(`/helix/videos/?id=${video_id}`);
		} catch (e) {
			TwitchLog.logAdvanced(LOGLEVEL.ERROR, 'vodclass', `Tried to get video id ${video_id} but got error ${e}`);
			return false;
		}

		const json: Videos = response.data;

		if (json.data.length === 0) {
			TwitchLog.logAdvanced(LOGLEVEL.ERROR, 'vodclass', `Tried to get video id ${video_id} but got no data`);
			return false;
		}

		return json.data[0];

	}

}