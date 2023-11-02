export interface WinstonLogLine {
    message: string;
    level: string;
    module: string;
    timestamp: string;
    metadata?: {
        [key: string]: any;
        module: string;
        timestamp: string;
    };
}
