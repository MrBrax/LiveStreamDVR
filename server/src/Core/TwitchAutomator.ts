import { TwitchConfig } from "./TwitchConfig";
import { TwitchVOD } from "./TwitchVOD";
import express from "express";

export class TwitchAutomator {

    vod: TwitchVOD | undefined;

    private broadcaster_user_id = "";
	private broadcaster_user_login = "";
	private broadcaster_user_name  = "";

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
	public handle(data: any, headers: any)
	{

    }
    
}