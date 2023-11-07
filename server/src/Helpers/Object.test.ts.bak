import { parseJSON } from "./Object";

class TestClass {
    public foo = "";
    public bar = 0;
}

describe("parseJSON", () => {
    it("should parse JSON into an instance of a class", () => {
        const json = '{"foo": "hello", "bar": 42}';
        const instance = parseJSON(json, TestClass);

        expect(instance).toBeInstanceOf(TestClass);
        expect(instance.foo).toBe("hello");
        expect(instance.bar).toBe(42);
    });

    it("should throw an error if the JSON is invalid", () => {
        const json = '{"foo": "hello", "bar": "world"}';

        expect(() => {
            parseJSON(json, TestClass);
        }).toThrow();
    });
});
