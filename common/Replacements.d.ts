export interface VodBasenameTemplate extends Record<string, string> {
    login: string;
    date: string;
    year: string;
    month: string;
    day: string;
    id: string;
    season: string;
    episode: string;
}

export interface ExporterFilenameTemplate extends Record<string, string> {
    login: string;
    title: string;
    stream_number: string;
    comment: string;
    date: string;
    resolution: string;
}

export interface TemplateFields {
    [key: string]: { display: string };
}