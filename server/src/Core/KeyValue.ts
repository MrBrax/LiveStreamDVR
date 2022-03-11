import fs from "fs";
import { BaseConfigFolder, BaseConfigPath } from "./BaseConfig";
import { LOGLEVEL, TwitchLog } from "./TwitchLog";

export class KeyValue {
    
    public static data: Record<string, string> = {};

    // todo: redis or something
    static get(key: string): string | false {

        key = key.replace(/\//g, "");

        return this.data[key] !== undefined ? this.data[key] : false;

    }

    static set(key: string, value: string | null) {

        key = key.replace(/\//g, "");

        if (value === null) {
            this.delete(key);
        } else {
            this.data[key] = value;
        }
        
        this.save();

    }

    static delete(key: string) {
        if (this.data[key]) {
            delete this.data[key];
            this.save();
        }
    }

    static deleteAll() {
        this.data = {};
        this.save();
    }
    
    static save() {
        fs.writeFileSync(BaseConfigPath.keyvalue, JSON.stringify(this.data));
    }

    static load() {
        if (fs.existsSync(BaseConfigPath.keyvalue)) {
            this.data = JSON.parse(fs.readFileSync(BaseConfigPath.keyvalue, "utf8"));
            TwitchLog.logAdvanced(LOGLEVEL.SUCCESS, "keyvalue", `Loaded ${Object.keys(this.data).length} key-value pairs`);
        }
        this.migrateFromFileBasedKeyValue();
    }

    static migrateFromFileBasedKeyValue() {
        const files = fs.readdirSync(BaseConfigFolder.keyvalue).filter(file => !file.endsWith(".json"));
        let migrated = 0;
        for (const file of files) {
            const key = file.replace(".json", "");
            const value = fs.readFileSync(BaseConfigFolder.keyvalue + file, "utf8");
            this.set(key, value);
            fs.unlinkSync(BaseConfigFolder.keyvalue + file);
            migrated++;
        }
        if (migrated > 0) {
            TwitchLog.logAdvanced(LOGLEVEL.SUCCESS, "keyvalue", `Migrated ${migrated} key-value pairs`);
            this.save();
        }
    }

}