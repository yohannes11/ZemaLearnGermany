// ZemaLearn landing page: gentle reveals, counting statistics, the pace calculator, audio samples and
// the mobile call-to-action. Everything degrades gracefully: without JavaScript the page is complete.
(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Sections fade in as they scroll into view.
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    reveals.forEach(el => observer.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('in'));
  }

  // Large whole numbers count up once; the final text is always the exact figure from the page.
  const counters = [...document.querySelectorAll('.stat-value[data-count]')]
    .filter(el => /^\d[\d,]*$/.test(el.dataset.display) && Number(el.dataset.count) >= 1000);
  if ('IntersectionObserver' in window && !reduceMotion) {
    const countObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        countObserver.unobserve(entry.target);
        const el = entry.target;
        const target = Number(el.dataset.count);
        const start = performance.now();
        const duration = 1400;
        const step = now => {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          el.textContent = t < 1 ? Math.round(target * eased).toLocaleString('en-US') : el.dataset.display;
          if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }, { threshold: 0.6 });
    counters.forEach(el => countObserver.observe(el));
  }

  // Pace calculator: how long the course's own word list takes at a chosen daily pace.
  const calc = document.querySelector('.calc');
  if (calc) {
    const words = Number(calc.dataset.words);
    const range = calc.querySelector('#calc-range');
    const out = calc.querySelector('#calc-out');
    const weeks = calc.querySelector('#calc-weeks');
    const update = () => {
      const perDay = Number(range.value);
      const days = Math.ceil(words / perDay);
      const w = Math.round(days / 7);
      out.textContent = perDay;
      // The labels come from the page, in the page's language: "{n} days" / "{n} weeks".
      weeks.textContent = (days < 14 ? calc.dataset.daysLabel : calc.dataset.weeksLabel).replace('{n}', days < 14 ? days : w);
    };
    range.addEventListener('input', update);
    update();
  }

  // Audio samples from the course's own recordings.
  let current = null;
  document.querySelectorAll('.sample-word').forEach(button => {
    button.addEventListener('click', () => {
      if (current) { current.audio.pause(); current.button.classList.remove('playing'); }
      const audio = new Audio(button.dataset.src);
      current = { audio, button };
      button.classList.add('playing');
      audio.addEventListener('ended', () => button.classList.remove('playing'));
      audio.play().catch(() => button.classList.remove('playing'));
    });
  });

  // Returning visitors who already practised as guests see "Continue learning".
  try {
    const learned = JSON.parse(localStorage.getItem('book-learned') || '[]');
    if (Array.isArray(learned) && learned.length) {
      document.querySelectorAll('[data-continue-label]').forEach(link => {
        link.firstChild.textContent = `${link.dataset.continueLabel} `;
        link.href = link.href.split('#')[0];
      });
    }
  } catch (e) { /* storage unavailable: keep the default call to action */ }

  // Phones: a slim call to action appears after the hero and hides again at the final section.
  const sticky = document.getElementById('sticky-cta');
  const hero = document.querySelector('.hero');
  const final = document.querySelector('.final');
  if (sticky && hero && final && 'IntersectionObserver' in window) {
    sticky.hidden = false;
    const seen = { hero: true, final: false };
    const toggle = () => sticky.classList.toggle('show', !seen.hero && !seen.final);
    new IntersectionObserver(([e]) => { seen.hero = e.isIntersecting; toggle(); }).observe(hero);
    new IntersectionObserver(([e]) => { seen.final = e.isIntersecting; toggle(); }).observe(final);
  }
})();
