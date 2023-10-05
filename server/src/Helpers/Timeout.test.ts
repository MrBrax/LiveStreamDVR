import { xClearInterval, xClearTimeout, xInterval, xTimeout } from "./Timeout";

describe("Timeout", () => {
    test("xTimeout should call the callback after the specified time", (done) => {
        const start = Date.now();
        xTimeout(() => {
            const end = Date.now();
            expect(end - start).toBeGreaterThanOrEqual(1000);
            done();
        }, 1000);
    });

    test("xInterval should call the callback repeatedly after the specified time", (done) => {
        let count = 0;
        const interval = xInterval(() => {
            count++;
            if (count === 3) {
                xClearInterval(interval);
                expect(count).toBe(3);
                done();
            }
        }, 1000);
    });

    test("xClearTimeout should clear the specified timeout", (done) => {
        const timeout = xTimeout(() => {
            done.fail("Timeout was not cleared");
        }, 1000);
        xClearTimeout(timeout);
        setTimeout(() => {
            done();
        }, 2000);
    });

    test("xClearInterval should clear the specified interval", (done) => {
        let count = 0;
        const interval = xInterval(() => {
            count++;
            if (count === 3) {
                xClearInterval(interval);
                setTimeout(() => {
                    expect(count).toBe(3);
                    done();
                }, 1000);
            }
        }, 500);
    });
});
