import { KeyValue } from "../src/Core/KeyValue";
import "./environment";
let spy: jest.SpyInstance | undefined;
let kv: KeyValue;
beforeAll(() => {
    kv = KeyValue.getCleanInstance();
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
        kv.set("test4", "test");
        expect(kv.save).toHaveBeenCalled();

        kv.setObject<{ test: string }>("test5", { test: "test" });
        expect(kv.save).toHaveBeenCalled();

        kv.setBool("test6", true);
        expect(kv.save).toHaveBeenCalled();

        kv.delete("test4");
        expect(kv.save).toHaveBeenCalled();

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