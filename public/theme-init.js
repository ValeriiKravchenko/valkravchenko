// Sets data-theme on <html> before the first paint.
// Same logic as resolveTheme() in src/theme/resolveTheme.ts.
(function () {
  var theme = null;
  try {
    var stored = localStorage.getItem('sky-os.theme');
    if (stored === 'day' || stored === 'night') theme = stored;
  } catch {
    // Storage is unavailable: fall back to the system theme.
  }
  if (theme === null) {
    var dark = false;
    try {
      dark = matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      // No matchMedia: use the day theme.
    }
    theme = dark ? 'night' : 'day';
  }
  document.documentElement.setAttribute('data-theme', theme);
})();
