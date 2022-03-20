export function Sleep(ms: number): Promise<void> {
    console.debug(`Sleeping for ${ms}ms`);
    return new Promise(resolve => setTimeout(resolve, ms));
}