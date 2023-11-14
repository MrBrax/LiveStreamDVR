// https://stackoverflow.com/questions/7975005/format-a-javascript-string-using-placeholders-and-an-object-of-substitutions
/**
 * Replaces placeholders in a string with corresponding values from a replacements object.
 * @param string - The string containing placeholders to replace.
 * @param replacements - An object containing key-value pairs where the key is the placeholder and the value is the replacement.
 * @param hideEmpty - If true, empty placeholders will be replaced with an empty string. Otherwise, they will be left as is.
 * @returns The string with placeholders replaced with corresponding values from the replacements object.
 */
export function formatString(
    string: string,
    replacements: Record<string, string>,
    hideEmpty = false
): string {
    return string.replace(
        /{(\w+)}/g,
        (placeholderWithDelimiters, placeholderWithoutDelimiters) =>
            hideEmpty
                ? replacements[placeholderWithoutDelimiters] !== undefined
                    ? replacements[placeholderWithoutDelimiters]
                    : ""
                : replacements[placeholderWithoutDelimiters] ||
                  placeholderWithDelimiters
    );
}
