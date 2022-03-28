// ReplaceAll polyfill
export function replaceAll(str: string, find: string | RegExp, replace: string): string {
    if (typeof find === "string") {
        return str.replace(new RegExp(find, "g"), replace);
    } else {
        return str.replace(find, replace); // is this correct?
    }
}