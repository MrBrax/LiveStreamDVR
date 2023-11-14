export interface VodBasenameTemplate extends Record<string, string> {
    // login: string;
    internalName: string;
    displayName: string;
    date: string;
    year: string;
    year_short: string;
    month: string;
    day: string;
    hour: string;
    minute: string;
    second: string;
    id: string;
    season: string;
    episode: string;
    absolute_season: string;
    absolute_episode: string;
    title: string;
    game_name: string;
    game_id: string;
}

export interface VodBasenameWithChapterTemplate extends VodBasenameTemplate {
    chapter_number: string;
    chapter_title: string;
    chapter_game_name: string;
    chapter_game_id: string;
}

export interface ExporterFilenameTemplate extends Record<string, string> {
    login: string;
    internalName: string;
    displayName: string;
    title: string;
    stream_number: string;
    comment: string;
    date: string;
    year: string;
    month: string;
    day: string;
    resolution: string;
    id: string;
    season: string;
    episode: string;
    absolute_season: string;
    absolute_episode: string;
}

// export interface ExporterTitleTemplate extends VodBasenameTemplate {
//     title: string;
// }

export interface ClipBasenameTemplate extends Record<string, string> {
    id: string;
    quality: string;
    clip_date: string;
    title: string;
    creator: string;
    broadcaster: string;
}

export interface TemplateFields {
    [key: string]: TemplateField;
}

export interface TemplateField {
    display: string;
    description?: string;
    deprecated?: boolean;
}
