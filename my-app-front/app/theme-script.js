// This script runs before React hydration to set the initial theme
(function() {
  try {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      document.documentElement.classList.add('light-theme');
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '#ffffff';
      document.body.style.color = '#24292f';
    } else {
      document.documentElement.classList.remove('light-theme');
      document.documentElement.classList.add('dark');
      document.body.style.backgroundColor = '#0d1117';
      document.body.style.color = '#e6edf3';
    }
  } catch (e) {
    console.error('Error applying theme:', e);
  }
})();
