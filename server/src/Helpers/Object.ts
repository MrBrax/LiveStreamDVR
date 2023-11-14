import type { ZodRawShape } from "zod";
import { z } from "zod";

/**
 * Parses a JSON string and returns an instance of the specified class type.
 * @param json - The JSON string to parse.
 * @param classType - The class type to create an instance of.
 * @returns An instance of the specified class type.
 */
export function parseJSON<T extends ZodRawShape>(
    json: string,
    classType: T
): T {
    const obj = JSON.parse(json);

    // Validate the object against the class type's schema.
    const schema = z.object(classType);
    schema.parse(obj);

    Object.assign(classType, obj);
    return classType;
}
