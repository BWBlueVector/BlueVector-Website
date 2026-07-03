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
   Contact form — submits straight into the BlueVector HubSpot CRM
   via the Forms Submission API (no HubSpot embed widget, since this
   portal's forms aren't compatible with the classic embed script).
   ============================================ */
const contactForm = document.getElementById('contactForm');
if (contactForm) {
  const HUBSPOT_PORTAL_ID = '246629302';
  const HUBSPOT_FORM_GUID = 'bef409e3-a93e-4261-bb50-b923050e9531';

  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const statusEl = document.getElementById('formStatus');
    const submitBtn = document.getElementById('contactSubmit');

    const fields = [
      { objectTypeId: '0-1', name: 'firstname', value: contactForm.firstname.value },
      { objectTypeId: '0-1', name: 'lastname', value: contactForm.lastname.value },
      { objectTypeId: '0-1', name: 'email', value: contactForm.email.value },
      { objectTypeId: '0-1', name: 'phone', value: contactForm.phone.value },
      { objectTypeId: '0-2', name: 'name', value: contactForm.company.value },
      { objectTypeId: '0-1', name: 'message', value: contactForm.message.value },
    ].filter((f) => f.value);

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';
    statusEl.textContent = '';
    statusEl.className = 'form-status';

    try {
      const res = await fetch(
        `https://api.hsforms.com/submissions/v3/integration/submit/${HUBSPOT_PORTAL_ID}/${HUBSPOT_FORM_GUID}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields,
            context: { pageUri: window.location.href, pageName: document.title },
          }),
        }
      );

      if (!res.ok) throw new Error('Submission failed');

      statusEl.textContent = "Thanks — we'll be in touch shortly.";
      statusEl.classList.add('success');
      contactForm.reset();
    } catch (err) {
      statusEl.textContent = 'Something went wrong. Please use the email link below instead.';
      statusEl.classList.add('error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send it over';
    }
  });
}

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
