import React from "react";
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { gameDesign } from "@/constants/game-design";

export type GameIconName =
  | "home"
  | "offline"
  | "online"
  | "coins"
  | "missions"
  | "achievements"
  | "dailyChallenge"
  | "friends"
  | "chat"
  | "invitations"
  | "clans"
  | "profile"
  | "settings";

type GameIconProps = {
  name: GameIconName;
  size?: number;
  color?: string;
  secondaryColor?: string;
  accessibilityLabel?: string;
};

const OUTLINE = {
  fill: "none" as const,
  strokeWidth: 4,
  strokeLinecap: "square" as const,
  strokeLinejoin: "miter" as const,
};

export function GameIcon({
  name,
  size = 24,
  color = gameDesign.colors.friends,
  secondaryColor = gameDesign.colors.profile,
  accessibilityLabel,
}: GameIconProps) {
  const primary = { ...OUTLINE, stroke: color };
  const secondary = { ...OUTLINE, stroke: secondaryColor };

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      {...(accessibilityLabel ? { accessible: true, accessibilityLabel } : {})}
    >
      {name === "home" && (
        <>
          <Path d="m8 29 24-20 24 20v25a5 5 0 0 1-5 5H13a5 5 0 0 1-5-5z" fill={`${color}20`} stroke={color} strokeWidth="3" strokeLinejoin="round" />
          <Path d="M25 59V39a7 7 0 0 1 14 0v20M17 31h9m12 0h9" {...secondary} />
        </>
      )}
      {name === "offline" && (
        <>
          <Rect x="18" y="5" width="28" height="54" rx="7" {...primary} />
          <Path d="M27 12h10M28 51h8" {...secondary} />
          <Rect x="24" y="20" width="16" height="20" rx="4" fill={`${color}24`} stroke={color} strokeWidth="2.5" />
          <Path d="m28 30 3 3 6-7" {...secondary} />
        </>
      )}
      {name === "online" && (
        <>
          <Circle cx="23" cy="21" r="8" fill={`${color}24`} stroke={color} strokeWidth="3" />
          <Circle cx="43" cy="21" r="8" fill={`${secondaryColor}18`} stroke={secondaryColor} strokeWidth="3" />
          <Path d="M7 53c1-10 7-16 16-16s15 6 16 16M27 53c1-7 6-12 15-12 8 0 13 4 15 12" {...primary} />
          <Path d="M31 17h4M31 25h4" {...secondary} />
        </>
      )}
      {name === "coins" && (
        <>
          <Ellipse cx="31" cy="18" rx="19" ry="8" fill={`${color}30`} stroke={color} strokeWidth="3" />
          <Path d="M12 18v10c0 4 9 8 19 8s19-4 19-8V18M12 28v10c0 4 9 8 19 8s19-4 19-8V28M12 38v8c0 4 9 8 19 8s19-4 19-8v-8" {...primary} />
          <Path d="M31 11v14m-5-10c1-2 8-2 9 1 1 4-9 3-9 7 0 3 6 4 10 1" {...secondary} />
        </>
      )}
      {name === "missions" && (
        <>
          <Rect x="15" y="9" width="36" height="47" rx="7" {...primary} />
          <Path d="m22 23 3 3 5-6m6 3h8M22 39l3 3 5-6m6 3h8" {...secondary} />
        </>
      )}
      {name === "achievements" && (
        <>
          <Path d="m32 7 7 5 9 1 1 9 5 8-5 8-1 9-9 1-7 5-7-5-9-1-1-9-5-8 5-8 1-9 9-1z" fill={`${color}24`} stroke={color} strokeWidth="3" strokeLinejoin="round" />
          <Path d="m32 18 4 8 9 1-6 6 2 9-9-5-9 5 2-9-6-6 9-1z" {...secondary} />
        </>
      )}
      {name === "dailyChallenge" && (
        <>
          <Rect x="10" y="14" width="44" height="41" rx="7" {...primary} />
          <Path d="M21 8v12M43 8v12M10 26h44" {...secondary} />
          <Path d="m32 31 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill={`${color}24`} stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
        </>
      )}
      {name === "friends" && (
        <>
          <Circle cx="23" cy="22" r="8" fill={`${color}24`} stroke={color} strokeWidth="3" />
          <Circle cx="43" cy="22" r="8" fill={`${secondaryColor}18`} stroke={secondaryColor} strokeWidth="3" />
          <Path d="M7 53c1-10 7-16 16-16s15 6 16 16M27 53c1-9 6-14 15-14 8 0 13 5 15 14" {...primary} />
        </>
      )}
      {name === "chat" && (
        <>
          <Path d="M11 13h42v31H31L19 54v-10h-8z" fill={`${color}20`} stroke={color} strokeWidth="3" strokeLinejoin="round" />
          <Path d="M20 25h24M20 33h16" {...secondary} />
        </>
      )}
      {name === "invitations" && (
        <>
          <Rect x="8" y="14" width="39" height="36" rx="6" fill={`${color}18`} stroke={color} strokeWidth="3" />
          <Path d="m10 18 17 14 18-14M36 42h18m-7-7 7 7-7 7" {...secondary} />
        </>
      )}
      {name === "clans" && (
        <>
          <Path d="M32 6 52 14v15c0 13-8 22-20 29C20 51 12 42 12 29V14z" fill={`${color}20`} stroke={color} strokeWidth="3" strokeLinejoin="round" />
          <Circle cx="32" cy="25" r="5" {...secondary} />
          <Path d="M22 43c1-7 4-11 10-11s9 4 10 11" {...secondary} />
        </>
      )}
      {name === "profile" && (
        <>
          <Circle cx="32" cy="21" r="12" fill={`${color}20`} stroke={color} strokeWidth="3" />
          <Path d="M10 57c1-13 9-20 22-20s21 7 22 20" {...primary} />
          <Path d="M27 21h10" {...secondary} />
        </>
      )}
      {name === "settings" && (
        <>
          <Path d="M27 7h10l2 7 6 3 7-2 5 9-5 5v7l5 5-5 9-7-2-6 3-2 7H27l-2-7-6-3-7 2-5-9 5-5v-7l-5-5 5-9 7 2 6-3z" fill={`${color}18`} stroke={color} strokeWidth="3" strokeLinejoin="round" />
          <Circle cx="32" cy="33" r="9" {...secondary} />
        </>
      )}
    </Svg>
  );
}

