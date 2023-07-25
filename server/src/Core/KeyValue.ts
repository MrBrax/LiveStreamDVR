import { debugLog } from "@/Helpers/Console";
import chalk from "chalk";
import { isDate } from "date-fns";
import { minimatch } from "minimatch";
import EventEmitter from "node:events";
import fs from "node:fs";
import path from "node:path";
import { BaseConfigCacheFolder, BaseConfigPath } from "./BaseConfig";
import { LOGLEVEL, log } from "./Log";

export interface KeyValueData {
    value: string;
    created: Date;
    expires?: Date;
}

export class KeyValue extends EventEmitter {
    private data: Record<string, KeyValueData> = {};
    // public static events = new EventEmitter();

    public static instance: KeyValue | undefined;

    static getInstance(): KeyValue {
        if (!this.instance) {
            this.instance = new KeyValue();
        }
        return this.instance;
    }

    static getCleanInstance() {
        return new KeyValue();
    }

    static destroyInstance() {
        this.instance = undefined;
    }

    getData(): Record<string, KeyValueData> {
        return this.data;
    }

    getAllRaw(): Record<string, KeyValueData> {
        const filteredExpired = Object.entries(this.data).filter(
            ([key, value]) => {
                if (value.expires) {
                    return value.expires.getTime() > Date.now();
                } else {
                    return true;
                }
            }
        );
        return Object.fromEntries(filteredExpired);
    }

    getAll(): Record<string, string> {
        // entries that are not expired
        const entries = Object.entries(this.getAllRaw());
        return Object.fromEntries(
            entries.map(([key, value]) => [key, value.value])
        );
    }

    count() {
        return Object.keys(this.getAll()).length;
    }

    /**
     * Check if a key exists in the key-value store.
     * @param key
     * @deprecated Use hasAsync instead
     * @returns
     */
    has(key: string): boolean {
        key = key.replaceAll("/", "");

        // check if the key exists and is not expired
        if (key in this.data) {
            const val = this.data[key];
            if (val.expires) {
                return val.expires.getTime() > Date.now();
            } else {
                return true;
            }
        } else {
            return false;
        }
    }

    hasAsync(key: string): Promise<boolean> {
        return new Promise((resolve) => {
            resolve(this.has(key));
        });
    }

    getRaw(key: string): KeyValueData | false {
        key = key.replaceAll("/", "");

        if (!this.has(key) || this.data[key] === undefined) {
            return false;
        }

        return this.data[key];
    }

    getRawAsync(key: string): Promise<KeyValueData | false> {
        return new Promise((resolve) => {
            resolve(this.getRaw(key));
        });
    }

    /**
     * Get a value from the key-value store.
     * @param key
     * @returns {string|false} The value or false if the key does not exist.
     * @deprecated Use getAsync instead
     */
    get(key: string): string | false {
        const raw = this.getRaw(key);

        if (raw === false) {
            return false;
        }

        return raw.value;
    }

    /**
     * Get a value from the key-value store as a promise. Rejects if the key does not exist.
     * Could be used for an external cache store like Redis in the future.
     * @param key
     * @returns
     */
    getAsync(key: string): Promise<string | false> {
        return new Promise((resolve, reject) => {
            const value = this.getRaw(key);
            if (value === false) {
                reject();
            } else {
                resolve(value.value);
            }
        });
    }

    /**
     * Get a value from the key-value store as an object.
     * @param key
     * @returns
     * @deprecated Use getObjectAsync instead
     */
    getObject<T>(key: string): T | false {
        const value = this.get(key);

        if (value === false) {
            return false;
        }

        try {
            return JSON.parse(value);
        } catch (error) {
            return false;
        }
    }

    /**
     * Get a value from the key-value store as an object as a promise. Rejects if the key does not exist.
     * @param key
     * @returns
     */
    getObjectAsync<T>(key: string): Promise<T | false> {
        return new Promise((resolve) => {
            resolve(this.getObject<T>(key));
        });
    }

    /**
     *
     * @param key
     * @returns
     * @deprecated Use getBoolAsync instead
     */
    getBool(key: string): boolean {
        return this.get(key) === "true";
    }

    getBoolAsync(key: string): Promise<boolean> {
        return new Promise((resolve) => {
            resolve(this.getBool(key));
        });
    }

    /**
     *
     * @param key
     * @param def
     * @returns
     * @deprecated Use getIntAsync instead
     */
    getInt(key: string, def?: number): number {
        const value = this.get(key);
        if (value === false) {
            if (def !== undefined) {
                return def;
            } else {
                return 0;
            }
        } else {
            return parseInt(value);
        }
        // return parseInt(this.get(key) || "0");
    }

