// import type { Config } from "jest";
import type { JestConfigWithTsJest } from 'ts-jest';

// Sync object
const config: JestConfigWithTsJest = {
    verbose: true,
    transform: {
        "^.+\\.tsx?$": "ts-jest",
    },
    moduleNameMapper: {
        "^@common/(.*)$": "<rootDir>/../common/$1",
        "^@/(.*)$": "<rootDir>/src/$1",
    },
};
export default config;