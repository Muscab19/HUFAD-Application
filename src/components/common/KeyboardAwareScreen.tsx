// src/components/common/KeyboardAwareScreen.tsx
import React, { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ScrollViewProps,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

interface KeyboardAwareScreenProps {
  children: ReactNode;
  /** Outer container style */
  style?: ViewStyle;
  /** Content container style (padding etc.) */
  contentContainerStyle?: ViewStyle;
  /** Extra bottom padding for footers/tab bars */
  extraBottomOffset?: number;
  /** iOS only — height of anything above the scroll area */
  keyboardVerticalOffset?: number;
  showsVerticalScrollIndicator?: boolean;
  scrollEnabled?: boolean;
  scroll?: boolean;
  scrollViewProps?: ScrollViewProps;
}

export const KeyboardAwareScreen: React.FC<KeyboardAwareScreenProps> = ({
  children,
  style,
  contentContainerStyle,
  extraBottomOffset = 0,
  keyboardVerticalOffset = 0,
  showsVerticalScrollIndicator = false,
  scrollEnabled = true,
  scroll = true,
  scrollViewProps,
}) => {
  const behavior: 'padding' | 'height' | undefined =
    Platform.OS === 'ios' ? 'padding' : 'height';

  const inner = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[
        { flexGrow: 1, paddingBottom: 24 + extraBottomOffset },
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      scrollEnabled={scrollEnabled}
      {...scrollViewProps}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, contentContainerStyle]}>{children}</View>
  );

  return (
    <KeyboardAvoidingView
      style={[{ flex: 1 }, style]}
      behavior={behavior}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      {inner}
    </KeyboardAvoidingView>
  );
};