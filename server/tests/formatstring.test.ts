import { formatString } from "../../common/Format";

describe("formatString", () => {

    it("should format correctly", () => {

        const variables = {
            test: "1234",
        };

        expect(formatString("{test}", variables)).toBe("1234");
        expect(formatString("{test asdf}", variables)).toBe("{test asdf}");
        expect(formatString("{asdf}", variables)).toBe("{asdf}");
        expect(formatString("{{test}}", variables)).toBe("{1234}");

        expect(formatString("{test}", variables, true)).toBe("1234");
        expect(formatString("{asdf}", variables, true)).toBe("");

    });

});