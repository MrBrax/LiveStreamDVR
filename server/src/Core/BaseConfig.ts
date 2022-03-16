import path from "path";

// export const AppRoot = path.join(__dirname, "..", "..", "..");
export const AppName = "TwitchAutomatorTS";

/**
 * The root directory of the application containing client-vue, public, etc.
 */
export const AppRoot = process.env.NODE_ENV === "development" ? path.join(__dirname, "..", "..", "..") : path.join(__dirname, "..", "..", "..", "..");

export const BaseConfigFolder = {
    config: path.join(AppRoot, "config"),
    cache: path.join(AppRoot, "cache"),
    cron: path.join(AppRoot, "cache", "cron"),
    pids: path.join(AppRoot, "cache", "pids"),
    playlist: path.join(AppRoot, "cache", "playlist"),
    // channel_cache: path.join(AppRoot, "cache", "channel"),
    // channel_cache_avatar: path.join(AppRoot, "cache", "channel", "avatar"),
    // channel_cache_background: path.join(AppRoot, "cache", "channel", "background"),
    keyvalue: path.join(AppRoot, "cache", "kv"),
    history: path.join(AppRoot, "cache", "history"),
    dotnet: path.join(AppRoot, "dotnet"),
    logs: path.join(AppRoot, "logs"),
    logs_software: path.join(AppRoot, "logs", "software"),
    payloads: path.join(AppRoot, "payloads"),
    public: path.join(AppRoot, "public"),

    client: path.join(AppRoot, "client-vue", "dist"),
    // vod: path.join(AppRoot, "public", "vods"),
    vod: path.join(AppRoot, "storage", "vods"),
    saved_vods: path.join(AppRoot, "storage", "saved_vods"),
    saved_clips: path.join(AppRoot, "storage", "saved_clips"),
    vodplayer: path.join(AppRoot, "vodplayer"),
};

export const BaseConfigPath = {
    config: path.join(BaseConfigFolder.config, "config.json"),
    channel: path.join(BaseConfigFolder.config, "channels.json"),
    favouriteGames: path.join(BaseConfigFolder.config, "favourite_games.json"),
    gameDb: path.join(BaseConfigFolder.cache, "games_v2.json"),
    history: path.join(BaseConfigFolder.cache, "history.json"),
    streamerCache: path.join(BaseConfigFolder.cache, "streamers_v2.json"),
    keyvalue: path.join(BaseConfigFolder.keyvalue, "kv.json"),
};