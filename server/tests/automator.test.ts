import { Config } from "../src/Core/Config";
import { Automator } from "../src/Core/Automator";
import { KeyValue } from "../src/Core/KeyValue";

// jest.mock("Automator");
// jest.mock("KeyValue");

beforeAll(async () => {
    await Config.init();
});
describe("Automator", () => {

    it("automator templating", () => {

        const TA = new Automator();
        TA.broadcaster_user_login = "test";

        const kv = KeyValue.getInstance();
        const spy = jest.spyOn(kv, "get").mockImplementation((key) => { return "2022-09-02T16:10:37Z"; });

        expect(TA.getStartDate()).toBe("2022-09-02T16:10:37Z");

        Config.getInstance().setConfig("filename_vod", "{login}_{year}_{month}_{day}");
        expect(TA.vodBasenameTemplate()).toBe("test_2022_09_02");

        spy.mockImplementation((key) => { return ""; });

        expect(TA.vodBasenameTemplate()).toBe("test_{year}_{month}_{day}");

    });

});