    getIntAsync(key: string, def?: number): Promise<number> {
        return new Promise((resolve) => {
            resolve(this.getInt(key, def));
        });
    }

    /**
     * Set a value in the key-value store.
     * @param key
     * @param value
     * @deprecated Use setAsync instead
     */
    set(key: string, value: string): void {
        key = key.replaceAll("/", "");

        debugLog(`Setting key-value pair: ${key} = ${value}`);
        // this.data[key] = value;
        this.data[key] = {
            value: value,
            created: new Date(),
        };
        this.emit("set", key, value);

        this.save();
    }

    setAsync(key: string, value: string): Promise<void> {
        return new Promise((resolve) => {
            this.set(key, value);
            resolve();
        });
    }

    setExpiring(key: string, value: string, seconds: number): void {
        key = key.replaceAll("/", "");

        debugLog(
            `Setting expiring key-value pair: ${key} = ${value} (expires in ${seconds} seconds)`
        );

        this.data[key] = {
            value: value,
            created: new Date(),
            expires: new Date(Date.now() + seconds * 1000),
        };
        this.emit("set", key, value);

        this.save();
    }

    /**
     * Set a value in the key-value store as an object (JSON).
     * @param key
     * @param value
     * @deprecated Use setObjectAsync instead
     */
    setObject<T>(key: string, value: T | null): void {
        key = key.replaceAll("/", "");

        if (value === null) {
            this.delete(key);
        } else {
            // if (Config.debug) console.debug(`Setting key-value pair object: ${key} = ${JSON.stringify(value)}`);
            // this.data[key] = JSON.stringify(value);
            // this.emit("set", key, value);
            this.set(key, JSON.stringify(value));
        }

        // this.save();
    }

    setObjectAsync<T>(key: string, value: T | null): Promise<void> {
        return new Promise((resolve) => {
            this.setObject(key, value);
            resolve();
        });
    }

    /**
     *
     * @param key
     * @param value
     * @deprecated Use setBoolAsync instead
     */
    setBool(key: string, value: boolean) {
        this.set(key, value ? "true" : "false");
    }

    setBoolAsync(key: string, value: boolean): Promise<void> {
        return new Promise((resolve) => {
            this.setBool(key, value);
            resolve();
        });
    }

    /**
     *
     * @param key
     * @param value
     * @deprecated Use setIntAsync instead
     */
    setInt(key: string, value: number) {
        this.set(key, value.toString());
    }

    setIntAsync(key: string, value: number): Promise<void> {
        return new Promise((resolve) => {
            this.setInt(key, value);
            resolve();
        });
    }

    setDate(key: string, date: Date) {
        if (!date || isNaN(date.getTime()) || !isDate(date)) {
            throw new Error("Invalid date");
        }
        this.set(key, date.toISOString());
    }

    getDate(key: string): Date | false {
        const value = this.get(key);
        if (value === false) {
            return false;
        }
        return new Date(value);
    }

    setExpiry(key: string, seconds: number) {
        if (!this.has(key)) {
            throw new Error("Key does not exist");
        }

        this.data[key].expires = new Date(Date.now() + seconds * 1000);
    }

    cleanWildcard(keyWildcard: string /* limitSeconds: number */) {
        let deleted = 0;

        const keys = Object.keys(this.data);

        for (const key of keys) {
            // match the key with wildcard, which uses * as a wildcard
            /*
            if (minimatch(key, keyWildcard)) {
                const date = this.getDate(key);
                if (date !== false) {
                    if (date.getTime() < Date.now() - (limitSeconds * 1000)) {
                        this.delete(key);
                        deleted++;
                    }
                }
            }
            */

            if (minimatch(key, keyWildcard)) {
                this.delete(key, true);
                deleted++;
            }

            /*
            if (key.startsWith(keyWildcard) && key.endsWith(".time")) {
                const date = this.getDate(key);
                if (date !== false) {
                    if (date.getTime() < Date.now() - (limitSeconds * 1000)) {
                        this.delete(key);
                        deleted++;
                    }
                }
            }
            */
        }

        if (deleted == 0) {
            log(
                LOGLEVEL.WARNING,
                "keyvalue.cleanWildcard",
                `No keys deleted for wildcard ${keyWildcard}`
            );
        }
    }

    filterExpired() {
        // filter out expired keys
        const keys = Object.keys(this.data);
        for (const key of keys) {
            const value = this.data[key];
            if (value.expires && value.expires.getTime() < Date.now()) {
                log(
                    LOGLEVEL.DEBUG,
                    "keyvalue.filterExpired",
                    `Deleting expired key ${key} (expired at ${value.expires.toISOString()})`
                );
                delete this.data[key];
            }
        }
    }

