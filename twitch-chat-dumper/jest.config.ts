import type { Config } from "@jest/types";
// Sync object
const config: Config.InitialOptions = {
    verbose: true,
    transform: {
        "^.+\\.tsx?$": "ts-jest",
    },
    transformIgnorePatterns: [
        // ignore chalk
        "node_modules/(?!chalk)",
    ],
};
export default config;