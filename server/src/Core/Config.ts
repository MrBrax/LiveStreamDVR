import { SettingField } from "@common/Config";
import { settingsFields } from "@common/ServerConfig";
import axios, { AxiosResponse } from "axios";
import chalk from "chalk";
import express from "express";
import minimist from "minimist";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { TwitchHelper } from "../Providers/Twitch";
import { YouTubeHelper } from "../Providers/YouTube";
import { AppRoot, BaseConfigCacheFolder, BaseConfigDataFolder, BaseConfigFolder, BaseConfigPath, DataRoot } from "./BaseConfig";
import { Helper } from "./Helper";
import { LiveStreamDVR } from "./LiveStreamDVR";
import { log, LOGLEVEL } from "./Log";
import { TwitchChannel } from "./Providers/Twitch/TwitchChannel";
import { YouTubeChannel } from "./Providers/YouTube/YouTubeChannel";
import { Scheduler } from "./Scheduler";
import i18next from "i18next";
import { debugLog } from "../Helpers/Console";
import { GetRunningProcesses, execSimple } from "../Helpers/Execute";

const argv = minimist(process.argv.slice(2));

export class Config {

    initialised = false;
    config: Record<string, string | number | boolean | string[]> | undefined;
    private _writeConfig = false;
    watcher: fs.FSWatcher | undefined;

    forceDebug = false;

    gitHash?: string;
    gitBranch?: string;

    sessionParser?: express.RequestHandler;


    static readonly streamerCacheTime = 2592000 * 1000; // 30 days
    static readonly settingsFields = settingsFields;

    static MigrateOptions = [
        { from: "youtube_client_id", to: "youtube.client_id" },
        { from: "youtube_client_secret", to: "youtube.client_secret" },
    ];

    static readonly AudioContainer = "m4a";

    static readonly SeasonFormat = "yyyyMM";

    static instance: Config | undefined;
    static getInstance(): Config {
        if (this.instance === undefined) {
            this.instance = new Config();
        }
        return this.instance;
    }

    static getCleanInstance(): Config {
        return new Config();
    }

    static destroyInstance() {
        this.instance = undefined;
    }

    cfg<T>(key: keyof typeof settingsFields, defaultValue?: T): T {

        if (this.config === undefined) {
            console.error("Config not loaded", key, defaultValue);
            throw new Error("Config not loaded");
        }

        if (!Config.settingExists(key)) {
            log(LOGLEVEL.WARNING, "config", `Setting '${key}' does not exist.`);
            console.warn(chalk.red(`Setting '${key}' does not exist.`));
        }

        // return from env if set
        if (this.hasEnvVar(key)) {
            const val: string | undefined = this.envVarValue(key);
            if (val === undefined) {
                return <T>defaultValue; // should not happen
            }
            const field = Config.getSettingField(key);
            if (field && field.type === "number") {
                return <T>parseInt(val);
            } else if (field && field.type === "boolean") {
                return <T>(val === "true" || val === "1");
            } else {
                return <T>val;
            }
        }

        // return default value if not set
        if (this.config[key] === undefined) {
            const field = Config.getSettingField(key);
            if (defaultValue !== undefined) {
                return defaultValue; // user defined default
            } else if (field && field.default !== undefined) {
                return <T>field.default; // field default value
            } else {
                return <T>undefined; // TODO: should this be undefined or 0/""/false?
            }
        }

        // internal type conversion/fixing
        const field = Config.getSettingField(key);
        if (field && field.type === "string") {
            if (this.config[key] === false || this.config[key] === true) {
                return undefined as unknown as T;
            }
        }

        return <T>this.config[key]; // return value

    }

    hasValue(key: keyof typeof settingsFields): boolean {
        if (this.config === undefined) {
            console.error("Config not loaded", key);
            throw new Error("Config not loaded");
        }

        if (!Config.settingExists(key)) {
            log(LOGLEVEL.WARNING, "config", `Setting '${key}' does not exist.`);
            console.warn(chalk.red(`Setting '${key}' does not exist.`));
        }

        if (this.hasEnvVar(key)) {
            return true;
        }

        if (this.config[key] === undefined) {
            return false;
        }

        if (this.config[key] === "") {
            return false;
        }

        if (this.config[key] === null) {
            return false;
        }

        const field = Config.getSettingField(key);
        if (field) {
            if (field.type === "string") {
                if (this.config[key] === false || this.config[key] === true) {
                    return false; // strings should not be booleans, must be a mistake
                }
            } else if (field.type === "boolean") {
                if (this.config[key] === false) {
                    return false; // not sure if this is a good idea
                }
            }
        }


        return true;

    }

