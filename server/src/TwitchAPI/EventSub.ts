import { EventSubChannelUpdate } from "./ChannelUpdate";
import { EventSubStreamOffline } from "./StreamOffline";
import { EventSubStreamOnline } from "./StreamOnline";

export type EventSubResponse = EventSubChannelUpdate | EventSubStreamOnline | EventSubStreamOffline;