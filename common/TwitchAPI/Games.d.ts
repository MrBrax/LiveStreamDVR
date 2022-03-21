import { Pagination } from "./Shared";

export interface Game {
    box_art_url: string;
    id: string;
    name: string;
}

export interface Games {
    data: Game[];
    pagination: Pagination;
}