import { ApiGame } from "@common/Api/Client";
import { useStore } from "../store";

export class TwitchGame {
    public id!: string;
    public name!: string;
    public box_art_url!: string;
    public added!: Date;

    public static makeFromApiResponse(apiResponse: ApiGame): TwitchGame {
        const game = new TwitchGame();
        game.id = apiResponse.id;
        game.name = apiResponse.name;
        game.box_art_url = apiResponse.box_art_url;
        game.added = new Date(apiResponse.added);
        console.log(game);
        return game;
    }

    public isFavourite() {
        const store = useStore();
        return store.favourite_games.includes(this.id);
    }

    public getBoxArtUrl(width = 140, height = 190): string {
        if (!this.box_art_url) {
            return "";
        }
        return this.box_art_url.replace("{width}", width.toString()).replace("{height}", height.toString()); // does {width} have a % next to it?
    }
}
