import { useEffect } from 'react';
import type { ThemePreference } from '@trip-planner/core';

/**
 * Applies the `dark` class to <html> based on user preference + system media query.
 * Call once from App root.
 */
export function useTheme(theme: ThemePreference) {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');

    function apply() {
      const isDark =
        theme === 'dark' || (theme === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', isDark);

      // Update theme-color meta
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) {
        meta.setAttribute('content', isDark ? '#111827' : '#ffffff');
      }
    }

    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}
