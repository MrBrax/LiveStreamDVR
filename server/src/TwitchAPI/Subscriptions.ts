import { Pagination, Subscription } from "./Shared";

export interface Subscriptions {
    data: Subscription[];
    total: number;
    total_cost: number;
    max_total_cost: number;
    pagination: Pagination;
}