import { Config } from "../src/Core/Config";
import { BaseAutomator } from "../src/Core/Providers/Base/BaseAutomator";
import { KeyValue } from "../src/Core/KeyValue";
import { TwitchChannel } from "../src/Core/Providers/Twitch/TwitchChannel";

// jest.mock("Automator");
// jest.mock("KeyValue");

beforeAll(async () => {
    await Config.init();
});
describe("Automator", () => {
    it("automator templating", () => {
        const TA = new BaseAutomator();
        TA.broadcaster_user_login = "test";
        const channel = new TwitchChannel();
        channel.channel_data = {
            login: "test",
            _updated: 1,
            cache_offline_image: "",
            profile_image_url: "",
            offline_image_url: "",
            created_at: "",
            id: "test",
            cache_avatar: "",
            broadcaster_type: "partner",
            display_name: "Test",
            type: "",
            description: "",
            view_count: 0,
        };
        TA.channel = channel;

        const kv = KeyValue.getInstance();
        const spy = jest.spyOn(kv, "get").mockImplementation((key) => {
            return "2022-09-02T16:10:37Z";
        });

        expect(TA.getStartDate()).toBe("2022-09-02T16:10:37Z");

        Config.getInstance().setConfig(
            "filename_vod",
            "{login}_{year}_{month}_{day}"
        );
        expect(TA.vodBasenameTemplate()).toBe("test_2022_09_02");

        spy.mockImplementation((key) => {
            return "";
        });

        expect(TA.vodBasenameTemplate()).toBe("test_{year}_{month}_{day}");
    });
});
