import { TwitchVOD } from "./TwitchVOD";

export class LiveStreamDVR {
    public static instance: LiveStreamDVR | undefined;

    vods: TwitchVOD[] = [];

    static getInstance(): LiveStreamDVR {
        if (!this.instance) {
            this.instance = new LiveStreamDVR();
        }
        return this.instance;
    }

    static getCleanInstance() {
        return new LiveStreamDVR();
    }

    static destroyInstance() {
        this.instance = undefined;
    }
}