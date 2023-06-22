import { Scheduler } from "../src/Core/Scheduler";
import { Config } from "../src/Core/Config";
import * as CronController from "../src/Controllers/Cron";

// mock CronController.fCheckMutedVods() to check if it was called
jest.mock("../src/Controllers/Cron", () => {
    return {
        fCheckMutedVods: jest.fn(),
    };
});

describe("Scheduler", () => {

    Scheduler.defaultJobs();
    it("should run the function inside the schedule if the config is set to true", () => {
        const config = Config.getInstance();
        config.config = {};
        config.setConfig("schedule_muted_vods", false);

        Scheduler.runJob("check_muted_vods");
        expect(CronController.fCheckMutedVods).not.toHaveBeenCalled();

        config.setConfig("schedule_muted_vods", true);
        Scheduler.runJob("check_muted_vods");
        expect(CronController.fCheckMutedVods).toHaveBeenCalled();

        config.setConfig("schedule_muted_vods", false);
        Scheduler.runJob("check_muted_vods");
        expect(CronController.fCheckMutedVods).toHaveBeenCalledTimes(1);
    });

});

afterAll(() => {
    jest.unmock("../src/Controllers/Cron");
    Scheduler.removeAllJobs();
});