export class PHPDateTime extends Date {
    date: string | undefined;
    timezone_type: number | undefined;
    timezone: string | undefined;
    constructor(date: any) {
        super(date);
    }
}

export type PHPDateTimeJSON = {
    date: string;
    timezone_type: number;
    timezone: string;
};