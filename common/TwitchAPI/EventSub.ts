import type { EventSubChannelUpdate } from "./EventSub/ChannelUpdate";
import type { EventSubStreamOffline } from "./EventSub/StreamOffline";
import type { EventSubStreamOnline } from "./EventSub/StreamOnline";

export type EventSubResponse = EventSubChannelUpdate | EventSubStreamOnline | EventSubStreamOffline;