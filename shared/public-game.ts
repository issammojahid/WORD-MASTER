export const PUBLIC_QUEUE_MODES=["solo","team","four"] as const;
export type PublicQueueMode=typeof PUBLIC_QUEUE_MODES[number];
export const isPublicQueueMode=(value:unknown):value is PublicQueueMode=>PUBLIC_QUEUE_MODES.some(mode=>mode===value);
export const publicQueueSize=(mode:PublicQueueMode):2|4=>mode==="solo"?2:4;
export const PUBLIC_MODE_COPY={solo:{ar:"أونلاين فردي",en:"Online duel",description:"لاعب ضد لاعب · مطابقة تلقائية"},team:{ar:"Team Up",en:"Team Up",description:"أربعة لاعبين · فريقان 2 ضد 2"},four:{ar:"4 لاعبين",en:"4 Players",description:"أربعة لاعبين · كل لاعب لنفسه"}};
