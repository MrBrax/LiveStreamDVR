// hackjob from https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/ffprobe/index.d.ts

type FFProbeBoolean = '0' | '1';

type CodecType = 'video' | 'audio' | 'images' | 'subtitle' | 'data';

interface Disposition {
    default: number;
    dub: number;
    original: number;
    comment: number;
    lyrics: number;
    karaoke: number;
    forced: number;
    hearing_impaired: number;
    visual_impaired: number;
    clean_effects: number;
    attached_pic: number;
    timed_thumbnails: number;
    captions: number;
    descriptions: number;
    metadata: number;
    dependent: number;
    still_image: number;
}

interface Stream {
    codec_type: CodecType;
    id: string;
    index: number;
    codec_name: string;
    codec_long_name: string;
    profile: string;
    // codec_type: 'video' | 'audio' | 'images';
    codec_time_base: string;
    codec_tag_string: string;
    codec_tag: string;
    extradata?: string;
    disposition: Disposition;
}

export interface VideoStream extends Stream {
    codec_type: "video";
    width: number;
    height: number;
    coded_width: number;
    coded_height: number;
    closed_captions: FFProbeBoolean;
    has_b_frames: number;
    sample_aspect_ratio: string;
    display_aspect_ratio: string;
    pix_fmt: string;
    level: number;
    chroma_location: string;
    // color_range: string;
    // color_space: string;
    // color_transfer: string;
    // color_primaries: string;
    field_order: string;
    refs: number;
    is_avc: string;
    nal_length_size: string;
    r_frame_rate: string;
    avg_frame_rate: string;
    time_base: string;
    start_pts: number;
    start_time: string;
    duration_ts: number;
    duration: string;
    bit_rate: string;
    bits_per_raw_sample: string;
    nb_frames: number;
    extradata_size: number;
    tags: {
        language: string;
        handler_name: string;
        vendor_id: string;
    };
}

export interface AudioStream extends Stream {
    codec_type: "audio";
    sample_fmt: string;
    sample_rate: number;
    channels: number;
    channel_layout: string;
    bits_per_sample: number;
    start_time: string;
    start_pts: number;
    bit_rate: string;
}

interface Format {
    filename: string;
    nb_streams: number;
    nb_programs: number;
    format_name: string;
    format_long_name: string;
    start_time: string;
    duration: string;
    size: string;
    bit_rate: string;
    probe_score: number;
    tags: FormatTags;
}

interface FormatTags {
    major_brand: string;
    minor_version: string;
    compatible_brands: string;
    encoder: string;
}

export type FFProbeStream = VideoStream | AudioStream;

export interface FFProbe {
    streams: FFProbeStream[];
    format: Format;
}

