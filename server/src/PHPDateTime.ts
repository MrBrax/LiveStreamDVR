export class PHPDateTime extends Date {
    date: string | undefined;
    timezone_type: number | undefined;
    timezone: string | undefined;
    constructor(date: any) {
        super(date);
    }
}