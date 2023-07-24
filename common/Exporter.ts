export interface ExporterOptions {
    /** VOD UUID */
    vod?: string;
    segment?: number;
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
    /** Title template with variables which will be replaced with values from the parser */
    title_template?: string;
    /** Title static string which will be used as the title, no variables will be replaced */
    title?: string;
    /** Remote for RClone */
    remote?: string;
    /** Playlist ID for video sites */
    playlist_id?: string;
}

export interface ExportData {
    exporter?: string;
    exported_at?: string;
    youtube_id?: string;
    youtube_playlist_id?: string;
}
