export class TwitchVODSegment {
	filename: string | undefined;
	basename: string | undefined;
	strings: Record<string, string> = {};
	filesize: number | undefined;
}