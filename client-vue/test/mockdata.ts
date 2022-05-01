import { ApiGame } from "@common/Api/Client";

export const GamesData: Record<string, ApiGame> = {
    "123": {
        id: "123",
        name: "Test Game 1",
        game_name: "Test Game 1",
        box_art_url: "http://example.com/image.jpg",
        favourite: false,
        image_url: "http://example.com/image.jpg",
        added: "2020-11-03 02:48:01.000000",
    },
    "456": {
        id: "456",
        name: "Test Game 2",
        game_name: "Test Game 2",
        box_art_url: "http://example.com/image.jpg",
        favourite: false,
        image_url: "http://example.com/image.jpg",
        added: "2021-11-03 02:48:01.000000",
    }
};