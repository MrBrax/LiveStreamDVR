import { TwitchConfig } from "./TwitchConfig";
import { TwitchVOD } from "./TwitchVOD";
import express from "express";
import { LOGLEVEL, TwitchHelper } from "./TwitchHelper";
import { IncomingHttpHeaders } from "http";
import { EventSubResponse } from "@/TwitchAPI/EventSub";
import { TwitchChannel } from "./TwitchChannel";
import fs from "fs";
import path from "path";
import { ChannelUpdateEvent, EventSubChannelUpdate } from "@/TwitchAPI/ChannelUpdate";
import { TwitchVODChapter, TwitchVODChapterMinimalJSON } from "./TwitchVODChapter";

export class TwitchAutomator {

    vod: TwitchVOD | undefined;

    private broadcaster_user_id = "";
	private broadcaster_user_login = "";
	private broadcaster_user_name  = "";
	
	payload_eventsub: EventSubResponse | undefined;
	payload_headers: IncomingHttpHeaders | undefined;
	data_cache: any;

    public basename()
	{

		// return $this->getLogin() . '_' . str_replace(':', '_', $this->getStartDate()) . '_' . $this->getVodID();
        return this.getLogin() + "_" + this.getStartDate().replace(':', '_') + "_" + this.getVodID();
	}

    public getVodID()
	{
		return TwitchConfig.getCache(`${this.getLogin()}.vod.id`);
		// return $this->payload['id'];
	}

	public getUserID()
	{
		return this.broadcaster_user_id;
	}

	public getUsername()
	{
		return this.broadcaster_user_name;
	}

	public getLogin()
	{
		return this.broadcaster_user_login;
	}

	public getStartDate()
	{
		return TwitchConfig.getCache(`${this.getLogin()}.vod.started_at`) || "";
	}

