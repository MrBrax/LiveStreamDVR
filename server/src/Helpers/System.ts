export function is_windows() {
    return process.platform === "win32";
}

export function is_docker() {
    return process.env.TCD_DOCKER !== undefined;
}

export function executable_name(basename: string): string {
    return basename + (is_windows() ? ".exe" : "");
}
