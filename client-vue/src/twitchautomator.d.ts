export type PHPDateTimeJSON = {
    date: string;
    timezone_type: number;
    timezone: string;
};

export type ApiVod = {
    basename: string;

    dt_started_at: PHPDateTimeJSON;
    dt_ended_at: PHPDateTimeJSON;
};

export type ApiStreamer = {
  username: string;
  quality: string[];
  vods_list: ApiVod[];
  vods_size: number;
  expires_at: PHPDateTimeJSON;
};

export const phpDateFormat = "yyyy-MM-dd HH:mm:ss.SSSSSS"; // 2020-11-03 02:48:01.000000