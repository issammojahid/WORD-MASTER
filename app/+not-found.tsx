import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { GameIllustration } from "@/components/GameIcon";
import { GameScreenBackground } from "@/components/GameUi";
import { gameDesign } from "@/constants/game-design";

export default function NotFoundScreen() {
  const { theme } = useTheme();
  return (
    <>
      <Stack.Screen options={{ title: "Oops!" }} />
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <GameScreenBackground accent="online" />
        <GameIllustration name="error" size={100} />
        <Text style={[styles.title, { color: theme.textPrimary }]}>This screen doesn&apos;t exist.</Text>

        <Link href="/" style={styles.link}>
          <Text style={[styles.linkText, { color: gameDesign.colors.primary }]}>Go to home screen!</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: { fontSize: 14, fontFamily: gameDesign.typography.fontFamily.semibold },
});
