import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useThemeStore, DAY_THEME, NIGHT_THEME } from '../features/theme/themeStore.ts';

test('themeStore: defaults to day theme', () => {
  const state = useThemeStore.getState();
  assert.equal(state.themeMode, 'day');
  assert.equal(state.colors.isNight, false);
  assert.equal(state.colors.statusBarStyle, 'dark');
});

test('themeStore: toggleTheme switches to night and back', () => {
  const store = useThemeStore.getState();
  store.toggleTheme();
  let state = useThemeStore.getState();
  assert.equal(state.themeMode, 'night');
  assert.equal(state.colors.isNight, true);
  assert.equal(state.colors.statusBarStyle, 'light');
  assert.deepEqual(state.colors.backgroundGradient, NIGHT_THEME.backgroundGradient);

  store.toggleTheme();
  state = useThemeStore.getState();
  assert.equal(state.themeMode, 'day');
  assert.equal(state.colors.isNight, false);
  assert.equal(state.colors.statusBarStyle, 'dark');
  assert.deepEqual(state.colors.backgroundGradient, DAY_THEME.backgroundGradient);
});

test('themeStore: setTheme explicitly sets desired mode', () => {
  const store = useThemeStore.getState();
  store.setTheme('night');
  let state = useThemeStore.getState();
  assert.equal(state.themeMode, 'night');

  store.setTheme('night'); // idempotent
  state = useThemeStore.getState();
  assert.equal(state.themeMode, 'night');

  store.setTheme('day');
  state = useThemeStore.getState();
  assert.equal(state.themeMode, 'day');
});
