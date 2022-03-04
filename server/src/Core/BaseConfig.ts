import path from "path";

export const AppRoot = path.join(__dirname, "..", "..", "..");

export const BaseConfigFolder = {
	config: path.join(AppRoot, "config"),
	public: path.join(AppRoot, "public"),
	logs: path.join(AppRoot, "logs"),
	cache: path.join(AppRoot, "cache"),
	cron: path.join(AppRoot, "cache", "cron"),
	pids: path.join(AppRoot, "cache", "pids"),
	vod: path.join(AppRoot, "public", "vods"),
	keyvalue: path.join(AppRoot, "cache", "kv"),
};

export const BaseConfigPath = {
	config: path.join(BaseConfigFolder.config, "config.json"),
	channel: path.join(BaseConfigFolder.config, "channels.json"),
	favouriteGames: path.join(BaseConfigFolder.config, "favourite_games.json"),
	gameDb: path.join(BaseConfigFolder.cache, "games_v2.json"),
	history: path.join(BaseConfigFolder.cache, "history.json"),
	streamerCache: path.join(BaseConfigFolder.cache, "streamers_v2.json"),
};