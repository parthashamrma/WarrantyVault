import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

export const LandingPage: React.FC = () => {

  const headlineRef = useRef<HTMLHeadingElement>(null);
  const storyRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const numRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLSpanElement>(null);
  const unitRef = useRef<HTMLSpanElement>(null);
  const capRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const slipwRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLElement>(null);
  const cardRefs = useRef<(HTMLElement | null)[]>([]);
  const phaseRef = useRef<number>(-1);

  useEffect(() => {
    // 1. Word-by-word headline animation (exact recursion and span wrapping)
    if (headlineRef.current) {
      const h = headlineRef.current;
      let i = 0;
      const wrap = (node: Node) => {
        [...node.childNodes].forEach((c) => {
          if (c.nodeType === 3) {
            const text = c.textContent || '';
            const f = document.createDocumentFragment();
            text.split(/(\s+)/).forEach((t) => {
              if (!t.trim()) {
                f.append(t);
                return;
              }
              const w = document.createElement('span');
              w.className = 'w';
              const s = document.createElement('span');
              s.textContent = t;
              s.style.setProperty('--d', `${0.15 + i++ * 0.07}s`);
              w.append(s);
              f.append(w);
            });
            c.replaceWith(f);
          } else {
            wrap(c);
          }
        });
      };
      wrap(h);
    }

    // 2. IntersectionObserver for reveals (.rv) and typewriter code block (.code)
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.18 }
    );

    const revealElements = document.querySelectorAll('.rv, .code');
    revealElements.forEach((el) => io.observe(el));

    // 3. Scroll maths and single rAF handler
    const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

    const anchors = [
      [0, 365],
      [0.4, 30],
      [0.6, 15],
      [0.75, 7],
      [0.9, 0],
      [1, -1],
    ];

    const days = (p: number) => {
      for (let j = 1; j < anchors.length; j++) {
        const [a, b] = anchors[j - 1];
        const [c, d] = anchors[j];
        if (p <= c) return b + ((d - b) * (p - a)) / (c - a);
      }
      return -1;
    };

    const caps = [
      'Covered. Nothing to do. Go live your life.',
      '◉ Notice · 30 days left. Your vault taps you on the shoulder.',
      '◉ Notice · 15 days left. Still time to get that rattle checked.',
      '◉ Notice · 7 days left. Last call.',
      'Expired. A drawer would never have told you.',
    ];

    let tick = false;

    const frame = () => {
      tick = false;

      const vh = window.innerHeight;
      const y = window.scrollY;

      // Top progress bar
      const bar = document.getElementById('bar');
      if (bar) {
        const totalHeight = document.documentElement.scrollHeight - vh;
        bar.style.transform = `scaleX(${totalHeight > 0 ? clamp(y / totalHeight) : 0})`;
      }

      // Slip parallax & tilt
      if (slipwRef.current && y < vh * 1.3) {
        slipwRef.current.style.transform = `translateY(${y * 0.14}px) rotate(${-2.5 + y * 0.006}deg)`;
      }

      // Story Section
      if (storyRef.current && numRef.current && badgeRef.current && unitRef.current && capRef.current && fillRef.current) {
        const st = storyRef.current;
        const r = st.getBoundingClientRect();
        const p = clamp(-r.top / (r.height - vh));
        const d = Math.round(days(p));

        numRef.current.textContent = String(Math.max(d, 0));

        const s =
          d > 30
            ? ['--g', 'Active', '#fff', 0]
            : d >= 0
            ? ['--a', 'Expiring Soon', '#16130F', d > 15 ? 1 : d > 7 ? 2 : 3]
            : ['--r', 'Expired', '#fff', 4];

        st.style.setProperty('--sig', `var(${s[0]})`);
        st.style.setProperty('--on', s[2] as string);
        badgeRef.current.textContent = s[1] as string;
        unitRef.current.textContent = d < 0 ? 'warranty over' : d === 1 ? 'day left' : 'days left';
        fillRef.current.style.transform = `scaleX(${p})`;

        const ticks = st.querySelectorAll<HTMLElement>('.tick');
        ticks.forEach((t) => {
          const tp = parseFloat(t.dataset.p || '0');
          t.classList.toggle('on', p >= tp);
        });

        if (s[3] !== phaseRef.current) {
          phaseRef.current = s[3] as number;
          capRef.current.textContent = caps[phaseRef.current];
          if (capRef.current.animate) {
            capRef.current.animate(
              [
                { opacity: 0, transform: 'translateY(10px)' },
                { opacity: 1, transform: 'none' },
              ],
              { duration: 350, easing: 'ease-out' }
            );
          }
        }
      }

      // Stacked cards shrink physics as next card overlaps
      const cards = cardRefs.current.filter(Boolean) as HTMLElement[];
      cards.forEach((c, idx) => {
        const next = cards[idx + 1];
        if (!next) return;
        const t = clamp(1 - (next.getBoundingClientRect().top - (0.11 * vh + (idx + 1) * 28)) / (vh * 0.7));
        c.style.transform = `scale(${1 - 0.045 * t})`;
        c.style.filter = `brightness(${1 - 0.12 * t})`;
      });

      // Steps vertical progress line
      if (stepsRef.current && lineRef.current) {
        const sr = stepsRef.current.getBoundingClientRect();
        lineRef.current.style.transform = `scaleY(${clamp((vh * 0.65 - sr.top) / sr.height)})`;
      }
    };

    const req = () => {
      if (!tick) {
        tick = true;
        requestAnimationFrame(frame);
      }
    };

    window.addEventListener('scroll', req, { passive: true });
    window.addEventListener('resize', req);
    frame();

    return () => {
      window.removeEventListener('scroll', req);
      window.removeEventListener('resize', req);
      io.disconnect();
    };
  }, []);

  return (
    <div id="home">
      <main id="top">
        {/* 1. HERO SECTION */}
        <section className="hero">
          <div>
            <div className="kick">Warranty storage · Reminders · Private by default</div>
            <h1 className="split" ref={headlineRef}>
              You’ll need the warranty the day <em>after it expires.</em>
            </h1>
            <p className="lead rv" style={{ '--d': '.9s' } as any}>
              WarrantyVault keeps every receipt, warranty card and expiry date in one private vault, and nudges you at 30,
              15 and 7 days — while there’s still time to use it.
            </p>
            <div className="cta rv" style={{ '--d': '1.1s' } as any}>
              <Link className="btn" to="/register">
                Open your vault
              </Link>
              <a className="btn o" href="#story">
                Watch a warranty age ↓
              </a>
            </div>
          </div>

          {/* Receipt slip with zigzag mask and printing animation */}
          <div className="slipw" id="slipw" ref={slipwRef}>
            <div className="slip">
              <h4>WARRANTYVAULT</h4>
              <small>YOUR SHELF · TODAY</small>
              <div className="row" style={{ '--i': 0 } as any}>
                <div>
                  LG Front-Load Washer<span>expires in 19 days</span>
                </div>
                <i className="b a">Expiring soon</i>
              </div>
              <div className="row" style={{ '--i': 1 } as any}>
                <div>
                  Sony WH-1000XM5<span>expires in 412 days</span>
                </div>
                <i className="b g">Active</i>
              </div>
              <div className="row" style={{ '--i': 2 } as any}>
                <div>
                  Dell XPS 15<span>expired 3 days ago</span>
                </div>
                <i className="b r">Expired</i>
              </div>
              <div className="tot">3 items · 1 needs you</div>
            </div>
          </div>
        </section>

        {/* 2. MARQUEE STRIP */}
        <div className="mq" aria-hidden="true">
          <div>
            Laptops ✦ Washing machines ✦ Headphones ✦ Air conditioners ✦ Cameras ✦ Phones ✦ Refrigerators ✦ Watches ✦{' '}
            Laptops ✦ Washing machines ✦ Headphones ✦ Air conditioners ✦ Cameras ✦ Phones ✦ Refrigerators ✦ Watches ✦{' '}
            Laptops ✦ Washing machines ✦ Headphones ✦ Air conditioners ✦ Cameras ✦ Phones ✦ Refrigerators ✦ Watches ✦{' '}
            Laptops ✦ Washing machines ✦ Headphones ✦ Air conditioners ✦ Cameras ✦ Phones ✦ Refrigerators ✦ Watches ✦{' '}
            Laptops ✦ Washing machines ✦ Headphones ✦ Air conditioners ✦ Cameras ✦ Phones ✦ Refrigerators ✦ Watches ✦{' '}
            Laptops ✦ Washing machines ✦ Headphones ✦ Air conditioners ✦ Cameras ✦ Phones ✦ Refrigerators ✦ Watches ✦{' '}
          </div>
        </div>

        {/* 3. THE PAUSE-WHILE-SCROLLING STORY SECTION */}
        <section id="story" ref={storyRef}>
          <div className="stage" ref={stageRef}>
            <div className="meta">
              <span>The life of a warranty</span>
              <span>LG Front-Load Washer · 12-month cover</span>
            </div>
            <div className="num" id="num" ref={numRef} aria-live="off">
              365
            </div>
            <div className="lab">
              <span className="badge" id="badge" ref={badgeRef}>
                Active
              </span>
              <span id="unit" ref={unitRef}>
                days left
              </span>
            </div>
            <div className="cap" id="cap" ref={capRef}>
              Covered. Nothing to do. Go live your life.
            </div>
            <div className="tl">
              <div className="fill" id="fill" ref={fillRef}></div>
              <div className="tick" style={{ '--p': 0 } as any} data-p="0">
                <span>bought</span>
              </div>
              <div className="tick" style={{ '--p': 0.4 } as any} data-p=".4">
                <span>30d</span>
              </div>
              <div className="tick" style={{ '--p': 0.6 } as any} data-p=".6">
                <span>15d</span>
              </div>
              <div className="tick" style={{ '--p': 0.75 } as any} data-p=".75">
                <span>7d</span>
              </div>
              <div className="tick" style={{ '--p': 0.9 } as any} data-p=".9">
                <span>end</span>
              </div>
            </div>
          </div>
        </section>

        {/* 4. FEATURES: STACKING CARDS */}
        <section className="sec" id="features">
          <div className="eyebrow rv">What’s in the vault</div>
          <h2 className="rv">
            Four drawers. <em>Nothing</em> to remember.
          </h2>
          <div className="stack">
            {/* Card 01 */}
            <article
              ref={(el) => {
                cardRefs.current[0] = el;
              }}
              className="card"
              style={{ '--i': 0, '--c': 'var(--g)', '--tc': '#fff' } as any}
            >
              <span className="tab">01 / Products &amp; warranties</span>
              <div>
                <span className="n">01</span>
                <h3>Type the date. The expiry does itself.</h3>
                <p>
                  Add a product, a purchase date and a duration in months. WarrantyVault works out the expiry and the
                  status, and rejects dates that don’t add up.
                </p>
              </div>
              <div className="mini">
                purchase_date 2025-01-12
                {'\n'}duration_months 24
                {'\n'}expiry_date <span className="ok">2027-01-12 ← computed</span>
                {'\n'}status <span className="ok">ACTIVE</span>
              </div>
            </article>

            {/* Card 02 */}
            <article
              ref={(el) => {
                cardRefs.current[1] = el;
              }}
              className="card"
              style={{ '--i': 1, '--c': 'var(--a)', '--tc': '#16130F' } as any}
            >
              <span className="tab">02 / Documents</span>
              <div>
                <span className="n">02</span>
                <h3>The invoice, attached for good.</h3>
                <p>
                  Upload invoices, warranty cards and receipts. PDF, JPG or PNG up to 5 MB, renamed to safe random
                  filenames and opened only through short-lived signed links.
                </p>
              </div>
              <div className="mini">
                invoice.pdf → 7f3a…e91.pdf <span className="ok">✓ 4.1 MB</span>
                {'\n'}card.jpg → c02b…4d7.jpg <span className="ok">✓ 1.2 MB</span>
                {'\n'}notes.exe → <span className="no">rejected · PDF, JPG, PNG only</span>
              </div>
            </article>

            {/* Card 03 */}
            <article
              ref={(el) => {
                cardRefs.current[2] = el;
              }}
              className="card"
              style={{ '--i': 2, '--c': 'var(--r)', '--tc': '#fff' } as any}
            >
              <span className="tab">03 / Reminders</span>
              <div>
                <span className="n">03</span>
                <h3>A tap on the shoulder, before it’s late.</h3>
                <p>
                  A daily job checks every warranty and drops a notification at your thresholds — 30, 15 and 7 days by
                  default. Never twice for the same one. Unread count lives in the navbar.
                </p>
              </div>
              <div className="mini">
                day 30 → <span className="am">◉ notice</span>
                {'\n'}day 15 → <span className="am">◉ notice</span>
                {'\n'}day 7 → <span className="am">◉ notice</span>
                {'\n'}duplicates? <span className="no">never</span>
              </div>
            </article>

            {/* Card 04 */}
            <article
              ref={(el) => {
                cardRefs.current[3] = el;
              }}
              className="card"
              style={{ '--i': 3, '--c': 'var(--ink)', '--tc': 'var(--bg)' } as any}
            >
              <span className="tab">04 / Dashboard &amp; search</span>
              <div>
                <span className="n">04</span>
                <h3>Find it in seconds. See it at a glance.</h3>
                <p>
                  Totals for active, expiring and expired, a list of what runs out first, and search by keyword with
                  filters for category, brand and status.
                </p>
              </div>
              <div className="mini">
                <div className="chips">
                  <i>All</i>
                  <i>Active</i>
                  <i>Expiring soon</i>
                  <i>Expired</i>
                </div>
                Total 12 · Active 7 · Soon 3 · Expired 2{'\n'}
                sort: <span className="am">expires first ↑</span>
              </div>
            </article>
          </div>
        </section>

        {/* 5. HOW IT WORKS */}
        <section className="sec" id="how">
          <div className="eyebrow rv">How it works</div>
          <h2 className="rv">
            Add. Attach. <em>Forget.</em>
          </h2>
          <div className="steps" id="steps" ref={stepsRef}>
            <div className="line">
              <i id="line" ref={lineRef}></i>
            </div>
            <div className="step rv">
              <small>Step one</small>
              <h3>Add it.</h3>
              <p>
                Product, purchase date, duration and coverage notes in one short flow. Dates are validated before anything
                is saved.
              </p>
            </div>
            <div className="step rv">
              <small>Step two</small>
              <h3>Attach it.</h3>
              <p>
                Snap the invoice or drop the PDF. It’s stored privately and linked to that warranty, ready when you need
                proof.
              </p>
            </div>
            <div className="step rv">
              <small>Step three</small>
              <h3>Forget it.</h3>
              <p>
                The vault watches the calendar. You hear from it at 30, 15 and 7 days, or whichever thresholds you set in
                your profile.
              </p>
            </div>
          </div>
        </section>

        {/* 7. CLOSING CTA */}
        <section className="sec end">
          <div className="eyebrow rv">Before the drawer wins</div>
          <h2 className="rv">Open the vault before you need it.</h2>
          <Link className="btn rv" to="/register">
            Create your vault
          </Link>
        </section>
      </main>

      {/* 8. FOOTER */}
      <footer className="ref-footer">
        <span>© WarrantyVault</span>
        <p>
          WarrantyVault tracks information you enter and does not guarantee warranty eligibility. Date convention: expiry
          = purchase date + duration, and the expiry date itself is still covered; a warranty is Expired the day after.
        </p>
      </footer>
    </div>
  );
};
