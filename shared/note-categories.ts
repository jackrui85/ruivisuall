export const noteCategories = ["待辦", "提醒", "行程", "資訊", "想法", "其他"] as const;

export type NoteCategory = (typeof noteCategories)[number];
