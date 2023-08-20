
export interface ContentClassificationLabel {
    id: string;
    description: string;
    name: string;
}

export interface ContentClassificationLabelsResponse {
    data: ContentClassificationLabel[];
}