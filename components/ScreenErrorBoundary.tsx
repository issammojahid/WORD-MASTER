import React, { Component } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import { GameIllustration } from "@/components/GameIcon";
import { gameDesign } from "@/constants/game-design";

type Props = {
  children: React.ReactNode;
  screenName?: string;
};

type State = {
  hasError: boolean;
};

export class ScreenErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error(
      `[ScreenErrorBoundary] Screen "${this.props.screenName ?? "unknown"}" crashed:`,
      error.message,
      info.componentStack,
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <GameIllustration name="error" size={96} />
          <Text style={styles.title}>تعذّر تحميل الصفحة</Text>
          <Text style={styles.subtitle}>
            {this.props.screenName
              ? `تعذّر فتح "${this.props.screenName}"، يرجى المحاولة لاحقاً.`
              : "حدث خطأ غير متوقع، يرجى الرجوع والمحاولة مجدداً."}
          </Text>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              this.setState({ hasError: false });
              router.back();
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.backBtnText}>رجوع</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => this.setState({ hasError: false })}
            activeOpacity={0.8}
          >
            <Text style={styles.retryBtnText}>إعادة المحاولة</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: gameDesign.colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: gameDesign.spacing.xl,
    gap: 16,
  },
  title: {
    fontFamily: gameDesign.typography.fontFamily.bold,
    fontSize: gameDesign.typography.fontSize.subtitle,
    color: gameDesign.colors.textPrimary,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: gameDesign.typography.fontFamily.regular,
    fontSize: gameDesign.typography.fontSize.body,
    color: gameDesign.colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  backBtn: {
    marginTop: 8,
    minHeight: 48,
    minWidth: 180,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: gameDesign.colors.coins,
    borderRadius: gameDesign.radii.control,
    paddingHorizontal: 32,
  },
  backBtnText: {
    fontFamily: gameDesign.typography.fontFamily.bold,
    fontSize: 15,
    color: gameDesign.colors.background,
  },
  retryBtn: {
    minHeight: 48,
    minWidth: 180,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: gameDesign.radii.control,
    paddingHorizontal: 28,
    borderWidth: 1,
    borderColor: gameDesign.colors.surfaceBorder,
  },
  retryBtnText: {
    fontFamily: gameDesign.typography.fontFamily.semibold,
    fontSize: 14,
    color: gameDesign.colors.textSecondary,
  },
});
