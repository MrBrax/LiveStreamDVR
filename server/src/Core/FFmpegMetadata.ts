interface FFmpegMetadataChapter {
    // id: number;
    start: number;
    end: number;
    title: string;
    timebase: string;
    meta?: string[];
}
export class FFmpegMetadata {

    public artist = "";
    public album = "";
    public title = "";
    public chapters: FFmpegMetadataChapter[] = [];

    constructor() {
        this.artist = "";
        this.album = "";
        this.title = "";
    }

    setArtist(artist: string): this {
        this.artist = artist;
        return this;
    }

    setAlbum(album: string): this {
        this.album = album;
        return this;
    }

    setTitle(title: string): this {
        this.title = title;
        return this;
    }

    addChapter(start: number, end: number, title: string, timebase: string, meta?: string[]): this {
        this.chapters.push({
            start: start,
            end: end,
            title: title,
            timebase: timebase,
            meta: meta,
        });
        return this;
    }

    getString(): string {
        let result = "";
        result += ";FFMETADATA1\n";
        if (this.artist !== "") result += `artist=${this.artist}\n`;
        if (this.album !== "") result += `album=${this.album}\n`;
        if (this.title !== "") result += `title=${this.title}\n`;
        result += "\n";

        if (this.chapters.length > 0) {
            for (const chapter of this.chapters) {
                result += "[CHAPTER]\n";
                for (const m in chapter.meta) {
                    result += `# ${m}\n`;
                }
                result += `TIMEBASE=${chapter.timebase}\n`;
                result += `START=${chapter.start}\n`;
                result += `END=${chapter.end}\n`;
                result += `title=${chapter.title}\n`;
            }
        }
        return result;
    }

}