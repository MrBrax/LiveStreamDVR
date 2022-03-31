import chalk from "chalk";
import events from "events";
import fs from "fs";
import { replaceAll } from "Helpers/ReplaceAll";
import path from "path";
import { BaseConfigFolder, BaseConfigPath } from "./BaseConfig";

export class KeyValue {
    
    public static data: Record<string, string> = {};

    public static events = new events.EventEmitter();

    static has(key: string): boolean {
        return key in KeyValue.data;
    }

    // todo: redis or something
    static get(key: string): string | false {

        key = replaceAll(key, /\//g, ""); // @todo: replaceAll

        return this.data[key] !== undefined ? this.data[key] : false;

    }

    static getObject<T>(key: string): T | false {

        key = replaceAll(key, /\//g, ""); // @todo: replaceAll

        if (this.data[key] === undefined) {
            return false;
        }

        try {
            return JSON.parse(this.data[key]);
        } catch (error) {
            return false;
        }

    }

    static set(key: string, value: string | null) {

        key = replaceAll(key, /\//g, ""); // @todo: replaceAll

        if (value === null) {
            this.delete(key);
        } else {
            this.data[key] = value;
            this.events.emit("set", key, value);
        }
        
        this.save();

    }

    static setObject<T>(key: string, value: T | null) {

        key = replaceAll(key, /\//g, ""); // @todo: replaceAll

        if (value === null) {
            this.delete(key);
        } else {
            this.data[key] = JSON.stringify(value);
            this.events.emit("set", key, value);
        }

        this.save();

    }

    static delete(key: string) {
        if (this.data[key]) {
            delete this.data[key];
            this.events.emit("delete", key);
            this.save();
        }
    }

    static deleteAll() {
        this.data = {};
        this.events.emit("delete_all");
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