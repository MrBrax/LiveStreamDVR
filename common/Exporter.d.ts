export interface ExporterOptions {

    /** VOD UUID */
    vod?: string;
    directory?: string;
    host?: string;
    username?: string;
    password?: string;
    description?: string;
    tags?: string;
    category?: string;
    privacy?: "public" | "private" | "unlisted";
    file_folder?: string;
    file_name?: string;
    file_source?: "segment" | "downloaded" | "burned";
    title_template?: string;
    title?: string;
    remote?: string;
    playlist_id?: string;
}

export interface ExportData {
    exporter?: string;
    exported_at?: string;
    youtube_id?: string;
    youtube_playlist_id?: string;
}