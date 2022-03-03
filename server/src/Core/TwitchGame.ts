import fs from 'fs';
import axios from 'axios';
import { LOGLEVEL, TwitchHelper } from './TwitchHelper';
import { TwitchConfig } from './TwitchConfig';

interface TwitchGameJSON {
	name: string;
	box_art_url: string;
	added: number; // 1/1000
}

export class TwitchGame {

    static game_db: Record<string, TwitchGame> = {};

    public id: string | undefined;
    public name: string | undefined;
    public box_art_url: string | undefined;
    public added: Date | undefined;

    public static populateGameDatabase() {
        TwitchHelper.logAdvanced(LOGLEVEL.INFO, "helper", "Populating game database...");
        this.game_db = {};
        const raw_games: Record<string, TwitchGameJSON> = JSON.parse(fs.readFileSync(TwitchConfig.gameDbPath, "utf8"));
        for (const id in raw_games) {
            const raw_game = raw_games[id];
            const game = new this();
            // game.id = parseInt(id);
            game.id = id;
            game.name = raw_game.name;
            game.box_art_url = raw_game.box_art_url;
            game.added = new Date( raw_game.added.toString().length <= 10 ? raw_game.added * 1000 : raw_game.added );
            this.game_db[id] = game;
        }
        TwitchHelper.logAdvanced(LOGLEVEL.INFO, "helper", `Game database populated with ${Object.keys(this.game_db).length} games.`);
    }

    public static getGameDataFromCache(game_id: string): TwitchGame | false | null {
        if (!this.game_db) {
            throw new Error("Game database not initialized!");
        }
        return this.game_db[game_id] || null;
    }

    public static async getGameDataAsync(game_id: string): Promise<TwitchGame | false | null> {

		if (!game_id) {
			TwitchHelper.logAdvanced(LOGLEVEL.ERROR, "helper", "No game id supplied for game fetch!");
			return false;
		}

        const cachedGame = this.getGameDataFromCache(game_id);

		if (cachedGame) {
			if (cachedGame && cachedGame.added && Date.now() > cachedGame.added.getTime() + (60 * 60 * 24 * 60 * 1000)) { // two months?
				TwitchHelper.logAdvanced(LOGLEVEL.INFO, "helper", `Game id ${game_id} needs refreshing.`);
			} else {
				return this.game_db[game_id];
			}
		}

		TwitchHelper.logAdvanced(LOGLEVEL.DEBUG, "helper", `Game id ${game_id} not in cache, fetching...`);

		let response;
		try {
			response = await TwitchHelper.axios.get(`/helix/games?id=${game_id}`);
		} catch (th) {
			TwitchHelper.logAdvanced(LOGLEVEL.FATAL, "helper", `Tried to get game data for ${game_id} but server returned: ${th}`);
			return false;
		}

		const json = response.data;

		const game_data = json.data[0];

		if (game_data) {
			
            /*
			const game = {
				"id": game_id,
				"name": game_data.name,
				"box_art_url": game_data.box_art_url,
				"added": Date.now(),
			} as TwitchGame;

			this.game_db[game_id] = game;
            */
            const game = new this();
            game.id = game_id;
            game.name = game_data.name;
            game.box_art_url = game_data.box_art_url;
            game.added = new Date();
            game.save();

			// $game_db[ $id ] = $game_data["name"];

			TwitchHelper.logAdvanced(LOGLEVEL.SUCCESS, "helper", `New game saved to cache: ${game.name}`);

			return game;

		} else {

			TwitchHelper.logAdvanced(LOGLEVEL.ERROR, "helper", `Invalid game returned in query for ${game_id} (${json})`);

			return null;
		}
	}

    /**
     * Get game data from cache. **Does not fetch from server.**
     * @param game_id 
     * @returns 
     */
    public static getGameDataSync(game_id: string): TwitchGame | false | null {
        if (!this.game_db) {
            throw new Error("Game database not initialized!");
        }
        return this.game_db[game_id] || null;
    }

    /**
     * Save game data to cache.
     */
    public save() {
        if (!this.id) {
            throw new Error("Cannot save game without id!");
        }
        TwitchGame.game_db[this.id] = this;

        const json_db: Record<string, TwitchGameJSON> = {};
        for (const id in TwitchGame.game_db) {
            const game = TwitchGame.game_db[id];
            const json_game: TwitchGameJSON = {
                name: game.name || "",
                box_art_url: game.box_art_url || "",
                added: game.added ? game.added.getTime() / 1000 : 0,
            };
            json_db[id] = json_game;
        }
        fs.writeFileSync(TwitchConfig.gameDbPath, JSON.stringify(json_db));
    }

    /**
     * Make box art url from dimensions.
     * 
     * @param width 
     * @param height 
     * @returns string URL
     */
    public getBoxArtUrl(width: number, height: number): string {
        if (!this.box_art_url) {
            return "";
        }
        return this.box_art_url.replace("{width}", width.toString()).replace("{height}", height.toString());
    }

}