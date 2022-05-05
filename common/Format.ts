// https://stackoverflow.com/questions/7975005/format-a-javascript-string-using-placeholders-and-an-object-of-substitutions
export function formatString(string: string, replacements: Record<string, string>): string {
    // return string.replace(/{(\d+)}/g, (match, number) => {
    //     return typeof args[number] !== "undefined" ? args[number] : match;
    // });
    return string.replace(
        /{(\w+)}/g, 
        (placeholderWithDelimiters, placeholderWithoutDelimiters) =>
            replacements[placeholderWithoutDelimiters] || placeholderWithDelimiters
    );
}