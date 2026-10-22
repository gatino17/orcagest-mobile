import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Keyboard,
  Modal as NativeModal,
  Platform,
  ScrollView as NativeScrollView,
  StyleSheet,
  StatusBar,
  TextInput,
  View,
  type KeyboardEvent,
  type ModalProps,
  type ScrollViewProps,
} from 'react-native';

import { focusedFieldScroll, keyboardOverlap, keyboardWindowTop } from '@/lib/keyboard';

const GAP = 16;
// Android measureInWindow excludes the status bar; keyboard events use screen coordinates.
const statusBarHeight = Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0;

function useKeyboardFrame(top: React.RefObject<number | null>, onChange: () => void, enabled = true) {
  const callback = useRef(onChange);
  callback.current = onChange;

  useEffect(() => {
    if (!enabled) return;
    const show = (event: KeyboardEvent) => {
      top.current = keyboardWindowTop(event.endCoordinates, statusBarHeight);
      callback.current();
    };
    const hide = () => {
      top.current = null;
      callback.current();
    };
    const subscriptions = [
      Keyboard.addListener('keyboardDidShow', show),
      Keyboard.addListener('keyboardDidHide', hide),
      Keyboard.addListener('keyboardWillChangeFrame', show),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [enabled, top]);
}

// Keep the native ref API: inventory also uses scrollTo after a successful scan.
export const KeyboardScrollView = forwardRef<NativeScrollView, ScrollViewProps>(function KeyboardScrollView(
  { children, horizontal, contentContainerStyle, onFocus, onBlur, onLayout, onScroll,
    onContentSizeChange, keyboardShouldPersistTaps = 'handled', ...props },
  forwardedRef,
) {
  const scroll = useRef<NativeScrollView>(null);
  const field = useRef<ReturnType<typeof TextInput.State.currentlyFocusedInput>>(null);
  const offset = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);
  const keyboardTop = useRef(keyboardWindowTop(Keyboard.metrics(), statusBarHeight));
  const [overlap, setOverlap] = useState(0);
  useImperativeHandle(forwardedRef, () => scroll.current!, []);

  const cancel = useCallback(() => {
    generation.current++;
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const refresh = useCallback(() => {
    cancel();
    const request = generation.current;
    const input = field.current;
    const current = () => request === generation.current && input !== null &&
      input === field.current && input === TextInput.State.currentlyFocusedInput();
    if (horizontal || keyboardTop.current === null || !current()) {
      setOverlap(0);
      return;
    }
    scroll.current?.getNativeScrollRef()?.measureInWindow((_x, y, _width, height) => {
      if (!current() || keyboardTop.current === null) return;
      setOverlap(keyboardOverlap({ top: y, height }, keyboardTop.current) + GAP);
      // Wait for both adjustResize and the extra scroll space to finish laying out.
      timer.current = setTimeout(() => {
        if (!current() || keyboardTop.current === null) return;
        scroll.current?.getNativeScrollRef()?.measureInWindow((_vx, vy, _vw, vh) => {
          input?.measureInWindow((_ix, iy, _iw, ih) => {
            if (!current() || keyboardTop.current === null) return;
            const delta = focusedFieldScroll({ top: iy, height: ih }, { top: vy, height: vh }, keyboardTop.current);
            if (Math.abs(delta) > 1) {
              scroll.current?.scrollTo({ y: Math.max(0, offset.current + delta), animated: true });
            }
          });
        });
      }, 100);
    });
  }, [cancel, horizontal]);

  useKeyboardFrame(keyboardTop, refresh, !horizontal);
  useEffect(() => cancel, [cancel]);
  const content = StyleSheet.flatten(contentContainerStyle);
  const basePadding = content?.paddingBottom ?? content?.paddingVertical ?? content?.padding ?? 0;

  return (
    <NativeScrollView
      {...props}
      ref={scroll}
      horizontal={horizontal}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      scrollEventThrottle={props.scrollEventThrottle ?? 16}
      contentContainerStyle={[contentContainerStyle, !horizontal && overlap > 0 && {
        paddingBottom: (typeof basePadding === 'number' ? basePadding : 0) + overlap,
      }]}
      onFocus={(event) => {
        onFocus?.(event);
        if (horizontal) return;
        field.current = TextInput.State.currentlyFocusedInput();
        if (field.current) {
          event.stopPropagation();
          refresh();
        }
      }}
      onBlur={(event) => {
        onBlur?.(event);
        field.current = null;
        cancel();
      }}
      onLayout={(event) => { onLayout?.(event); refresh(); }}
      onContentSizeChange={(width, height) => { onContentSizeChange?.(width, height); refresh(); }}
      onScroll={(event) => { offset.current = event.nativeEvent.contentOffset.y; onScroll?.(event); }}
    >
      {children}
    </NativeScrollView>
  );
});

function KeyboardViewport({ children }: React.PropsWithChildren) {
  const view = useRef<View>(null);
  const generation = useRef(0);
  const keyboardTop = useRef(keyboardWindowTop(Keyboard.metrics(), statusBarHeight));
  const [overlap, setOverlap] = useState(0);
  const refresh = useCallback(() => {
    const request = ++generation.current;
    if (keyboardTop.current === null) {
      setOverlap(0);
      return;
    }
    view.current?.measureInWindow((_x, y, _width, height) => {
      if (request !== generation.current) return;
      setOverlap(keyboardOverlap({ top: y, height }, keyboardTop.current));
    });
  }, []);
  useKeyboardFrame(keyboardTop, refresh);
  useEffect(() => () => { generation.current++; }, []);

  return <View ref={view} style={[styles.viewport, { paddingBottom: overlap }]} onLayout={refresh}>{children}</View>;
}

export function KeyboardModal({ children, visible = true, ...props }: ModalProps) {
  return (
    <NativeModal {...props} visible={visible}>
      <KeyboardViewport>{children}</KeyboardViewport>
    </NativeModal>
  );
}

const styles = StyleSheet.create({ viewport: { flex: 1 } });
