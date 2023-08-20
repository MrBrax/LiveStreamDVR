export interface HistoryEntryOffline {
    time: string;
    action: "offline";
}

export interface HistoryEntryOnline {
    time: string;
    action: "online";
}

export interface HistoryEntryChapter {
    started_at: string;
    game_id: string;
    game_name: string;
    title: string;
    is_mature: boolean;
    online: boolean;
    viewer_count?: number;
    box_art_url: string;
}

export type HistoryEntry = HistoryEntryOffline | HistoryEntryOnline | HistoryEntryChapter;