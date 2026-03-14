import React, { Component } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import Colors from "@/constants/colors";

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
          <Text style={styles.emoji}>⚠️</Text>
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
    backgroundColor: "#0D1B2A",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    gap: 16,
  },
  emoji: { fontSize: 52 },
  title: {
    fontFamily: "Cairo_700Bold",
    fontSize: 20,
    color: "#F0E6D3",
    textAlign: "center",
  },
  subtitle: {
    fontFamily: "Cairo_400Regular",
    fontSize: 14,
    color: "#6B7E91",
    textAlign: "center",
    lineHeight: 22,
  },
  backBtn: {
    marginTop: 8,
    backgroundColor: Colors.gold,
    borderRadius: 14,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  backBtnText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 15,
    color: "#000",
  },
  retryBtn: {
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#2A4560",
  },
  retryBtnText: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 14,
    color: "#A8B8CC",
  },
});
