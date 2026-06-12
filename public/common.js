const siteHeader = document.querySelector('.site-header');
const burgerBtn = document.querySelector('#burger-btn');
const themeToggleBtn = document.querySelector('#theme-toggle-btn');

function getThemePreference() {
  return localStorage.getItem('scientific_calc_theme') || 'light';
}

function isGoldUnlocked() {
  return localStorage.getItem('unlocked_gold') === '1';
}

function applyTheme() {
  document.body.classList.remove('dark-theme', 'gold-theme');

  if (isGoldUnlocked()) {
    document.body.classList.add('gold-theme');
  } else if (getThemePreference() === 'dark') {
    document.body.classList.add('dark-theme');
  }
}

applyTheme();

if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', () => {
    if (isGoldUnlocked()) {
      document.body.classList.toggle('gold-theme');
      if (!document.body.classList.contains('gold-theme') && getThemePreference() === 'dark') {
        document.body.classList.add('dark-theme');
      }
    } else {
      document.body.classList.toggle('dark-theme');
      const isDark = document.body.classList.contains('dark-theme');
      localStorage.setItem('scientific_calc_theme', isDark ? 'dark' : 'light');
    }
  });
}

if (burgerBtn && siteHeader) {
  burgerBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    const isOpen = siteHeader.classList.toggle('nav-open');
    burgerBtn.setAttribute('aria-expanded', String(isOpen));
  });

  document.addEventListener('click', (event) => {
    if (!siteHeader.contains(event.target)) {
      siteHeader.classList.remove('nav-open');
      burgerBtn.setAttribute('aria-expanded', 'false');
    }
  });
}
