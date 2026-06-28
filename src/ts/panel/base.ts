export interface EditorItem {
    pattern: string;
    value: string;
    regex: boolean;
    is_script: boolean;
    scope?: string; // undefined/'global' = always active; char name = that character only
}
