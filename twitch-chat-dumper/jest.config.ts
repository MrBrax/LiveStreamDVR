// import type { Config } from "jest";
import type { JestConfigWithTsJest } from 'ts-jest';

// Sync object
const config: JestConfigWithTsJest = {
    verbose: true,
    transform: {
        "^.+\\.tsx?$": "ts-jest",
    }
};
export default config;