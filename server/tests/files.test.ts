import { DataRoot } from "../src/Core/BaseConfig";
import path from "node:path";
import { validatePath } from "../src/Controllers/Files";
import { Config } from "../src/Core/Config";
// import fs from "node:fs";
import "./environment";

// let fsSpy: jest.SpyInstance;
// beforeEach(() => {
//     fsSpy = jest.spyOn(fs, "existsSync").mockImplementation(() => { return true; });
// });
//
// afterEach(() => {
//     fsSpy.mockRestore();
// });

describe("files controller", () => {
    it("should sanitize path", () => {
        Config.createFolders();
        expect(validatePath("C:\\")).not.toBe(true);
        expect(validatePath("C:\\storage")).not.toBe(true);
        expect(validatePath("/")).not.toBe(true);
        expect(validatePath("/storage")).not.toBe(true);
        expect(validatePath(path.join(DataRoot, ".."))).not.toBe(true);
        expect(validatePath(path.join(DataRoot, "\u0000"))).not.toBe(true);
        expect(validatePath(path.join(DataRoot, "CON1"))).not.toBe(true);
        expect(validatePath(path.join(DataRoot, "cache"))).not.toBe(true);
        // expect(validatePath(path.join(DataRoot, "logs"))).toBe(true);
        // expect(validatePath(path.join(DataRoot, "storage", "saved_vods"))).toBe(true);
        // can't spy on fs without breaking pnp and other stuff
    });
});