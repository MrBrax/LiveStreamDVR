import { format } from "date-fns";
import fs from "node:fs";

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
    public author = "";
    public album_artist = "";
    public grouping = "";
    public composer = "";
    public year = "";
    public track = "";
    public comment = "";
    public genre = "";
    public copyright = "";
    public description = "";
    public synopsis = "";
    public show = "";
    public episode_id = "";
    public network = "";
    public lyrics = "";

    public date: Date | undefined;

    public chapters: FFmpegMetadataChapter[] = [];

    constructor() {
        this.artist = "";
        this.album = "";
        this.title = "";
    }

    sanitize(str: string): string {
        return str
            .replace(/\\/g, "\\\\")
            .replace(/=/g, "\\=")
            .replace(/;/g, "\\;")
            .replace(/#/g, "\\#")
            .replace(/\n/g, "\\\n");            
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

    setAuthor(author: string): this {
        this.author = author;
        return this;
    }

    setAlbumArtist(album_artist: string): this {
        this.album_artist = album_artist;
        return this;
    }

    setGrouping(grouping: string): this {
        this.grouping = grouping;
        return this;
    }

    setComposer(composer: string): this {
        this.composer = composer;
        return this;
    }

    setYear(year: string): this {
        this.year = year;
        return this;
    }

    setTrack(track: string): this {
        this.track = track;
        return this;
    }

    setComment(comment: string): this {
        this.comment = comment;
        return this;
    }

    setDate(date: Date): this {
        this.date = date;
        return this;
    }

    addChapter(start: number, end: number, title: string, timebase: string, meta?: string[]): this {
        if (end < start) {
            throw new Error("End time must be greater than start time");
        }
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
        if (this.artist !== "") result += `artist=${this.sanitize(this.artist)}\n`;
        if (this.album !== "") result += `album=${this.sanitize(this.album)}\n`;
        if (this.title !== "") result += `title=${this.sanitize(this.title)}\n`;
        if (this.author !== "") result += `author=${this.sanitize(this.author)}\n`;
        if (this.album_artist !== "") result += `album_artist=${this.sanitize(this.album_artist)}\n`;
        if (this.grouping !== "") result += `grouping=${this.sanitize(this.grouping)}\n`;
        if (this.composer !== "") result += `composer=${this.sanitize(this.composer)}\n`;
        if (this.year !== "") result += `year=${this.sanitize(this.year)}\n`;
        if (this.track !== "") result += `track=${this.sanitize(this.track)}\n`;
        if (this.comment !== "") result += `comment=${this.sanitize(this.comment)}\n`;
        if (this.genre !== "") result += `genre=${this.sanitize(this.genre)}\n`;
        if (this.copyright !== "") result += `copyright=${this.sanitize(this.copyright)}\n`;
        if (this.description !== "") result += `description=${this.sanitize(this.description)}\n`;
        if (this.synopsis !== "") result += `synopsis=${this.sanitize(this.synopsis)}\n`;
        if (this.show !== "") result += `show=${this.sanitize(this.show)}\n`;
        if (this.episode_id !== "") result += `episode_id=${this.sanitize(this.episode_id)}\n`;
        if (this.network !== "") result += `network=${this.sanitize(this.network)}\n`;
        if (this.lyrics !== "") result += `lyrics=${this.sanitize(this.lyrics)}\n`;
        if (this.date !== undefined) {
            result += `date=${format(this.date, "yyyy-MM-dd")}\n`;
            result += `year=${format(this.date, "yyyy")}\n`;
            result += `creation_time=${format(this.date, "yyyy-MM-dd")}\n`;
        }
        result += "\n";

        // this.chapters.sort((a, b) => a.start - b.start);

        if (this.chapters.length > 0) {
            for (const chapter of this.chapters) {
                result += "[CHAPTER]\n";
                if (chapter.meta) {
                    for (const m of chapter.meta) {
                        result += `# ${this.sanitize(m)}\n`;
                    }
                }
                result += `TIMEBASE=${chapter.timebase}\n`;
                result += `START=${chapter.start}\n`;
                result += `END=${chapter.end}\n`;
                result += `title=${this.sanitize(chapter.title)}\n\n`;
            }
        }
        return result;
    }

    writeToFile(file: string): string {
        fs.writeFileSync(file, this.getString(), { encoding: "utf8" });
        return file;
    }

}