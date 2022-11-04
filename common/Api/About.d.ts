export interface SoftwareCallback {
    path: string;
    status: string;
    update: string;
    version: string;

    user?: string;
    pid?: number;
    uid?: number;
    gid?: number;
    sapi: string;
    platform?: string;
    platform_family?: string;
    display_errors?: string;
    error_reporting?: string;
}

export interface AboutData {
    is_docker: boolean;
    bins: {
        ffmpeg: SoftwareCallback;
        mediainfo: SoftwareCallback;
        tcd: SoftwareCallback;
        streamlink: SoftwareCallback;
        youtubedl: SoftwareCallback;
        pipenv: SoftwareCallback;
        python: SoftwareCallback;
        python3: SoftwareCallback;
        twitchdownloader: SoftwareCallback;
        php: SoftwareCallback;
        node: SoftwareCallback;
    };
    pip: Record<string, { comparator: string; version: string; }>;
}