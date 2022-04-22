import { Config } from "../src/Core/Config";

describe("Config", () => {

    it("external url validation", () => {
        expect(() => Config.validateExternalURLRules("http://example.com")).toThrow();
        expect(() => Config.validateExternalURLRules("http://example.com:1234")).toThrow();
        expect(() => Config.validateExternalURLRules("http://example.com:80")).toThrow();
        expect(Config.validateExternalURLRules("https://example.com:443")).toBe(true);
        expect(Config.validateExternalURLRules("https://example.com")).toBe(true);
        expect(Config.validateExternalURLRules("https://sub.example.com")).toBe(true);
        expect(() => Config.validateExternalURLRules("https://sub.example.com/folder/")).toThrow();
        expect(Config.validateExternalURLRules("https://sub.example.com/folder")).toBe(true);
    });

});