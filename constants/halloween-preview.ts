import type { ImageSourcePropType } from "react-native";

// Preview keys are deliberately separate from inventory/catalog item IDs.
export type HalloweenPreviewCategory = "avatar" | "frame" | "nameplate" | "background" | "victory" | "icon";
export type HalloweenPreviewAsset = {
  previewKey: string;
  category: HalloweenPreviewCategory;
  label: string;
  source: ImageSourcePropType;
};

export const HALLOWEEN_PREVIEW_EXPECTED_COUNTS = {
  avatar: 10, frame: 6, nameplate: 4, background: 4, victory: 4, icon: 12,
} as const;

// Original concept crops: local, static and preview-only. Never use catalog IDs here.
export const HALLOWEEN_PREVIEW_ASSETS: readonly HalloweenPreviewAsset[] = [
  { previewKey: "halloween-preview-avatar-01", category: "avatar", label: "ساحر الأطلس", source: require("../assets/seasonal/halloween-preview/avatars/avatars_01.png") },
  { previewKey: "halloween-preview-avatar-02", category: "avatar", label: "ساحرة القمر", source: require("../assets/seasonal/halloween-preview/avatars/avatars_02.png") },
  { previewKey: "halloween-preview-avatar-03", category: "avatar", label: "حارس الظلال", source: require("../assets/seasonal/halloween-preview/avatars/avatars_03.png") },
  { previewKey: "halloween-preview-avatar-04", category: "avatar", label: "الشبح الودود", source: require("../assets/seasonal/halloween-preview/avatars/avatars_04.png") },
  { previewKey: "halloween-preview-avatar-05", category: "avatar", label: "قط منتصف الليل", source: require("../assets/seasonal/halloween-preview/avatars/avatars_05.png") },
  { previewKey: "halloween-preview-avatar-06", category: "avatar", label: "أمير اليقطين", source: require("../assets/seasonal/halloween-preview/avatars/avatars_06.png") },
  { previewKey: "halloween-preview-avatar-07", category: "avatar", label: "روح الصحراء", source: require("../assets/seasonal/halloween-preview/avatars/avatars_07.png") },
  { previewKey: "halloween-preview-avatar-08", category: "avatar", label: "الخيميائي الذهبي", source: require("../assets/seasonal/halloween-preview/avatars/avatars_08.png") },
  { previewKey: "halloween-preview-avatar-09", category: "avatar", label: "حكيم القمر", source: require("../assets/seasonal/halloween-preview/avatars/avatars_09.png") },
  { previewKey: "halloween-preview-avatar-10", category: "avatar", label: "رحّال الشفق", source: require("../assets/seasonal/halloween-preview/avatars/avatars_10.png") },
  { previewKey: "halloween-preview-frame-01", category: "frame", label: "هالة اليقطين", source: require("../assets/seasonal/halloween-preview/frames/frames_01.png") },
  { previewKey: "halloween-preview-frame-02", category: "frame", label: "قمر الخفافيش", source: require("../assets/seasonal/halloween-preview/frames/frames_02.png") },
  { previewKey: "halloween-preview-frame-03", category: "frame", label: "نجمة الزمرد", source: require("../assets/seasonal/halloween-preview/frames/frames_03.png") },
  { previewKey: "halloween-preview-frame-04", category: "frame", label: "الحصاد الذهبي", source: require("../assets/seasonal/halloween-preview/frames/frames_04.png") },
  { previewKey: "halloween-preview-frame-05", category: "frame", label: "الخفاش الوردي", source: require("../assets/seasonal/halloween-preview/frames/frames_05.png") },
  { previewKey: "halloween-preview-frame-06", category: "frame", label: "نجمة الصقيع", source: require("../assets/seasonal/halloween-preview/frames/frames_06.png") },
  { previewKey: "halloween-preview-nameplate-01", category: "nameplate", label: "خط الجمشت", source: require("../assets/seasonal/halloween-preview/nameplates/nameplates_01.png") },
  { previewKey: "halloween-preview-nameplate-02", category: "nameplate", label: "الفانوس الذهبي", source: require("../assets/seasonal/halloween-preview/nameplates/nameplates_02.png") },
  { previewKey: "halloween-preview-nameplate-03", category: "nameplate", label: "تعويذة الزمرد", source: require("../assets/seasonal/halloween-preview/nameplates/nameplates_03.png") },
  { previewKey: "halloween-preview-nameplate-04", category: "nameplate", label: "الشفق الوردي", source: require("../assets/seasonal/halloween-preview/nameplates/nameplates_04.png") },
  { previewKey: "halloween-preview-background-01", category: "background", label: "الرياض المسحور", source: require("../assets/seasonal/halloween-preview/backgrounds/backgrounds_01.png") },
  { previewKey: "halloween-preview-background-02", category: "background", label: "قصر القمر", source: require("../assets/seasonal/halloween-preview/backgrounds/backgrounds_02.png") },
  { previewKey: "halloween-preview-background-03", category: "background", label: "الساحة البنفسجية", source: require("../assets/seasonal/halloween-preview/backgrounds/backgrounds_03.png") },
  { previewKey: "halloween-preview-background-04", category: "background", label: "البوابة الذهبية", source: require("../assets/seasonal/halloween-preview/backgrounds/backgrounds_04.png") },
  { previewKey: "halloween-preview-victory-01", category: "victory", label: "سحر اليقطين", source: require("../assets/seasonal/halloween-preview/victory_effects/victory_effects_01.png") },
  { previewKey: "halloween-preview-victory-02", category: "victory", label: "احتفال الأشباح", source: require("../assets/seasonal/halloween-preview/victory_effects/victory_effects_02.png") },
  { previewKey: "halloween-preview-victory-03", category: "victory", label: "الوهج البنفسجي", source: require("../assets/seasonal/halloween-preview/victory_effects/victory_effects_03.png") },
  { previewKey: "halloween-preview-victory-04", category: "victory", label: "التعويذة الذهبية", source: require("../assets/seasonal/halloween-preview/victory_effects/victory_effects_04.png") },
  { previewKey: "halloween-preview-icon-01", category: "icon", label: "اليقطين", source: require("../assets/seasonal/halloween-preview/icons/icons_01.png") },
  { previewKey: "halloween-preview-icon-02", category: "icon", label: "الشبح", source: require("../assets/seasonal/halloween-preview/icons/icons_02.png") },
  { previewKey: "halloween-preview-icon-03", category: "icon", label: "قبعة الساحرة", source: require("../assets/seasonal/halloween-preview/icons/icons_03.png") },
  { previewKey: "halloween-preview-icon-04", category: "icon", label: "كتاب السحر", source: require("../assets/seasonal/halloween-preview/icons/icons_04.png") },
  { previewKey: "halloween-preview-icon-05", category: "icon", label: "القمر", source: require("../assets/seasonal/halloween-preview/icons/icons_05.png") },
  { previewKey: "halloween-preview-icon-06", category: "icon", label: "الفانوس", source: require("../assets/seasonal/halloween-preview/icons/icons_06.png") },
  { previewKey: "halloween-preview-icon-07", category: "icon", label: "الجرعة السحرية", source: require("../assets/seasonal/halloween-preview/icons/icons_07.png") },
  { previewKey: "halloween-preview-icon-08", category: "icon", label: "البلورة", source: require("../assets/seasonal/halloween-preview/icons/icons_08.png") },
  { previewKey: "halloween-preview-icon-09", category: "icon", label: "الخفاش", source: require("../assets/seasonal/halloween-preview/icons/icons_09.png") },
  { previewKey: "halloween-preview-icon-10", category: "icon", label: "المفتاح", source: require("../assets/seasonal/halloween-preview/icons/icons_10.png") },
  { previewKey: "halloween-preview-icon-11", category: "icon", label: "النجمة", source: require("../assets/seasonal/halloween-preview/icons/icons_11.png") },
  { previewKey: "halloween-preview-icon-12", category: "icon", label: "الحلوى", source: require("../assets/seasonal/halloween-preview/icons/icons_12.png") },
];

export function isHalloweenPreviewEnabled(development: boolean, flag: string | undefined) {
  return development && flag === "1";
}
