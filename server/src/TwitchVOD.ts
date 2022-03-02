import fs from 'fs';
import path from 'path';

export class TwitchVOD {
    
    capture_id: string;
    filename: string;
    basename: string;
    directory: string;

    constructor() {
        this.capture_id = "";
        this.filename = "";
        this.basename = "";
        this.directory = "";
    }

    static load(filename: string): TwitchVOD {
        
        // check if file exists
        if (!fs.existsSync(filename)) {
            throw new Error("File does not exist: " + filename);
        }

        // load file
        const data = fs.readFileSync(filename, 'utf8');
        if (data.length == 0) {
            throw new Error("File is empty: " + filename);
        }

        // parse file
        const json = JSON.parse(data);

        // create object
        const vod = new TwitchVOD();
        vod.capture_id = json.capture_id;
        vod.filename = filename;
        vod.basename = path.basename(filename);
        vod.directory = path.dirname(filename);

        return vod;
        
    }
}