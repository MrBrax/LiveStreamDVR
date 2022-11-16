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
        [key: string]: BinaryStatus;
    };
    pip: Record<string, { comparator: string; version: string; }>;
}

export interface BinaryStatus {
    path?: string;
    status?: string;
    version?: string;
    min_version?: string;
}