/**
 * @todo: rename this file
 */

/*
interface General {
    "@type": "General";
    Count: string;
    StreamCount: string;
    StreamKind: string;
    StreamKind_String: string;
    StreamKindID: string;
    VideoCount: string;
    AudioCount: string;
    Video_Format_List: string;
    Video_Format_WithHint_List: string;
    Video_Codec_List: string;
    Audio_Format_List: string;
    Audio_Format_WithHint_List: string;
    Audio_Codec_List: string;
    CompleteName: string;
    FolderName: string;
    FileNameExtension: string;
    FileName: string;
    FileExtension: string;
    Format: string;
    Format_String: string;
    Format_Extensions: string;
    Format_Commercial: string;
    Format_Profile: string;
    InternetMediaType: string;
    CodecID: string;
    CodecID_String: string;
    CodecID_Url: string;
    CodecID_Compatible: string;
    FileSize: string;
    FileSize_String: string;
    FileSize_String1: string;
    FileSize_String2: string;
    FileSize_String3: string;
    FileSize_String4: string;
    Duration: string;
    Duration_String: string;
    Duration_String1: string;
    Duration_String2: string;
    Duration_String3: string;
    Duration_String4: string;
    Duration_String5: string;
    OverallBitRate_Mode: string;
    OverallBitRate_Mode_String: string;
    OverallBitRate: string;
    OverallBitRate_String: string;
    FrameRate: string;
    FrameRate_String: string;
    FrameCount: string;
    StreamSize: string;
    StreamSize_String: string;
    StreamSize_String1: string;
    StreamSize_String2: string;
    StreamSize_String3: string;
    StreamSize_String4: string;
    StreamSize_String5: string;
    StreamSize_Proportion: string;
    HeaderSize: string;
    DataSize: string;
    FooterSize: string;
    IsStreamable: string;
    File_Modified_Date: string;
    File_Modified_Date_Local: string;
    Encoded_Application: string;
    Encoded_Application_String: string;
}

interface Extra {
    Source_Delay?: string;
    Source_Delay_Source?: string;
    mdhd_Duration?: string;
    CodecConfigurationBox?: string;
}

interface Video {
    "@type": "Video";
    Count: string;
    StreamCount: string;
    StreamKind: string;
    StreamKind_String: string;
    StreamKindID: string;
    StreamOrder: string;
    ID: string;
    ID_String: string;
    Format: string;
    Format_String: string;
    Format_Info: string;
    Format_Url: string;
    Format_Commercial: string;
    Format_Profile: string;
    Format_Level: string;
    Format_Settings: string;
    Format_Settings_CABAC: string;
    Format_Settings_CABAC_String: string;
    Format_Settings_RefFrames: string;
    Format_Settings_RefFrames_String: string;
    Format_Settings_GOP: string;
    InternetMediaType: string;
    CodecID: string;
    CodecID_Info: string;
    Duration: string;
    Duration_String: string;
    Duration_String1: string;
    Duration_String2: string;
    Duration_String3: string;
    Duration_String4: string;
    Duration_String5: string;
    Source_Duration?: string;
    Source_Duration_String?: string;
    Source_Duration_String1?: string;
    Source_Duration_String2?: string;
    Source_Duration_String3?: string;
    BitRate_Mode: string;
    BitRate_Mode_String: string;
    BitRate: string;
    BitRate_String: string;
    BitRate_Nominal: string;
    BitRate_Nominal_String: string;
    Width: string;
    Width_String: string;
    Height: string;
    Height_String: string;
    Stored_Height: string;
    Sampled_Width: string;
    Sampled_Height: string;
    PixelAspectRatio: string;
    DisplayAspectRatio: string;
    DisplayAspectRatio_String: string;
    Rotation: string;
    FrameRate_Mode: string;
    FrameRate_Mode_String: string;
    FrameRate: string;
    FrameRate_String: string;
    FrameRate_Minimum: string;
    FrameRate_Minimum_String: string;
    FrameRate_Maximum: string;
    FrameRate_Maximum_String: string;
    FrameRate_Original: string;
    FrameRate_Original_String: string;
    FrameCount: string;
    Source_FrameCount: string;
    ColorSpace: string;
    ChromaSubsampling: string;
    ChromaSubsampling_String: string;
    BitDepth: string;
    BitDepth_String: string;
    ScanType: string;
    ScanType_String: string;
    BitsPixel_Frame: string;
    StreamSize: string;
    StreamSize_String: string;
    StreamSize_String1: string;
    StreamSize_String2: string;
    StreamSize_String3: string;
    StreamSize_String4: string;
    StreamSize_String5: string;
    StreamSize_Proportion: string;
    Source_StreamSize: string;
    Source_StreamSize_String: string;
    Source_StreamSize_String1: string;
    Source_StreamSize_String2: string;
    Source_StreamSize_String3: string;
    Source_StreamSize_String4: string;
    Source_StreamSize_String5: string;
    Source_StreamSize_Proportion: string;
    BufferSize: string;
    colour_description_present: string;
    colour_description_present_Source: string;
    colour_range: string;
    colour_range_Source: string;
    colour_primaries: string;
    colour_primaries_Source: string;
    transfer_characteristics: string;
    transfer_characteristics_Source: string;
    matrix_coefficients: string;
    matrix_coefficients_Source: string;
    extra: Extra;
}

export interface Extra2 {
    Source_Delay?: string;
    Source_Delay_Source?: string;
    mdhd_Duration?: string;
}

export interface Audio {
    "@type": "Audio";
    Count: string;
    StreamCount: string;
    StreamKind: string;
    StreamKind_String: string;
    StreamKindID: string;
    StreamOrder: string;
    ID: string;
    ID_String: string;
    Format: string;
    Format_String: string;
    Format_Info: string;
    Format_Commercial: string;
    Format_AdditionalFeatures: string;
    CodecID: string;
    Duration: string;
    Duration_String: string;
    Duration_String1: string;
    Duration_String2: string;
    Duration_String3: string;
    Duration_String4: string;
    Duration_String5: string;
    Source_Duration: string;
    Source_Duration_String: string;
    Source_Duration_String1: string;
    Source_Duration_String2: string;
    Source_Duration_String3: string;
    BitRate_Mode: string;
    BitRate_Mode_String: string;
    BitRate: string;
    BitRate_String: string;
    BitRate_Maximum: string;
    BitRate_Maximum_String: string;
    Channels: string;
    Channels_String: string;
    ChannelPositions: string;
    ChannelPositions_String2: string;
    ChannelLayout: string;
    SamplesPerFrame: string;
    SamplingRate: string;
    SamplingRate_String: string;
    SamplingCount: string;
    FrameRate: string;
    FrameRate_String: string;
    FrameCount: string;
    Source_FrameCount: string;
    Compression_Mode: string;
    Compression_Mode_String: string;
    StreamSize: string;
    StreamSize_String: string;
    StreamSize_String1: string;
    StreamSize_String2: string;
    StreamSize_String3: string;
    StreamSize_String4: string;
    StreamSize_String5: string;
    StreamSize_Proportion: string;
    Source_StreamSize: string;
    Source_StreamSize_String: string;
    Source_StreamSize_String1: string;
    Source_StreamSize_String2: string;
    Source_StreamSize_String3: string;
    Source_StreamSize_String4: string;
    Source_StreamSize_String5: string;
    Source_StreamSize_Proportion: string;
    Default: string;
    Default_String: string;
    AlternateGroup: string;
    AlternateGroup_String: string;
    extra: Extra2;
}

export interface MediaInfo {
    general: General;
    video?: Video;
    audio?: Audio;
}

interface GeneralPublic {
    Duration: string;
    Duration_String: string;
    FileSize: string;
    OverallBitRate: string;
}

interface VideoPublic {
    Width: string;
    Height: string;
    FrameRate_Mode: string;
    FrameRate_Original: string;
    FrameRate: string;
    Format: string;
    BitRate_Mode: string;
    BitRate: string;
}

interface AudioPublic {
    Format: string;
    BitRate_Mode: string;
    BitRate: string;
}

export interface MediaInfoPublic {
    general: GeneralPublic;
    video: VideoPublic;
    audio: AudioPublic;
}
*/
