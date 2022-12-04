import { Config } from "../src/Core/Config";
import { Log } from "../src/Core/Log";
import "./environment";

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

    it("config value set", () => {
        const config = Config.getCleanInstance();
        config.config = {};
        config.setConfig("app_url", "https://example.com");
        expect(config.cfg("app_url")).toBe("https://example.com");
        expect(config.cfg("app_url1")).toBeUndefined();

        // automatic type casting
        config.setConfig("trust_proxy", "1");
        expect(config.cfg("trust_proxy")).toBe(true);
        config.setConfig("trust_proxy", "0");
        expect(config.cfg("trust_proxy")).toBe(false);
        config.setConfig("server_port", "1234");
        expect(config.cfg("server_port")).toBe(1234);
    });

    it("config value set with default", () => {
        const config = Config.getCleanInstance();
        config.config = {};
        expect(config.cfg("app_url", "https://example.com")).toBe("https://example.com");
        expect(config.cfg("app_url", "")).toBe("");
        expect(config.cfg("app_url")).toBeUndefined();

        expect(config.cfg("file_permissions")).toBe(false);
        expect(config.cfg("file_permissions", true)).toBe(true);

        expect(config.cfg("low_latency")).toBe(undefined);
        expect(config.cfg("low_latency", true)).toBe(true);
        expect(config.cfg("low_latency", false)).toBe(false);
    });

    it("generate config", () => {
        const config = Config.getCleanInstance();

        // const spy = jest.spyOn(config, "saveConfig").mockImplementation((source) => { console.log("save config", source); return true; });

        config.generateConfig();
        expect(config.saveConfig).toHaveBeenCalled();

        expect(config.cfg("server_port")).toBe(8080);
        expect(config.cfg("trust_proxy")).toBe(false);
        expect(config.cfg("channel_folders")).toBe(true);

        // spy.mockRestore();
    });

    it("empty values", () => {
        const config = Config.getCleanInstance();
        config.config = {};
        expect(config.cfg("password")).toBe(undefined);
        expect(config.cfg("password", "")).toBe("");
        config.setConfig("password", "test");
        expect(config.cfg("password")).toBe("test");
        config.setConfig("password", "");
        expect(config.cfg("password")).toBe(undefined);
        expect(config.cfg("password", "")).toBe("");
    });

    it("hasValue", () => {
        const config = Config.getCleanInstance();
        config.config = {};
        expect(config.hasValue("password")).toBe(false);
        config.setConfig("password", "test");
        expect(config.hasValue("password")).toBe(true);
        config.setConfig("password", "");
        expect(config.hasValue("password")).toBe(false);
    });

    it("setting exists", () => {
        expect(Config.settingExists("app_url")).toBe(true);
        expect(Config.settingExists("app_url1")).toBe(false);
        expect(Config.getSettingField("app_url")).toHaveProperty("text");
        expect(Config.getSettingField("app_url1")).toBeUndefined();
    });

});