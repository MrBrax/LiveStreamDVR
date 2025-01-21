import { BaseAutomator } from "../Base/BaseAutomator";
import type { KickChannel } from "./KickChannel";
import type { KickVOD } from "./KickVOD";

export class KickAutomator extends BaseAutomator {
    public vod: KickVOD | undefined;
    public channel: KickChannel | undefined;
    public realm = "kick";
    // payload_eventsub: EventSubResponse | undefined;
}
