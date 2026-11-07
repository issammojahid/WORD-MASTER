const messages: Record<string,string> = {
 online_unavailable:"خدمات اللعب عبر الإنترنت غير متاحة حالياً. حاول لاحقاً.",social_unavailable:"تعذر الاتصال بخدمات الأصدقاء. أعد المحاولة.",unauthorized:"انتهت جلسة الاتصال. أعد فتح اللعبة.",rate_limited:"يرجى الانتظار قليلاً قبل المحاولة مجدداً.",rateLimited:"يرجى الانتظار قليلاً قبل المحاولة مجدداً.",player_not_found:"لم يتم العثور على اللاعب.",room_not_found:"لم يتم العثور على الغرفة.",room_full:"الغرفة ممتلئة.",blocked:"لا يمكنك تنفيذ هذا الإجراء لهذا اللاعب.",request_exists:"أُرسل طلب الصداقة بالفعل.",invalid_player:"معرّف اللاعب غير صالح.",not_friends:"يجب إضافة اللاعب إلى أصدقائك أولاً.",message_too_long:"الرسالة أطول من الحد المسموح.",self_request:"لا يمكنك إرسال طلب صداقة إلى نفسك."
};
export function displayError(code:string,arabic:boolean):string {
 if(!arabic)return code;
 return messages[code] || (/^[\s\p{Script=Arabic}\p{P}\p{N}]+$/u.test(code)?code:"تعذر إكمال العملية. تحقق من اتصالك ثم أعد المحاولة.");
}
