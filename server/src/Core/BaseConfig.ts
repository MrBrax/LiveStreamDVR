import path from "path";
import fs from "fs";
import minimist from "minimist";

const argv = minimist(process.argv.slice(2));

/**
 * Instead of using relative paths in every file, these paths are always
 * pointing to the correct location. This is of course dependent on where
 * the index.ts/js file is located. That's the bad hack here, but it works. * 
 */

// export const AppRoot = path.join(__dirname, "..", "..", "..");
export const AppName = "TwitchAutomatorTS";

/**
 * The root directory of the application containing client-vue, public, etc.
 */
export const AppRoot = process.env.NODE_ENV === "development" ? path.join(__dirname, "..", "..", "..") : path.join(__dirname, "..", "..");
console.log(`AppRoot: ${AppRoot}`);

/**
 * The data directory of the application.
 */
export const DataRoot = 
    argv.dataroot ? path.resolve(argv.root) : path.join(AppRoot, "data");

if (!fs.existsSync(DataRoot)) {
    throw new Error(`DataRoot does not exist: ${DataRoot}`);
}

console.log(`DataRoot: ${DataRoot}`);

export const BaseConfigFolder = {
    server: path.join(AppRoot, "server"),
    // config: path.join(AppRoot, "config"),
    // cache: path.join(AppRoot, "cache"),
    // cron: path.join(AppRoot, "cache", "cron"),
    // pids: path.join(AppRoot, "cache", "pids"),
    // playlist: path.join(AppRoot, "cache", "playlist"),
    // keyvalue: path.join(AppRoot, "cache", "kv"),
    // history: path.join(AppRoot, "cache", "history"),
    // dotnet: path.join(AppRoot, "dotnet"),
    // logs: path.join(AppRoot, "logs"),
    // logs_software: path.join(AppRoot, "logs", "software"),
    // payloads: path.join(AppRoot, "payloads"),
    public: path.join(AppRoot, "public"),

    client: path.join(AppRoot, "client-vue", "dist"),
    // vod: path.join(AppRoot, "storage", "vods"),
    // saved_vods: path.join(AppRoot, "storage", "saved_vods"),
    // saved_clips: path.join(AppRoot, "storage", "saved_clips"),
    vodplayer: path.join(AppRoot, "vodplayer"),
};

export const BaseConfigDataFolder = {
    config: path.join(DataRoot, "config"),
    cache: path.join(DataRoot, "cache"),
    cron: path.join(DataRoot, "cache", "cron"),
    pids: path.join(DataRoot, "cache", "pids"),
    playlist: path.join(DataRoot, "cache", "playlist"),
    keyvalue: path.join(DataRoot, "cache", "kv"),
    history: path.join(DataRoot, "cache", "history"),
    dotnet: path.join(DataRoot, "cache", "dotnet"),
    logs: path.join(DataRoot, "logs"),
    logs_software: path.join(DataRoot, "logs", "software"),
    payloads: path.join(DataRoot, "payloads"),
    vod: path.join(DataRoot, "storage", "vods"),
    saved_vods: path.join(DataRoot, "storage", "saved_vods"),
    saved_clips: path.join(DataRoot, "storage", "saved_clips"),
};

export const BaseConfigPath = {
    config: path.join(BaseConfigDataFolder.config, "config.json"),
    channel: path.join(BaseConfigDataFolder.config, "channels.json"),
    favouriteGames: path.join(BaseConfigDataFolder.config, "favourite_games.json"),
    gameDb: path.join(BaseConfigDataFolder.cache, "games_v2.json"),
    history: path.join(BaseConfigDataFolder.cache, "history.json"),
    streamerCache: path.join(BaseConfigDataFolder.cache, "streamers_v2.json"),
    keyvalue: path.join(BaseConfigDataFolder.keyvalue, "kv.json"),
    notifications: path.join(BaseConfigDataFolder.config, "notifications.json"),
};