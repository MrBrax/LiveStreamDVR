import chalk from "chalk";
import fs from "fs";
import path from "path";
import { BaseConfigFolder, BaseConfigPath } from "./BaseConfig";

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
        fs.writeFileSync(BaseConfigPath.keyvalue, JSON.stringify(this.data, null, 4));
    }

    static load() {
        console.log(chalk.blue("Loading key-value pairs..."));
        if (fs.existsSync(BaseConfigPath.keyvalue)) {
            this.data = JSON.parse(fs.readFileSync(BaseConfigPath.keyvalue, "utf8"));
            console.log(chalk.green(`Loaded ${Object.keys(this.data).length} key-value pairs`));
        } else {
            console.log("No key-value pairs found in storage.");
            this.migrateFromFileBasedKeyValue();
        }
    }

    static migrateFromFileBasedKeyValue() {
        console.log(chalk.blue("Migrating key-value pairs..."));
        const files = fs.readdirSync(BaseConfigFolder.keyvalue).filter(file => !file.endsWith(".json"));
        let migrated = 0;
        for (const file of files) {
            // const key = file.replace(".json", "");
            const value = fs.readFileSync(path.join(BaseConfigFolder.keyvalue, file), "utf8");
            this.set(file, value);
            fs.unlinkSync(path.join(BaseConfigFolder.keyvalue, file));
            migrated++;
        }
        if (migrated > 0) {
            console.log(chalk.green(`Migrated ${migrated} key-value pairs`));
            this.save();
        } else {
            console.log("No key-value pairs found to migrate.");
        }
    }

}