import { Log, LOGLEVEL } from "./Log";

export class VODChapter {

    /**
     * Started at date, offset and duration are calculated from this.
     */
    public started_at!: Date;

    public offset?: number;
    public duration?: number;

    public title = "";

    /**
    * Was it added when the channel was online?
    */
    public online = false;

    public calculateDurationAndOffset(vod_started_at: Date, vod_ended_at: Date | undefined, next_chapter_started_at: Date | undefined): void {

        if (vod_started_at.getTime() > this.started_at.getTime()) { // this chapter started before the vod started

            const started_at = vod_started_at;

            if (next_chapter_started_at) {
                this.duration = (next_chapter_started_at.getTime() - started_at.getTime()) / 1000;
            } else if (vod_ended_at) {
                this.duration = (vod_ended_at.getTime() - started_at.getTime()) / 1000;
            } else {
                Log.logAdvanced(LOGLEVEL.WARNING, "chapter", `No next chapter or vod end time for chapter ${this.title} (${this.started_at.toISOString()}), duration will probably be 0.`);
            }

            this.offset = 0;

        } else {

            if (next_chapter_started_at) {
                this.duration = (next_chapter_started_at.getTime() - this.started_at.getTime()) / 1000;
            } else if (vod_ended_at) {
                this.duration = (vod_ended_at.getTime() - this.started_at.getTime()) / 1000;
            } else {
                Log.logAdvanced(LOGLEVEL.WARNING, "chapter", `No next chapter or vod end time for chapter ${this.title} (${this.started_at.toISOString()}), duration will probably be 0.`);
            }

            this.offset = (this.started_at.getTime() - vod_started_at.getTime()) / 1000;

        }

        // console.debug(`Calculated duration and offset for chapter: ${this.title}`, this.offset, this.duration);

    }

}