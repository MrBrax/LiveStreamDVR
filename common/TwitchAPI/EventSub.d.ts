import { EventSubChannelUpdate } from "./EventSub/ChannelUpdate";
import { EventSubStreamOffline } from "./EventSub/StreamOffline";
import { EventSubStreamOnline } from "./EventSub/StreamOnline";

export type EventSubResponse = EventSubChannelUpdate | EventSubStreamOnline | EventSubStreamOffline;