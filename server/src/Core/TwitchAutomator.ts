import { TwitchConfig } from "./TwitchConfig";
import { TwitchVOD } from "./TwitchVOD";
import express from "express";
import { LOGLEVEL, TwitchHelper } from "./TwitchHelper";
import { IncomingHttpHeaders } from "http";
import { EventSubResponse } from "@/TwitchAPI/EventSub";
import { TwitchChannel } from "./TwitchChannel";
import fs from "fs";
import path from "path";

export class TwitchAutomator {

    vod: TwitchVOD | undefined;

    private broadcaster_user_id = "";
	private broadcaster_user_login = "";
	private broadcaster_user_name  = "";
	
	payload_eventsub: any;
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

			// TwitchConfig.setCache("{$this->broadcaster_user_login}.last.update", (new DateTime())->format(DateTime::ATOM));
			TwitchConfig.setCache(`${this.broadcaster_user_login}.last.update`, new Date().toISOString());
			TwitchHelper.logAdvanced(LOGLEVEL.INFO, "automator", `Channel update for ${this.broadcaster_user_login}`);

			this.updateGame();
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

			TwitchConfig.setCache("{$this->broadcaster_user_login}.online", "1");
			TwitchConfig.setCache("{$this->broadcaster_user_login}.vod.id", event.id);
			TwitchConfig.setCache("{$this->broadcaster_user_login}.vod.started_at", event.started_at);

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

				this.download();
			}
		} else if (subscription_type == "stream.offline") {

			TwitchConfig.setCache("{$this->broadcaster_user_login}.last.offline", new Date().toISOString());
			TwitchHelper.logAdvanced(LOGLEVEL.INFO, "automator", `Stream offline for ${this.broadcaster_user_login}`);

			// TwitchConfig.setCache("{$this->broadcaster_user_login}.online", "0");
			TwitchConfig.setCache("{$this->broadcaster_user_login}.online", null);
			// TwitchConfig.setCache("{$this->broadcaster_user_login}.vod.id", null);
			// TwitchConfig.setCache("{$this->broadcaster_user_login}.vod.started_at", null);

			this.end();
		} else {

			TwitchHelper.logAdvanced(LOGLEVEL.ERROR, "automator", `No supported subscription type (${subscription_type}).`);
		}

    }

	updateGame() {
		throw new Error("Method not implemented.");
	}
    
}