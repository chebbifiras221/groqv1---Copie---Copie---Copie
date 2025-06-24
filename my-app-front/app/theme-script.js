// This script runs before React hydration to set the initial theme
(function() {                                                    // Immediately invoked function to avoid global variables
  try {                                                          // Wrap in try-catch for error handling
    const savedTheme = localStorage.getItem('theme');           // Get saved theme from browser storage
    if (savedTheme === 'light') {                              // If user prefers light theme
      document.documentElement.classList.add('light-theme');   // Add light theme CSS class to html element
      document.documentElement.classList.remove('dark');       // Remove dark theme CSS class
      document.body.style.backgroundColor = '#ffffff';         // Set white background color
      document.body.style.color = '#24292f';                   // Set dark text color for readability
    } else {                                                     // Default to dark theme (or if 'dark' is saved)
      document.documentElement.classList.remove('light-theme'); // Remove light theme CSS class
      document.documentElement.classList.add('dark');          // Add dark theme CSS class to html element
      document.body.style.backgroundColor = '#0d1117';         // Set dark background color (GitHub dark)
      document.body.style.color = '#e6edf3';                   // Set light text color for readability
    }
  } catch {                                                      // If localStorage is not available (private browsing)
    // Silently handle theme errors                             // Don't break the page, just use default theme
  }
})();                                                            // Execute the function immediately
