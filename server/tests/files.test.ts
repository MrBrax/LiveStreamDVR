import { DataRoot } from "../src/Core/BaseConfig";
import path from "path";
import { validatePath } from "../src/Controllers/Files";
describe("files controller", () => {
    it("should sanitize path", () => {
        expect(validatePath("C:\\")).not.toBe(true);
        expect(validatePath("C:\\storage")).not.toBe(true);
        expect(validatePath("/")).not.toBe(true);
        expect(validatePath("/storage")).not.toBe(true);
        expect(validatePath(path.join(DataRoot, ".."))).not.toBe(true);
        expect(validatePath(path.join(DataRoot, "\u0000"))).not.toBe(true);
        expect(validatePath(path.join(DataRoot, "CON1"))).not.toBe(true);
        expect(validatePath(path.join(DataRoot, "cache"))).not.toBe(true);
        expect(validatePath(path.join(DataRoot, "logs"))).toBe(true);
        expect(validatePath(path.join(DataRoot, "storage", "saved_vods"))).toBe(true);
    });
});