type GameModeIllustrationProps = {
  mode: "offline" | "online";
  size?: number;
};

export function GameModeIllustration({ mode, size = 148 }: GameModeIllustrationProps) {
  const accent = mode === "offline" ? "#36E0B0" : "#F34FAE";
  const secondary = mode === "offline" ? "#22D9E5" : "#B78BFF";
  const isOffline = mode === "offline";

  return (
    <Svg width={size} height={size * 0.82} viewBox="0 0 180 148">
      <Defs>
        <LinearGradient id="fantasyPad" x1="0" y1="0" x2="0.9" y2="1">
          <Stop offset="0" stopColor="#49EBD0" />
          <Stop offset="0.55" stopColor="#168D9B" />
          <Stop offset="1" stopColor="#174B75" />
        </LinearGradient>
        <LinearGradient id="fantasyOrb" x1="0.15" y1="0" x2="0.85" y2="1">
          <Stop offset="0" stopColor="#F779D0" />
          <Stop offset="0.48" stopColor="#8747DB" />
          <Stop offset="1" stopColor="#282064" />
        </LinearGradient>
      </Defs>
      <Ellipse cx="91" cy="127" rx="60" ry="10" fill="#080615" opacity={0.45} />
      <Circle cx="90" cy="71" r="63" fill={accent} opacity={0.12} />
      <Circle cx="143" cy="34" r="8" fill={secondary} opacity={0.8} />
      <Circle cx="34" cy="104" r="5" fill="#FFFFFF" opacity={0.8} />
      {isOffline ? (
        <>
          <Path d="M53 51c-10 0-17 8-20 19l-9 31c-4 14 12 23 23 14l22-18h42l22 18c11 9 27 0 23-14l-9-31c-3-11-10-19-20-19z" transform="translate(0 5)" fill="#071C3A" opacity={0.75} />
          <Path d="M53 47c-10 0-17 8-20 19l-9 31c-4 14 12 23 23 14l22-18h42l22 18c11 9 27 0 23-14l-9-31c-3-11-10-19-20-19z" fill="url(#fantasyPad)" stroke="#77FFF0" strokeWidth="3" />
          <Path d="M43 69h23m-11-11v23" stroke="#D8FFF8" strokeWidth="6" strokeLinecap="round" />
          <Circle cx="119" cy="64" r="5" fill="#FFF2A6" />
          <Circle cx="132" cy="76" r="5" fill="#FF85D5" />
          <Circle cx="106" cy="77" r="5" fill="#A5A1FF" />
          <Circle cx="119" cy="89" r="5" fill="#8CF6EA" />
          <Ellipse cx="83" cy="81" rx="7" ry="5" fill="#113653" stroke="#8AF7EA" strokeWidth="2" />
          <Ellipse cx="95" cy="81" rx="7" ry="5" fill="#113653" stroke="#8AF7EA" strokeWidth="2" />
          <Path d="M145 27c8 2 14 7 17 14m-17-7c4 1 7 4 8 8m-11-11 20 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity={0.9} />
          <Path d="m35 36 3 6 7 1-5 4 1 7-6-3-6 3 1-7-5-4 7-1z" fill="#FFFFFF" />
        </>
      ) : (
        <>
          <Circle cx="90" cy="75" r="49" fill="#080615" opacity={0.38} />
          <Circle cx="90" cy="69" r="46" fill="url(#fantasyOrb)" stroke="#FFB5E5" strokeWidth="3" />
          <Path d="M47 58h86M48 82h84M90 23c-17 13-24 29-24 46s7 34 24 46m0-92c17 13 24 29 24 46s-7 34-24 46" fill="none" stroke="#F3E9FF" strokeWidth="2.5" opacity={0.8} />
          <Ellipse cx="90" cy="69" rx="18" ry="46" fill="none" stroke="#FFFFFF" strokeWidth="2" opacity={0.5} />
          <Circle cx="47" cy="108" r="15" fill="#3C2373" stroke="#8DF5EE" strokeWidth="2.5" />
          <Circle cx="133" cy="108" r="15" fill="#3C2373" stroke="#FF9BDB" strokeWidth="2.5" />
          <Circle cx="47" cy="103" r="5" fill="#FFF8FF" />
          <Circle cx="133" cy="103" r="5" fill="#FFF8FF" />
          <Path d="M37 118c1-8 5-11 10-11s9 3 10 11m66 0c1-8 5-11 10-11s9 3 10 11" fill="none" stroke="#D8C9EA" strokeWidth="3" strokeLinecap="round" />
          <Circle cx="145" cy="39" r="5" fill="#FFF1A3" />
          <Path d="m29 54 3 6 7 1-5 4 1 7-6-3-6 3 1-7-5-4 7-1z" fill="#FFFFFF" />
        </>
      )}
    </Svg>
  );
}

