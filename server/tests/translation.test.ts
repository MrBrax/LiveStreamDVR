import { t } from "i18next";
import i18n from "../src/Helpers/i18n";
import { assert } from "console";

describe("Translation", () => {
    // console.log("i18n: ", i18n);
    assert(i18n);
    it("should return the correct translation", () => {
        expect(t("test")).toBe("Hello World");
        expect(t("notify.channel-displayname-is-now-streaming-current_chapter-game_name", ["TestChannel", "TestGame"])).toBe("TestChannel is now streaming TestGame!");
    });

    it("should use the correct interpolation syntax", () => {
        expect(t("{{0}} is now streaming {{1}}!", ["TestChannel", "TestGame"])).toBe("TestChannel is now streaming TestGame!");
        expect(t("{0} is now streaming {1}!", ["TestChannel", "TestGame"])).toBe("{0} is now streaming {1}!");
    });
});