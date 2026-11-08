import {SUPPORT_EMAIL} from '../shared/privacy-content';
export {SUPPORT_EMAIL};

// Opening this draft never sends mail or deletes data automatically.
export function supportMailUrl(playerId: string, deletion = false): string {
  const subject = deletion ? 'طلب حذف بيانات حروف المغرب' : 'دعم حروف المغرب';
  const body = deletion
    ? `أطلب حذف بيانات ملفي في حروف المغرب.\nمعرّف اللاعب: ${playerId}\n\nملاحظات إضافية:\n`
    : `معرّف اللاعب: ${playerId}\n\nوصف المشكلة:\n`;
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
