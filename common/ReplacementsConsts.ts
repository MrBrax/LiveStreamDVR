import type { ClipBasenameTemplate, ExporterFilenameTemplate, TemplateField, VodBasenameTemplate } from "./Replacements";

export const VodBasenameFields: Record<keyof VodBasenameTemplate, TemplateField> = {
    login: { display: "MooseStreamer", deprecated: true },
    internalName: { display: "moosestreamer" },
    displayName: { display: "MooseStreamer", },
    date: { display: "2022-12-31T12_05_04Z" },
    year: { display: "2022" },
    year_short: { display: "22" },
    month: { display: "12" },
    day: { display: "31" },
    hour: { display: "12" },
    minute: { display: "05" },
    second: { display: "04" },
    id: { display: "123456789" },
    season: { display: "202212" },
    absolute_season: { display: "5" },
    episode: { display: "3" },
    title: { display: "Moose crosses river HOT NEW CONTENT COME LOOK" },
    game_name: { display: "Moose Simulator 2022" },
};

export const ClipBasenameFields: Record<keyof ClipBasenameTemplate, TemplateField> = {
    id: { display: "MinimalMooseOtterCatcher1234" },
    quality: { display: "720p" },
    clip_date: { display: "2020-01-01" },
    title: { display: "Moose crosses river" },
    creator: { display: "MooseClipper" },
    broadcaster: { display: "MooseStreamer" },
};

export const ExporterFilenameFields: Record<keyof ExporterFilenameTemplate, TemplateField> = {
    login: { display: "username", deprecated: true },
    internalName: { display: "username" },
    displayName: { display: "DisplayName", },
    title: { display: "Title" },
    stream_number: { display: "5" },
    comment: { display: "Comment" },
    date: { display: "2020-12-31" },
    year: { display: "2020" },
    month: { display: "12" },
    day: { display: "31" },
    resolution: { display: "1080p" },
};

// export const ExporterTitleFields: Record<keyof ExporterTitleTemplate, TemplateField> = {
//     ...VodBasenameFields, // extends VodBasenameTemplate
//     title: { display: "Title" },
// };