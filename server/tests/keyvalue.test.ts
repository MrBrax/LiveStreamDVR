import { KeyValue } from "../src/Core/KeyValue";

let spy: jest.SpyInstance | undefined;
let kv: KeyValue;
beforeAll(() => {
    kv = KeyValue.getCleanInstance();
    spy = jest.spyOn(kv, "save").mockImplementation(() => { console.debug("save kv"); });
});

afterAll(() => {
    spy?.mockRestore();
});

describe("keyvalue", () => {

    it("should return false if key does not exist", () => {
        expect(kv.has("test")).toBe(false);
    });

    it("should store a value", () => {
        kv.set("test1", "test");
        expect(kv.has("test1")).toBe(true);
        expect(kv.get("test1")).toBe("test");
    });

    it("should remove a value", () => {
        kv.delete("test1");
        expect(kv.has("test1")).toBe(false);
    });

    it("should serialize and deserialize objects", () => {
        kv.setObject<{ test: string }>("test2", { test: "test" });
        expect(kv.getObject<{ test: string }>("test2")).toEqual({ test: "test" });
    });

    it("should serialize booleans", () => {
        kv.setBool("test3", true);
        expect(kv.getBool("test3")).toBe(true);
    });

    it("should save the data", () => {
        spy?.mockClear();
        kv.set("test4", "test");
        expect(spy).toHaveBeenCalled();
        spy?.mockClear();

        kv.setObject<{ test: string }>("test5", { test: "test" });
        expect(spy).toHaveBeenCalled();
        spy?.mockClear();

        kv.setBool("test6", true);
        expect(spy).toHaveBeenCalled();
        spy?.mockClear();

        kv.delete("test4");
        expect(spy).toHaveBeenCalled();
        spy?.mockClear();

    });

    it("should delete all data", () => {
        kv.deleteAll();
        expect(kv.has("test1")).toBe(false);
        expect(kv.has("test2")).toBe(false);
        expect(kv.has("test3")).toBe(false);
        expect(kv.has("test4")).toBe(false);
        expect(kv.has("test5")).toBe(false);
        expect(kv.has("test6")).toBe(false);
    });

});