    /**
	 * Entrypoint for stream capture, this is where all Twitch EventSub (webhooks) end up.
	 */
	public async handle(data: EventSubResponse, headers: IncomingHttpHeaders)
	{
		TwitchHelper.logAdvanced(LOGLEVEL.DEBUG, "automator", "Handle called, proceed to parsing.");

		if (!headers['Twitch-Eventsub-Message-Id']) {
			TwitchHelper.logAdvanced(LOGLEVEL.ERROR, "automator", "No twitch message id supplied to handle");
			return false;
		}

		const message_retry = headers['Twitch-Eventsub-Message-Retry'] || null;

		this.payload_eventsub = data;
		this.payload_headers = headers;

		const subscription = data.subscription;
		const subscription_type = subscription.type;
		const subscription_id = subscription.id;

		this.data_cache = data;

		const event = data.event;
		this.broadcaster_user_id = event.broadcaster_user_id;
		this.broadcaster_user_login = event.broadcaster_user_login;
		this.broadcaster_user_name = event.broadcaster_user_name;

		if (subscription_type === "channel.update") {

			// check if channel is in config, copypaste
			if (!TwitchChannel.getChannelByLogin(this.broadcaster_user_login)) {
				TwitchHelper.logAdvanced(LOGLEVEL.ERROR, "automator", `Handle (update) triggered with sub id ${subscription_id}, but username '${this.broadcaster_user_login}' is not in config.`);

				// 5head solution
				// TwitchHelper.channelUnsubscribe($this->broadcaster_user_id);
				TwitchHelper.eventSubUnsubscribe(subscription_id);
				return false;
			}

			// TwitchConfig.setCache("${this.broadcaster_user_login}.last.update", (new DateTime())->format(DateTime::ATOM));
			TwitchConfig.setCache(`${this.broadcaster_user_login}.last.update`, new Date().toISOString());
			TwitchHelper.logAdvanced(LOGLEVEL.INFO, "automator", `Channel update for ${this.broadcaster_user_login}`);

			await this.updateGame();
		} else if (subscription_type == "stream.online" && "id" in event) {

			TwitchConfig.setCache(`${this.broadcaster_user_login}.last.online`, new Date().toISOString());
			TwitchHelper.logAdvanced(LOGLEVEL.INFO, "automator", `Stream online for ${this.broadcaster_user_login} (retry ${message_retry})`);

			const channel_obj = TwitchChannel.getChannelByLogin(this.broadcaster_user_login);

			// check if channel is in config, hmm
			if (!channel_obj) {
				TwitchHelper.logAdvanced(LOGLEVEL.ERROR, "automator", `Handle (online) triggered with sub id ${subscription_id}, but username '${this.broadcaster_user_login}' is not in config.`);

				// 5head solution
				// TwitchHelper.channelUnsubscribe($this->broadcaster_user_id);
				TwitchHelper.eventSubUnsubscribe(subscription_id);
				return false;
			}

			if (channel_obj.no_capture) {
				TwitchHelper.logAdvanced(LOGLEVEL.INFO, "automator", `Skip capture for ${this.broadcaster_user_login} because no-capture is set`);
				return false;
			}

			TwitchConfig.setCache(`${this.broadcaster_user_login}.online`, "1");
			TwitchConfig.setCache(`${this.broadcaster_user_login}.vod.id`, event.id);
			TwitchConfig.setCache(`${this.broadcaster_user_login}.vod.started_at`, event.started_at);

			// $this->payload = $data['data'][0];

			const basename = this.basename();

			const folder_base = TwitchHelper.vodFolder(this.broadcaster_user_login);

			if (fs.existsSync(path.join(folder_base, `${basename}.json`))) {

				const vodclass = await TwitchVOD.load(path.join(folder_base, `${basename}.json`))
				if (vodclass) {

					if (vodclass.is_finalized) {
						TwitchHelper.logAdvanced(LOGLEVEL.ERROR, "automator", `VOD is finalized, but wanted more info on ${basename} (retry ${message_retry})`);
					} else if (vodclass.is_capturing) {
						// $this->updateGame();
						TwitchHelper.logAdvanced(LOGLEVEL.ERROR, "automator", `VOD exists and is still capturing on ${basename} (retry ${message_retry})`);
					} else {
						TwitchHelper.logAdvanced(LOGLEVEL.ERROR, "automator", `VOD exists but isn't capturing anymore on ${basename} (retry ${message_retry})`);
					}
				} else {
					TwitchHelper.logAdvanced(LOGLEVEL.ERROR, "automator", `Could not load VOD in handle for ${basename} (retry ${message_retry})`);
				}
				/*
				if (!file_exists($folder_base . DIRECTORY_SEPARATOR . $basename . '.ts')) {

					// $this->notify($basename, 'VOD JSON EXISTS BUT NOT VIDEO', self::NOTIFY_ERROR);
					TwitchHelper.log(LOGLEVEL.ERROR, "VOD JSON exists but not video on " . $basename);

					$this->download($data);
				} else {

					$this->updateGame($data);
				}
				*/
			} else {

				await this.download();
			}
		} else if (subscription_type == "stream.offline") {

			TwitchConfig.setCache(`${this.broadcaster_user_login}.last.offline`, new Date().toISOString());
			TwitchHelper.logAdvanced(LOGLEVEL.INFO, "automator", `Stream offline for ${this.broadcaster_user_login}`);

			// TwitchConfig.setCache("${this.broadcaster_user_login}.online", "0");
			TwitchConfig.setCache(`${this.broadcaster_user_login}.online`, null);
			// TwitchConfig.setCache("${this.broadcaster_user_login}.vod.id", null);
			// TwitchConfig.setCache("${this.broadcaster_user_login}.vod.started_at", null);

			await this.end();
		} else {

			TwitchHelper.logAdvanced(LOGLEVEL.ERROR, "automator", `No supported subscription type (${subscription_type}).`);
		}

    }

