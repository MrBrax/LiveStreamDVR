import { expect, test } from "vitest";
import type { ApiTwitchVod } from "@common/Api/Client";
import TwitchVOD from "./TwitchVOD";
import { TwitchVODChapter } from "./TwitchVODChapter";
import { MockApiVODData } from "../../../../test/mockdata";
import BaseVOD from "../Base/BaseVOD";

test("makeFromApiResponse", () => {

    const basevod = BaseVOD.makeFromApiResponse(MockApiVODData);
    expect(basevod.provider).toBe("base");

    const vod = TwitchVOD.makeFromApiResponse(MockApiVODData);
    expect(vod.provider).toBe("twitch");
});