    /**
     * @test disable
     * @returns 
     */
    loadConfig() {

        console.log(chalk.blue("Loading config..."));

        if (!fs.existsSync(BaseConfigPath.config)) {
            console.error("Config file not found, creating new one");
            // throw new Error("Config file does not exist: " + this.configFile);
            this.generateConfig();
        }

        const data = fs.readFileSync(BaseConfigPath.config, "utf8");

        let config;
        try {
            config = JSON.parse(data);
        } catch (e) {
            console.error(chalk.bgRed.whiteBright("Error parsing config file"), e);
            process.exit(1);
            return;
        }

        if (config) {
            for (const field of Config.MigrateOptions) {
                if (config[field.from] !== undefined) {
                    config[field.to] = config[field.from];
                    // delete this.config[field.from];
                    log(LOGLEVEL.INFO, "config", `Migrated setting '${field.from}' to '${field.from}'.`);
                }
            }
        }

        // delete invalid settings
        for (const key in config) {
            if (!Config.settingExists(key)) {
                console.warn(chalk.yellow(`Saved setting '${key}' does not exist, deprecated? Discarding.`));
                delete config[key];
            }
        }

        if (!config) {
            throw new Error("Config is empty even after reading it");
        }

        let changed = false;
        for (const key in Config.settingsFields) {
            const setting = Config.settingsFields[key];
            if (config[key] === undefined && setting.default !== undefined) {
                config[key] = setting.default;
                console.log(chalk.yellow(`Setting '${key}' not configured, using default value '${setting.default}'.`));
                changed = true;
            }
        }

        this.config = config;

        if (changed) {
            this.saveConfig("missing default values");
        }

        if (!this.config) throw new Error("Config is empty");

        console.log(chalk.green(`✔ ${Object.keys(this.config).length} settings loaded.`));

        for (const env_var of Object.keys(process.env)) {
            if (env_var.startsWith("TCD_")) {
                const val = this.cfg(env_var.substring(4).toLowerCase());
                console.log(chalk.green(`Overriding setting '${env_var.substring(4)}' with environment variable: '${val}'`));
            }
        }

    }

    generateConfig() {

        console.log("Generating config");

        const example: Record<string, string | boolean | number | string[]> = {};
        for (const key in Config.settingsFields) {
            const field = Config.settingsFields[key];
            if (field["default"] !== undefined) example[key] = field["default"];
        }
        // example["favourites"] = [];
        // example["streamers"] = [];

        this.config = example;
        this.saveConfig("generate config");

    }

    static settingExists(key: string): boolean {
        return this.getSettingField(key) !== undefined;
    }

    static getSettingField(key: string): SettingField<string> | SettingField<number> | SettingField<boolean> | undefined {
        // return this.settingsFields.find(field => field["key"] === key);
        return this.settingsFields[key];
    }

    setConfig<T extends number | string | boolean>(key: keyof typeof settingsFields, value: T): void {

        if (!this.config) {
            throw new Error("Config not loaded");
        }

        const setting = Config.getSettingField(key);

        if (!setting) {
            throw new Error("Setting does not exist: " + key);
        } else {

            let newValue: number | string | boolean = value;

            if (setting.stripslash && typeof newValue === "string") {
                newValue = newValue.replace(/\/$/, "");
            }

            if (setting.type === "number" && typeof newValue === "string") {
                newValue = parseInt(newValue);
            }

            if (setting.type === "boolean" && typeof newValue === "string") {
                newValue = newValue === "true" || newValue === "1";
            }

            if (newValue === "") {
                delete this.config[key]; // TODO: is this a good idea?
                return;
            }

            this.config[key] = newValue;

            /*

            // remove ending slash
            if (setting.stripslash && typeof value === "string") {
                value = value.replace(/\/$/, "");
            }

            // check type
            if (setting.type === "number") {
                value = parseInt(value);
            } else if (setting.type === "boolean") {
                value = value === true;
            }

            this.config[key] = value;
            // TwitchConfig.saveConfig();
            */

        }
    }