    /**
     * Delete a value from the key-value store.
     * @param key
     */
    delete(key: string, dontSave = false) {
        if (this.data[key]) {
            debugLog(`Deleting key-value pair: ${key}`);
            delete this.data[key];
            this.emit("delete", key);
            if (!dontSave) this.save();
        }
    }

    deleteAsync(key: string): Promise<boolean> {
        return new Promise((resolve) => {
            if (this.data[key]) {
                this.delete(key);
                resolve(true);
            } else {
                resolve(false);
            }
        });
    }

    /**
     * Delete all values from the key-value store.
     */
    deleteAll() {
        debugLog("Deleting all key-value pairs");
        this.data = {};
        this.emit("delete_all");
        this.save();
    }

    deleteAllAsync(): Promise<void> {
        return new Promise((resolve) => {
            this.deleteAll();
            resolve();
        });
    }

    /**
     * Save the key-value store to disk.
     */
    save() {
        this.filterExpired();
        fs.writeFileSync(
            BaseConfigPath.keyvalueDatabase,
            JSON.stringify(this.data, null, 4)
        );
    }

    load() {
        console.log(chalk.blue("Loading key-value pairs..."));
        if (fs.existsSync(BaseConfigPath.keyvalueDatabase)) {
            this.data = JSON.parse(
                fs.readFileSync(BaseConfigPath.keyvalueDatabase, "utf8"),
                (key, value) => {
                    if (key === "created" || key === "expires") {
                        return new Date(value);
                    } else {
                        return value;
                    }
                }
            );
            this.filterExpired();
            console.log(
                chalk.green(
                    `Loaded ${Object.keys(this.data).length} key-value pairs`
                )
            );
        } else if (fs.existsSync(BaseConfigPath.keyvalue)) {
            console.log("Key-value pairs found in old format, migrating...");
            this.migrateFromFlatKeyValue();
            // this.data = JSON.parse(fs.readFileSync(BaseConfigPath.keyvalue, "utf8"));
            // console.log(chalk.green(`Loaded ${Object.keys(this.data).length} key-value pairs`));
        } else {
            console.log("No key-value pairs found in storage.");
            this.migrateFromFileBasedKeyValue();
        }

        this.cleanWildcard("tw.eventsub.*"); // clean up old eventsub acks
    }

    migrateFromFileBasedKeyValue() {
        console.log(chalk.blue("Migrating key-value pairs..."));
        const files = fs
            .readdirSync(BaseConfigCacheFolder.keyvalue)
            .filter((file) => !file.endsWith(".json"));
        let migrated = 0;
        for (const file of files) {
            // const key = file.replace(".json", "");
            const value = fs.readFileSync(
                path.join(BaseConfigCacheFolder.keyvalue, file),
                "utf8"
            );
            this.set(file, value);
            fs.unlinkSync(path.join(BaseConfigCacheFolder.keyvalue, file));
            migrated++;
        }
        if (migrated > 0) {
            console.log(chalk.green(`Migrated ${migrated} key-value pairs`));
            this.save();
        } else {
            console.log("No key-value pairs found to migrate.");
        }
    }

    migrateFromFlatKeyValue() {
        console.log(
            chalk.blue("Migrating key-value pairs from flat key-value store...")
        );
        const data = JSON.parse(
            fs.readFileSync(BaseConfigPath.keyvalue, "utf8")
        );

        const newData: Record<string, KeyValueData> = {};

        for (const key of Object.keys(data)) {
            newData[key] = {
                value: data[key],
                created: new Date(),
            };
        }

        this.data = newData;

        console.log(
            chalk.green(
                `Migrated ${Object.keys(this.data).length} key-value pairs`
            )
        );

        this.save();

        // fs.unlinkSync(BaseConfigPath.keyvalue);
        fs.renameSync(
            BaseConfigPath.keyvalue,
            BaseConfigPath.keyvalue + ".old"
        );
    }

    // on(event: "set", listener: (key: string, value: string) => void): this;
    // on(event: "delete", listener: (key: string) => void): this;
    // on(event: "delete_all", listener: () => void): this;
    // on(event: string, listener: (...args: any[]) => void): this {
    //     return super.on(event, listener);
    // }
}

export declare interface KeyValue {
    on(event: "set", listener: (key: string, value: string) => void): this;
    on(event: "delete", listener: (key: string) => void): this;
    on(event: "delete_all", listener: () => void): this;
    // on(event: string, listener: (...args: any[]) => void): this;
}
