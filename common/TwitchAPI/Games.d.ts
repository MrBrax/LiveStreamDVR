import { Pagination } from "./Shared";

export interface Game {
    box_art_url: string;
    id: string;
    name: string;

    /** 2022-11-21 - added */
    igdb_id: number;
}

export interface GamesResponse {
    data: Game[];
    pagination: Pagination;
}