	public async updateGame(from_cache = false)
	{

		// if online
		if (TwitchConfig.getCache(`${this.getLogin()}.online`) === "1") {

			const basename = this.basename();
			const folder_base = TwitchHelper.vodFolder(this.getLogin());

			if (!this.vod) {
				try {
					this.vod = await TwitchVOD.load(path.join(folder_base, `${basename}.json`));
				} catch (th) {
					TwitchHelper.logAdvanced(LOGLEVEL.FATAL, "automator", "Tried to load VOD ${basename} but errored: {$th->getMessage()}");

					TwitchHelper.logAdvanced(LOGLEVEL.INFO, "automator", "Resetting online status on {this.getLogin()} due to file error.");
					TwitchConfig.setCache(`${this.broadcaster_user_login}.online`, null);
					return false;
				}
			}

			let event: ChannelUpdateEvent;

			// fetch from cache
			if (from_cache) {
				const cd = TwitchConfig.getCache(`${this.getLogin()}.channeldata`);
				if (!cd) {
					TwitchHelper.logAdvanced(LOGLEVEL.ERROR, "automator", `Tried to get channel cache for ${this.broadcaster_user_login} but it was not available.`);
					return false;
				}
				const cdj = JSON.parse(cd);
				if (!cdj) {
					TwitchHelper.logAdvanced(LOGLEVEL.ERROR, "automator", `Tried to parse channel cache json for ${this.broadcaster_user_login} but it errored.`);
					return false;
				}
				event = cdj;
			} else if (this.payload_eventsub && "title" in this.payload_eventsub.event) {
				if (!this.payload_eventsub || !this.payload_eventsub.event) {
					TwitchHelper.logAdvanced(LOGLEVEL.ERROR, "automator", `Tried to get event for ${this.broadcaster_user_login} but it was not available.`);
					return false;
				}
				event = this.payload_eventsub.event as ChannelUpdateEvent;
			} else {
				TwitchHelper.logAdvanced(LOGLEVEL.ERROR, "automator", `No last resort event for ${this.broadcaster_user_login} not available.`);
				return false;
			}

			TwitchHelper.logAdvanced(LOGLEVEL.SUCCESS, "automator", `Channel data for ${this.broadcaster_user_login} fetched from ${from_cache ? 'cache' : 'notification'}.`);

			
			const chapter_data = this.getChapterData(event);

			const chapter = new TwitchVODChapter(chapter_data);

			this.vod.addChapter(chapter);
			this.vod.saveJSON('game update');

			TwitchHelper.webhook({
				'action': 'chapter_update',
				'chapter': chapter,
				'vod': this.vod
			});

			// append chapter to history
			// $fp = fopen(TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . "history" . DIRECTORY_SEPARATOR . this.broadcaster_user_login . ".jsonline", 'a');
			// fwrite($fp, json_encode($chapter) . "\n");
			// fclose($fp);

			TwitchHelper.logAdvanced(
				LOGLEVEL.SUCCESS,
				"automator",
				`Game updated on '${this.broadcaster_user_login}' to '${event.category_name}' (${event.title}) using ${from_cache ? 'cache' : 'notification'}.`
			);

			return true;

		} else {

			if (!this.payload_eventsub || !this.payload_eventsub.event) {
				TwitchHelper.logAdvanced(LOGLEVEL.ERROR, "automator", `Tried to get event for ${this.broadcaster_user_login} but it was not available.`);
				return false;
			}

			if (!("title" in this.payload_eventsub.event)) {
				TwitchHelper.logAdvanced(LOGLEVEL.ERROR, "automator", `Event type was wrong for ${this.broadcaster_user_login}`);
				return false;
			}
			
			const event = this.payload_eventsub.event;
			TwitchConfig.setCache(`${this.broadcaster_user_login}.channeldata`, JSON.stringify(this.payload_eventsub.event));
			TwitchHelper.logAdvanced(LOGLEVEL.INFO, "automator", `Channel ${this.broadcaster_user_login} not online, saving channel data to cache: ${event.category_name} (${event.title})`);

			let chapter_data = this.getChapterData(event);
			chapter_data.online = false;

			// $fp = fopen(TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . "history" . DIRECTORY_SEPARATOR . this.broadcaster_user_login . ".jsonline", 'a');
			// fwrite($fp, json_encode($chapter) . "\n");
			// fclose($fp);

			return true;
		}

	}

	getChapterData(event: ChannelUpdateEvent): TwitchVODChapterMinimalJSON {
		
		let chapter_data = {
			'time' 			: this.getDateTime(),
			'dt_started_at'	: TwitchHelper.JSDateToPHPDate(new Date()),
			'game_id' 		: event.category_id,
			'game_name'		: event.category_name,
			// 'viewer_count' 	: $data_viewer_count,
			'title'			: event.title,
			'is_mature'		: event.is_mature,
			'online'		: true,
		} as TwitchVODChapterMinimalJSON;			

		// extra metadata with a separate api request
		if (TwitchConfig.cfg("api_metadata")) {
			const streams = TwitchHelper.getStreams(this.getUserID());
			if (streams && streams.length > 0) {
				const stream = streams[0];
				if (stream["viewer_count"] !== undefined) {
					chapter_data.viewer_count = stream.viewer_count;
				} else {
					TwitchHelper.logAdvanced(LOGLEVEL.ERROR, "automator", "No viewer count in metadata request.");
				}
			} else {
				TwitchHelper.logAdvanced(LOGLEVEL.ERROR, "automator", "No streams in metadata request.");
			}
			//$chapter['viewer_count'];
		}
		return chapter_data;

	}
    
}