// Inclusive opening and exclusive closing boundaries, in Morocco's December UTC+1.
// Client display calendar only. Reward eligibility must later use verified server time.
export const SEASON_EVENTS=[
 {id:"atlas",title:"كنوز الأطلس",start:"2026-12-01T00:00:00+01:00",end:"2026-12-12T00:00:00+01:00",dates:"1 – 11 دجنبر",icon:"map-outline"},
 {id:"arabic",title:"سحر اللغة العربية",start:"2026-12-12T00:00:00+01:00",end:"2026-12-19T00:00:00+01:00",dates:"12 – 18 دجنبر",icon:"book-outline"},
 {id:"winter",title:"مملكة الشتاء",start:"2026-12-19T00:00:00+01:00",end:"2026-12-25T00:00:00+01:00",dates:"19 – 24 دجنبر",icon:"snow-outline"},
 {id:"gifts",title:"مهرجان الهدايا",start:"2026-12-25T00:00:00+01:00",end:"2026-12-31T00:00:00+01:00",dates:"25 – 30 دجنبر",icon:"gift-outline"},
 {id:"newyear",title:"بوابة 2027",start:"2026-12-31T00:00:00+01:00",end:"2027-01-04T00:00:00+01:00",dates:"31 دجنبر – 3 يناير",icon:"sparkles-outline"},
] as const;
export type SeasonEventId=typeof SEASON_EVENTS[number]["id"];
export function eventPhase(event:{start:string;end:string},now:number){return now<Date.parse(event.start)?"upcoming":now<Date.parse(event.end)?"active":"ended";}
export function initialSeasonIndex(now:number){const active=SEASON_EVENTS.findIndex(event=>eventPhase(event,now)==="active");if(active>=0)return active;const next=SEASON_EVENTS.findIndex(event=>eventPhase(event,now)==="upcoming");return next>=0?next:0;}
