const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

navToggle.addEventListener('click', () => {
  const isOpen = navLinks.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
});

navLinks.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
  });
});

/* ============================================
   Live status clock — Eastern time, matches the Central Florida
   client base. Updates every 30s, no need for per-second ticks.
   ============================================ */
function updateLiveClock() {
  const el = document.getElementById('liveClock');
  if (!el) return;
  const time = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  }).format(new Date());
  el.textContent = `${time} ET`;
}
updateLiveClock();
setInterval(updateLiveClock, 30000);

/* ============================================
   Scroll-pinned media feature — drives the crossfade/zoom between
   images as the user scrolls through a tall, sticky-pinned track.
   Generic: works for any .scroll-feature with N images + N captions,
   so future client sections (roofing, electrical, etc.) can reuse it
   by copying the markup and swapping media/captions only.
   ============================================ */
function initScrollFeature(root) {
  const track = root.querySelector('.scroll-feature-track');
  const images = root.querySelectorAll('.scroll-feature-img');
  const textItems = root.querySelectorAll('.scroll-feature-text-item');
  const indexEl = root.querySelector('.scroll-feature-index');
  if (!track || !images.length) return;

  const panels = parseInt(getComputedStyle(track).getPropertyValue('--panels'), 10) || images.length;

  images[0].classList.add('is-active');
  if (textItems[0]) textItems[0].classList.add('is-active');

  let ticking = false;

  const update = () => {
    const rect = track.getBoundingClientRect();
    const scrollDistance = rect.height - window.innerHeight;
    const progress = scrollDistance > 0
      ? Math.min(Math.max(-rect.top / scrollDistance, 0), 0.9999)
      : 0;
    const activeIndex = Math.floor(progress * panels);

    images.forEach((img, i) => img.classList.toggle('is-active', i === activeIndex));
    textItems.forEach((el, i) => el.classList.toggle('is-active', i === activeIndex));
    if (indexEl) indexEl.textContent = String(activeIndex + 1).padStart(2, '0');

    ticking = false;
  };

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });

  update();
}

document.querySelectorAll('.scroll-feature').forEach(initScrollFeature);

/* ============================================
   3D depth layer — pointer-tracked card tilt + hero parallax.
   Only runs on devices with a fine pointer and real hover
   (skips touch/mobile so nothing feels janky there).
   ============================================ */
const supportsHoverTilt = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

if (supportsHoverTilt) {
  document.body.classList.add('tilt-active');

  document.querySelectorAll('.tilt-card').forEach((card) => {
    const maxTilt = parseFloat(card.dataset.tiltMax || '8');

    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;

      const rotateY = (px - 0.5) * maxTilt * 2;
      const rotateX = (0.5 - py) * maxTilt * 2;

      card.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(4px)`;
      card.style.setProperty('--px', `${px * 100}%`);
      card.style.setProperty('--py', `${py * 100}%`);
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) translateZ(0px)';
    });
  });

  const heroParallax = document.getElementById('heroParallax');
  if (heroParallax) {
    let mouseX = 0;
    let mouseY = 0;
    let scrollOffset = 0;

    const applyHeroTransform = () => {
      heroParallax.style.transform = `translate(${mouseX}px, ${mouseY + scrollOffset}px)`;
    };

    window.addEventListener('mousemove', (e) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 14;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 14;
      applyHeroTransform();
    });

    window.addEventListener('scroll', () => {
      scrollOffset = Math.min(window.scrollY * 0.15, 60);
      applyHeroTransform();
    }, { passive: true });
  }
}