export type GameIllustrationName =
  | "matchmaking"
  | "victory"
  | "defeat"
  | "reward"
  | "social"
  | "invitation"
  | "error";

export function GameIllustration({
  name,
  size = 112,
}: {
  name: GameIllustrationName;
  size?: number;
}) {
  const isDanger = name === "defeat" || name === "error";
  const isReward = name === "reward" || name === "victory";
  const accent = isDanger ? gameDesign.colors.danger : isReward ? gameDesign.colors.coins : name === "invitation" ? gameDesign.colors.invitations : gameDesign.colors.friends;
  const soft = isDanger ? "#FFFFFF" : isReward ? gameDesign.colors.coinsText : name === "invitation" ? gameDesign.colors.invitationsText : "#FFFFFF";

  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Circle cx="60" cy="61" r="48" fill={`${accent}12`} />
      {name === "matchmaking" && (
        <>
          <Circle cx="42" cy="39" r="13" fill="#E9FBFF" stroke={accent} strokeWidth="3" />
          <Circle cx="78" cy="39" r="13" fill="#FFF0F7" stroke={soft} strokeWidth="3" />
          <Path d="M17 91c2-20 10-31 25-31s23 11 25 31M53 91c2-16 10-25 25-25s23 9 25 25" fill="#E9FBFF" stroke={accent} strokeWidth="3" strokeLinejoin="round" />
          <Path d="M53 39h14m-7-7v14" stroke={soft} strokeWidth="3" strokeLinecap="round" />
          <Circle cx="18" cy="23" r="4" fill={soft} />
          <Circle cx="103" cy="22" r="4" fill={accent} />
          <Path d="m23 25 10 7m55-8 9-5" stroke={`${soft}99`} strokeWidth="2" strokeDasharray="3 4" />
        </>
      )}
      {name === "victory" && (
        <>
          <Path d="M60 14 71 22l14 1 2 14 8 11-8 12-2 14-14 2-11 9-11-9-14-2-2-14-8-12 8-11 2-14 14-1z" fill={`${accent}25`} stroke={accent} strokeWidth="3" strokeLinejoin="round" />
          <Path d="m60 31 6 12 13 2-9 9 2 13-12-6-12 6 2-13-9-9 13-2z" fill={soft} stroke={accent} strokeWidth="2" strokeLinejoin="round" />
          <Path d="M26 35 17 30m77 5 9-5M27 72l-9 5m75-5 9 5" stroke={soft} strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {name === "defeat" && (
        <>
          <Path d="M60 14 91 26v23c0 21-12 36-31 48-19-12-31-27-31-48V26z" fill="#FFF0F2" stroke={accent} strokeWidth="3" strokeLinejoin="round" />
          <Path d="m50 37 8 10-7 9 10 7-5 13m15-40-8 10 6 8-7 7 4 9" fill="none" stroke={soft} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx="18" cy="27" r="4" fill={`${accent}88`} />
          <Circle cx="102" cy="81" r="5" fill={`${soft}88`} />
        </>
      )}
      {name === "reward" && (
        <>
          <Ellipse cx="54" cy="37" rx="26" ry="11" fill="#FFF1B8" stroke={accent} strokeWidth="3" />
          <Path d="M28 37v19c0 6 12 11 26 11s26-5 26-11V37M28 56v17c0 6 12 11 26 11s26-5 26-11V56" fill="#FFE49C" stroke={accent} strokeWidth="3" />
          <Path d="M54 26v21m-7-14c2-4 13-3 14 2 1 5-15 4-14 10 1 5 11 6 16 2" fill="none" stroke={soft} strokeWidth="3" strokeLinecap="round" />
          <Path d="m94 21 3 7 8 1-6 5 2 8-7-4-7 4 1-8-6-5 8-1z" fill={soft} />
          <Path d="m20 89 2 5 5 1-4 4 1 5-4-3-5 3 1-5-4-4 5-1z" fill={accent} />
        </>
      )}
      {name === "social" && (
        <>
          <Path d="M16 20h54v38H47L31 72V58H16z" fill="#E9FBFF" stroke={accent} strokeWidth="3" strokeLinejoin="round" />
          <Path d="M50 47h48v34H82L69 94V81h-9" fill="#FFF0F7" stroke={soft} strokeWidth="3" strokeLinejoin="round" />
          <Path d="M28 34h30m-30 9h20m12 16h24m-24 8h15" stroke={soft} strokeWidth="3" strokeLinecap="round" />
          <Circle cx="98" cy="23" r="5" fill={accent} />
        </>
      )}
      {name === "invitation" && (
        <>
          <Rect x="14" y="29" width="70" height="52" rx="9" fill="#FFF7D6" stroke={accent} strokeWidth="3" />
          <Path d="m18 35 31 25 31-25M18 75l21-18m42 18L60 57" fill="none" stroke={soft} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="m89 29 5 10 11 2-8 7 2 11-10-5-10 5 2-11-8-7 11-2z" fill={`${accent}40`} stroke={accent} strokeWidth="2.5" strokeLinejoin="round" />
          <Path d="M75 91h28m-10-10 10 10-10 10" fill="none" stroke={soft} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {name === "error" && (
        <>
          <Path d="M60 13 99 32v25c0 23-15 39-39 51C36 96 21 80 21 57V32z" fill="#FFF0F2" stroke={accent} strokeWidth="3" strokeLinejoin="round" />
          <Path d="M60 36v25" fill="none" stroke={soft} strokeWidth="5" strokeLinecap="round" />
          <Circle cx="60" cy="76" r="3.5" fill={soft} />
          <Path d="m17 24 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1zM103 77l2 5 5 1-4 4 1 5-4-3-5 3 1-5-4-4 5-1z" fill={accent} />
        </>
      )}
    </Svg>
  );
}