    unsetConfig(key: keyof typeof settingsFields): void {
        if (!this.config) {
            throw new Error("Config not loaded");
        }

        if (this.config[key] !== undefined) {
            delete this.config[key];
        }
    }

    /**
     * @test disable
     * @param source 
     * @returns 
     */
    saveConfig(source = "unknown"): boolean {

        this._writeConfig = true;
        this.stopWatchingConfig();

        // back up config
        this.backupConfig();

        // save
        fs.writeFileSync(BaseConfigPath.config, JSON.stringify(this.config, null, 4));

        this._writeConfig = false;

        const success = fs.existsSync(BaseConfigPath.config) && fs.statSync(BaseConfigPath.config).size > 0;

        if (success) {
            log(LOGLEVEL.SUCCESS, "config", `Saved config from ${source}`);
        } else {
            log(LOGLEVEL.ERROR, "config", `Failed to save config from ${source}`);
        }

        this.startWatchingConfig();

        if (this.initialised) { // don't post save config on startup
            this.postSaveConfig();
        }

        return success;

    }

    async postSaveConfig() {
        await TwitchHelper.setupAxios();
        Scheduler.restartScheduler();
        await YouTubeHelper.setupClient();
        await TwitchHelper.setupWebsocket();
        LiveStreamDVR.binaryVersions = {}; // reset binary versions for the next page visit
        i18next.changeLanguage(this.cfg("basic.language", "en"));
    }

    backupConfig() {
        if (fs.existsSync(BaseConfigPath.config)) {
            fs.copyFileSync(BaseConfigPath.config, `${BaseConfigPath.config}.${Date.now()}.bak`);
        }
    }

    static createFolders() {

        for (const folder of Object.values(BaseConfigFolder)) {
            if (!fs.existsSync(folder)) {
                console.warn(chalk.yellow(`Folder '${folder}' does not exist, creating.`));
                fs.mkdirSync(folder, { recursive: true });
                console.log(chalk.green(`Created folder: ${folder}`));
            }
        }

        for (const folder of Object.values(BaseConfigDataFolder)) {
            if (!fs.existsSync(folder)) {
                console.warn(chalk.yellow(`Data folder '${folder}' does not exist, creating.`));
                fs.mkdirSync(folder, { recursive: true });
                console.log(chalk.green(`Created data folder: ${folder}`));
            }
        }

        for (const folder of Object.values(BaseConfigCacheFolder)) {
            if (!fs.existsSync(folder)) {
                console.warn(chalk.yellow(`Cache folder '${folder}' does not exist, creating.`));
                fs.mkdirSync(folder, { recursive: true });
                console.log(chalk.green(`Created cache folder: ${folder}`));
            }
        }

    }

    generateEventSubSecret() {
        if (this.hasValue("eventsub_secret")) return;
        console.log(chalk.yellow("Generating eventsub secret..."));
        const secret = crypto.randomBytes(16).toString("hex");
        this.setConfig<string>("eventsub_secret", secret);
        this.saveConfig("eventsub_secret not set");
    }

