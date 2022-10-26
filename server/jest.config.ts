import type { Config } from "jest";
// Sync object
const config: Config = {
    verbose: true,
    transform: {
        "^.+\\.tsx?$": "ts-jest",
    },
};
export default config;