/**
 * Configuration options for editing code.
 */
export interface EditOptions {
    selector: string;
    action: "replace" | "delete" | "before" | "after";
    content?: string;
    all?: boolean;
}

/**
 * Interface for representing a parsed selector part.
 */
export interface SelectorPart {
    kind?: string;
    name?: string;
    textPrefix?: string;
    isComment?: boolean;
}