    getWebsocketClientUrl(): string | undefined {

        if (!this.cfg("websocket_enabled")) return undefined;

        // override
        if (this.cfg<string>("websocket_client_address")) {
            return this.cfg<string>("websocket_client_address");
        }

        if (Config.debug) {
            return `ws://${Config.debugLocalUrl()}/socket/`;
        }

        if (!this.cfg<string>("app_url")) {
            console.error(chalk.red("App url not set, can't get websocket client url"));
            return undefined;
        }

        if (this.cfg<string>("app_url") === "debug") {
            log(LOGLEVEL.WARNING, "config", "App url set to 'debug', can't get websocket client url");
            return undefined;
        }

        const http_path = this.cfg<string>("app_url");
        // const http_port = Twitchthis.cfg<number>("server_port", 8080);
        const route = "/socket/";
        const ws_path = http_path.replace(/^https:\/\//, "wss://").replace(/^http:\/\//, "ws://");

        return `${ws_path}${route}`;

    }

    /**
     * @test disable
     */
    startWatchingConfig() {

        if (this.watcher) this.stopWatchingConfig();

        // no blocks in testing
        // if (process.env.NODE_ENV === "test") return;

        // monitor config for external changes
        this.watcher = fs.watch(BaseConfigPath.config, (eventType, filename) => {
            if (this._writeConfig) return;
            console.log(`Config file changed: ${eventType} ${filename}`);
            console.log("writeconfig check", Date.now());
            log(LOGLEVEL.WARNING, "config", "Config file changed externally");
            // TwitchConfig.loadConfig();
        });

    }

    stopWatchingConfig() {
        if (this.watcher) this.watcher.close();
    }

    checkPermissions() {
        const folder = DataRoot;
        const testfile = `${folder}/perm`;
        try {
            fs.writeFileSync(testfile, "test");
            fs.unlinkSync(testfile);
        } catch (err) {
            console.error(chalk.bgRedBright.whiteBright.bold(`Permissions error: ${err}`));
            process.exit(1);
        }
    }

    /**
     * @test disable
     */
    static checkBuiltDependencies() {

        // check if the client is built before starting the server
        if (!fs.existsSync(path.join(BaseConfigFolder.client, "index.html"))) {
            console.error(chalk.red("Client is not built. Please run yarn build inside the client-vue folder."));
            console.error(chalk.red(`Expected path: ${path.join(BaseConfigFolder.client, "index.html")}`));
            // process.exit(1);
            throw new Error("Client is not built. Please run yarn build inside the client-vue folder.");
        } else {
            console.log(chalk.green("Client is built: " + path.join(BaseConfigFolder.client, "index.html")));
        }

        // check if the vodplayer is built before starting the server
        /*
        if (!fs.existsSync(path.join(BaseConfigFolder.vodplayer, "index.html"))) {
            console.error(chalk.red("VOD player is not built. Please run yarn build inside the twitch-vod-chat folder."));
            console.error(chalk.red(`Expected path: ${path.join(BaseConfigFolder.vodplayer, "index.html")}`));
            // process.exit(1);
            throw new Error("VOD player is not built. Please run yarn build inside the twitch-vod-chat folder.");
        } else {
            console.log(chalk.green("VOD player is built: " + path.join(BaseConfigFolder.vodplayer, "index.html")));
        }
        */

        // check if the chat dumper is built before starting the server
        if (!fs.existsSync(path.join(AppRoot, "twitch-chat-dumper", "build", "index.js"))) {
            console.error(chalk.red("Chat dumper is not built. Please run yarn build inside the twitch-chat-dumper folder."));
            console.error(chalk.red(`Expected path: ${path.join(AppRoot, "twitch-chat-dumper", "build", "index.js")}`));
            // process.exit(1);
            throw new Error("Chat dumper is not built. Please run yarn build inside the twitch-chat-dumper folder.");
        } else {
            console.log(chalk.green("Chat dumper is built: " + path.join(AppRoot, "twitch-chat-dumper", "build", "index.js")));
        }

    }

    /**
     * @test disable
     */
    static checkAppRoot() {
        // check that the app root is not outside of the root
        if (!fs.existsSync(path.join(BaseConfigFolder.server, "tsconfig.json"))) {
            console.error(chalk.red(`Could not find tsconfig.json in ${path.join(BaseConfigFolder.server, "tsconfig.json")}`));
            // process.exit(1);
            throw new Error(`Could not find tsconfig.json in ${path.join(BaseConfigFolder.server, "tsconfig.json")}`);
        }
    }

    static async resetChannels() {
        TwitchChannel.channels_cache = {};
        LiveStreamDVR.getInstance().channels_config = [];
        LiveStreamDVR.getInstance().getChannels().forEach((channel) => channel.clearVODs());
        LiveStreamDVR.getInstance().clearChannels();
        LiveStreamDVR.getInstance().clearVods();
        LiveStreamDVR.getInstance().loadChannelsConfig();
        TwitchChannel.loadChannelsCache();
        YouTubeChannel.loadChannelsCache();
        await LiveStreamDVR.getInstance().loadChannels();
    }

    async validateExternalURL(test_url = ""): Promise<boolean> {

        const url = test_url !== "" ? test_url : this.cfg<string>("app_url");

        Config.validateExternalURLRules(url);

        let full_url = url + "/api/v0/hook";

        if (this.hasValue("instance_id")) {
            full_url += "?instance=" + this.cfg("instance_id");
        }

        let req: AxiosResponse | undefined;
        let response_body = "";
        let response_status = 0;

        try {
            req = await axios.get(full_url, {
                timeout: 10000,
            });
        } catch (error) {
            if (axios.isAxiosError(error)) {
                response_body = error.response?.data ?? "";
                response_status = error.response?.status ?? 0;
            } else {
                console.error("app url check error", error);
                // res.status(400).send({
                //     status: "ERROR",
                //     message: `External app url could not be contacted on '${full_url}' due to an error: ${error}`,
                // });
                // return;
                throw new Error(`External app url could not be contacted on '${full_url}' due to an error: ${(error as Error).message}`);
            }
        }

        if (req) {
            response_body = req.data;
            response_status = req.status;
        }

        if (response_body !== "No data supplied") {
            // res.status(400).send({
            //     status: "ERROR",
            //     message: `External app url responded with an unexpected response: ${response_body}`,
            // });
            throw new Error(`External app url '${full_url}' responded with an unexpected response: ${response_body} (status: ${response_status})`);
        }

        return true;

    }

    static validateExternalURLRules(url: string) {

        debugLog(`Validating external url: ${url}`);

        // no url
        if (!url) {
            throw new Error("App url not set");
        }

        if (url === "debug") {
            throw new Error("App url is debug, can't validate");
        }

        // no port allowed, only https
        if (url.match(/:\d+/) && !url.match(":443")) {
            throw new Error("App url cannot contain a port");
        }

        // https required
        if (!url.startsWith("https://")) {
            throw new Error("App url must start with https://");
        }

        // no trailing slash
        if (url.endsWith("/")) {
            throw new Error("App url cannot end with a slash");
        }

        return true;
    }

    static get debug(): boolean {
        if (argv.debug) return true;
        if (!Config.getInstance().initialised) return false;
        if (Config.getInstance().forceDebug) return true;
        return Config.getInstance().cfg("debug");
    }

    static get can_shutdown(): boolean {
        if (!LiveStreamDVR.getInstance().getChannels() || LiveStreamDVR.getInstance().getChannels().length === 0) return true; // if there are no channels, allow shutdown
        if (GetRunningProcesses().length > 0) return false; // if there are any running processes, don't allow shutdown
        return !LiveStreamDVR.getInstance().getChannels().some(c => c.is_live); // if there are any live channels, don't allow shutdown
    }

    async getGitHash() {
        let ret;
        try {
            ret = await execSimple("git", ["rev-parse", "HEAD"], "git hash check");
        } catch (error) {
            log(LOGLEVEL.WARNING, "config.getGitHash", "Could not fetch git hash");
            return false;
        }
        if (ret && ret.stdout) {
            this.gitHash = ret.stdout.join("").trim();
            log(LOGLEVEL.SUCCESS, "config.getGitHash", `Running on Git hash: ${this.gitHash}`);
            return true;
        } else {
            log(LOGLEVEL.WARNING, "config.getGitHash", "Could not fetch git hash");
            return false;
        }
    }

    async getGitBranch() {
        let ret;
        try {
            ret = await execSimple("git", ["rev-parse", "--abbrev-ref", "HEAD"], "git branch check");
        } catch (error) {
            log(LOGLEVEL.WARNING, "config.getGitBranch", "Could not fetch git branch");
            return false;
        }
        if (ret && ret.stdout) {
            this.gitBranch = ret.stdout.join("").trim();
            log(LOGLEVEL.SUCCESS, "config.getGitBranch", `Running on Git branch: ${this.gitBranch}`);
            return true;
        } else {
            log(LOGLEVEL.WARNING, "config.getGitBranch", "Could not fetch git branch");
            return false;
        }
    }

    static debugLocalUrl() {
        if (Helper.is_docker()) {
            return "localhost:8082";
        }
        return "localhost:8080";
    }

    get dateFormat() {
        return this.cfg("date_format", "yyyy-MM-dd"); // if you're crazy enough to not use ISO8601
    }

    hasEnvVar(key: keyof typeof settingsFields): boolean
    {
        const val = process.env[`TCD_${key.toUpperCase().replaceAll(".", "_")}`];

        if (val === undefined) return false;
        if (val === "") return false;

        return true;
    }

    envVarValue(key: keyof typeof settingsFields): string | undefined
    {
        return process.env[`TCD_${key.toUpperCase().replaceAll(".", "_")}`];
    }

}