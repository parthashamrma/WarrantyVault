# WarrantyVault: Full UI, Animation and Auth-Flow Build Prompt

Paste everything below the line into Antigravity. It is written from the actual reference file (`WarrantyVault___You_ll_need_it_the_day_after_it_expires.html`), so every number, easing curve and layout value is the one the reference uses.

---

## 0. Role and goal

You are rebuilding the **WarrantyVault** landing page, login page, signup page and forgot-password page so they match the reference HTML file **exactly** in layout, spacing, typography, colour, animation and scroll behaviour. Do not redesign. Do not add libraries for scroll effects. Do not add a smooth-scroll or scroll-jacking library (no Lenis, GSAP ScrollTrigger pinning, Locomotive, fullPage.js). Every scroll effect in the reference is built with **native CSS `position: sticky`, `IntersectionObserver`, and one `requestAnimationFrame` scroll handler**. Reproduce it that way.

**Route protection is a hard requirement:** nobody may reach the dashboard without first signing up or logging in (Section 9).

---

## 1. Design tokens (use these exact values)

**Fonts** (Google Fonts): `Instrument Serif` (headings, big numbers), `Instrument Sans` (body, weights 400/500/600), `DM Mono` (labels, buttons, captions, weights 400/500). Always give fallbacks: serif → Georgia, mono → ui-monospace/Menlo, sans → system-ui.

**Light theme**

- `--bg #ECE6D8` (warm paper), `--bg2 #E3DCCA` (cards), `--ink #16130F`, `--mut #6D665B` (muted text), `--line rgba(22,19,15,.18)`
- `--g #1F7A4D` (active/green), `--a #D48400` (amber/expiring), `--r #C4301E` (red/expired)

**Dark theme** (via `prefers-color-scheme: dark` unless `data-theme="light"`, and via `data-theme="dark"`)

- `--bg #13110E`, `--bg2 #1D1A16`, `--ink #ECE6D8`, `--mut #9C9487`, `--line rgba(236,230,216,.2)`, `--g #4CC38A`, `--a #F2B134`, `--r #FF6B55`

**Always-dark sections** (security section, auth left panel): background `#0E0C0A`, text `#ECE6D8`, muted `#A39B8E`, line `rgba(236,230,216,.22)`, code block bg `#15120F`.

**Global rules**

- `body`: margin 0, `font: 400 1.0625rem/1.55 Instrument Sans`, `overflow-x: hidden`.
- **Paper grain overlay:** `body::after`, `position: fixed; inset: 0; pointer-events: none; z-index: 90; opacity: .07; mix-blend-mode: multiply;` with an inline SVG `feTurbulence` (fractalNoise, baseFrequency .9, 2 octaves, 160×160 tile) as background image.
- `html { scroll-behavior: smooth; scroll-padding-top: calc(70px + env(safe-area-inset-top)); }`
- Focus ring: `:focus-visible { outline: 2px solid var(--sig, var(--g)); outline-offset: 3px }`
- Corners are nearly square: buttons and inputs `2px`, cards `3px`, only badges/chips are fully round (`99px`). No soft shadows on UI; the only shadows are the hard offset ones described below.
- Mobile: viewport `width=device-width, initial-scale=1, viewport-fit=cover`; root uses `padding-top/bottom: env(safe-area-inset-*)`.

---

## 2. Layout and margin system (shared by landing and auth pages)

**Horizontal page gutter everywhere:** `clamp(18px, 4vw, 56px)` (nav, hero, every section, story stage, footer).

**Vertical section rhythm:** `.sec` padding = `clamp(80px, 12vw, 160px)` top/bottom, with the horizontal gutter above.

**Navbar** (fixed, top 0, z-index 50, full width): flex, space-between, vertical padding `14px` (top adds safe-area inset), background `var(--bg)` (solid, no blur), `border-bottom: 1px solid var(--line)`. Total height is about 62–70px, which is why the auth page uses `padding-top: 62px` and anchors use `scroll-padding-top: 70px`.

**Hero:** `min-height: 100svh`, padding `120px gutter 56px`, CSS grid `1.3fr .7fr`, gap `48px`, `align-items: center`. At ≤900px: single column, top padding `100px`.

**Story section stage:** padding `70px gutter 20px` (the 70px clears the navbar).

**Feature cards:** card padding `clamp(26px, 4vw, 56px)`, inner grid `1.05fr .95fr` gap `36px`; ≤820px single column, gap `20px`, `min-height: 0`.

**Security grid:** two columns `1fr 1fr`, gap `clamp(32px, 6vw, 90px)`, ≤900px single column.

**Steps:** left padding `clamp(26px, 6vw, 84px)`, `margin-top: 40px`; each step has `padding: 6vh 0`, `max-width: 44rem`.

**Footer:** padding `28px gutter 40px`, top border, flex wrap, gap 24px, mono 0.74rem.

**Auth page:** `min-height: 100svh`, grid `1fr 1fr`, `padding-top: 62px`. Right pane padding `clamp(24px, 5vw, 64px)`, content column `max-width: 26rem`, centred both ways. Left aside padding `clamp(24px, 4vw, 56px)`, vertical gap `clamp(20px, 4vh, 48px)`. Form field spacing: `margin-bottom: 16px` per field, label `margin-bottom: 8px`, error line `min-height: 1.4em` (reserved so the layout never jumps when an error appears), back link `margin-bottom: 30px`, lede `margin-bottom: 28px`, heading `margin-bottom: 10px`, bottom links `margin-top: 22px`.

---

## 3. Shared components

**Buttons (`.btn`)**: DM Mono 500, 0.82rem, uppercase, letter-spacing .08em, padding `.9em 1.4em`, 1.5px solid ink border, ink background with bg-coloured text, radius 2px. Variants: `.o` outline (transparent, ink text), `.sm` smaller (`.65em 1.1em`), `.sub` full width with `margin-top: 6px`. **Hover:** translate `(-3px, -3px)` and add `box-shadow: 3px 3px 0 var(--sig, var(--g))` (a hard offset block, transition .2s). Disabled: opacity .6, `cursor: wait`.

**Eyebrow / kicker labels**: DM Mono 500, 0.76rem, uppercase, letter-spacing .16em, muted colour, `margin-bottom: 22px`.

**Headings**: `h1` = Instrument Serif, `clamp(2.9rem, 7.6vw, 7.4rem)`, line-height .92, letter-spacing -.02em. `h2` = `clamp(2.4rem, 5.6vw, 5.2rem)`, line-height .98, `max-width: 17ch`. In both, `<em>` text is red (`--r`) and not italic-styled by default colour logic (the italic Instrument Serif face is used).

**Badge pills (`.b`)**: tiny round pills, white text, uppercase; green `#1F7A4D`, amber `#B87100`, red `#C4301E`.

---

## 4. Landing page: every section, top to bottom

### 4.1 Top progress bar (`#bar`)

Fixed, top 0, 3px tall, ink colour, z-index 60, `transform: scaleX(p)` with `transform-origin: left`. `p = scrollY / (document height - viewport height)`. Reset to 0 on auth pages.

### 4.2 Navbar

Left: logo (20px SVG vault icon: rounded square outline, filled dot, short stem, plus the word WarrantyVault in mono, uppercase, letter-spacing .14em). Right links, mono 0.78rem uppercase: **The clock** (#story), **Features**, **Security**, **How it works**, then `Sign in` (outline small button, goes to `/login`) and `Get started` (solid small button, goes to `/register`). Text links get an underline with `text-underline-offset: 5px` on hover. At ≤820px hide the text links and keep only the two buttons.

### 4.3 Hero

- Kicker: `Warranty storage · Reminders · Private by default`.
- **Headline: “You’ll need the warranty the day *after it expires.*”** Animated **word by word**: JS splits every word into `.w` (inline-block, `overflow: hidden`, padding `0 .06em .1em 0`, `margin-bottom: -.1em`) containing an inner span that starts at `translateY(108%)` and animates to `none` over **.9s** with `cubic-bezier(.2,.8,.2,1)`, `animation-fill-mode: forwards`. Stagger: delay = `.15s + index × .07s`. Words inside `<em>` are split too (recurse through child nodes).
- Lead paragraph (max-width 34rem, muted, 1.15rem, margin-bottom 34px) uses the **reveal** class with delay `.9s`.
- CTA row (flex, gap 14px, wrap) with delay `1.1s`: `Open your vault` (solid, `/register`) and `Watch a warranty age ↓` (outline, scrolls to #story).
- **Right side: the receipt slip.** Width `min(340px, 100%)`, centred, `filter: drop-shadow(0 26px 22px rgba(0,0,0,.28))`. Cream paper `#F8F4EA`, dark text, DM Mono .78rem, padding `22px 20px 40px`. The bottom edge is a **zig-zag torn edge** made with a conic-gradient mask (`conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) 50% / 18px 100%`). Header “WARRANTYVAULT” centred with letter-spacing .2em; sub-line “YOUR SHELF · TODAY” with dashed bottom border.
- **Print animation:** the slip reveals top to bottom with `clip-path: inset(0 0 100% 0)` → `inset(0)` over **1.5s**, delay **.4s**, `cubic-bezier(.3,.7,.2,1)`.
- Three rows fade in sequentially, delay `1.3s + rowIndex × .35s`, .5s fade each: LG Front-Load Washer (expires in 19 days, amber “Expiring soon”), Sony WH-1000XM5 (expires in 412 days, green “Active”), Dell XPS 15 (expired 3 days ago, red “Expired”). Footer line: “3 items · 1 needs you”. Rows have dashed bottom borders.
- **Scroll parallax:** while `scrollY < 1.3 × viewport height`, set `transform: translateY(scrollY × .14px) rotate(-2.5deg + scrollY × .006deg)`. Stop updating after that.

### 4.4 Marquee strip (`.mq`)

Full-width band with top and bottom 1px borders, `padding: 15px 0`, mono .8rem uppercase letter-spacing .16em, `overflow: hidden; white-space: nowrap`. Text: `Laptops ✦ Washing machines ✦ Headphones ✦ Air conditioners ✦ Cameras ✦ Phones ✦ Refrigerators ✦ Watches ✦`. JS repeats that string **6 times** inside one inline-block; CSS animates `translateX(0 → -50%)` over **50s linear infinite** (seamless because the half-point lands on a repeat boundary). No pause on hover.

### 4.5 THE PAUSE-WHILE-SCROLLING SECTION: “The clock” (`#story`)

This is the part Antigravity gets wrong. **It is not a scroll-jack and not a timed animation.** It is a tall section with a sticky child; the page scrolls normally but the screen *looks* paused because the stage stays pinned while numbers change.

**Structure and CSS (copy exactly):**

- `#story { height: 520vh; position: relative; }` This 520vh of scroll distance is the “pause”.
- `.stage { position: sticky; top: 0; height: 100svh; display: flex; flex-direction: column; justify-content: center; overflow: hidden; }` Background = `color-mix(in srgb, var(--sig) 12%, var(--bg))` with `transition: background .5s`.
- **No ancestor of `.stage` may have `overflow` other than `visible`, `transform`, `filter`, or `contain`.** That silently kills `position: sticky`. Do not wrap `#home`, `main` or `#story` in an overflow container. `overflow-x: hidden` stays on `body` only.
- Do not use `height: 100%` chains; use `100vh` with `100svh` override.

**Scroll maths (JS, inside the rAF handler):**

```
const r = story.getBoundingClientRect();
const p = clamp(-r.top / (r.height - innerHeight), 0, 1);   // 0 to 1 progress through the pin
```

Days-left is **non-linear** so the last 30 days get more scroll room. Linearly interpolate between these anchors `[progress, days]`: `[0,365] [.4,30] [.6,15] [.75,7] [.9,0] [1,-1]`. Round the result.

**What changes with progress:**

- Giant number (`#num`): Instrument Serif, `clamp(7rem, 30vw, 23rem)`, line-height .82, colour `var(--sig)`, shows `max(days, 0)`, starts at 365.
- Status badge (`#badge`): pill with `var(--sig)` background. Text: `Active` when days > 30, `Expiring Soon` when 0 ≤ days ≤ 30, `Expired` when days < 0. Text colour: white on green and red, `#16130F` on amber.
- Unit label: “days left”; “day left” at exactly 1; “warranty over” when expired.
- `--sig` colour variable switches **green → amber → red** (`--g`, `--a`, `--r`), which tints the whole stage background, number and timeline fill (transitions .4–.5s).
- Caption box (`.cap`): mono .9rem, 1.5px ink border, padding `14px 18px`, `max-width: 30rem`, `min-height: 4.6em`, bg `var(--bg)`. Text by phase: 0 “Covered. Nothing to do. Go live your life.” · 1 “◉ Notice · 30 days left. Your vault taps you on the shoulder.” · 2 “◉ Notice · 15 days left. Still time to get that rattle checked.” · 3 “◉ Notice · 7 days left. Last call.” · 4 “Expired. A drawer would never have told you.” Phase = 0 if days > 30; 1 if > 15; 2 if > 7; 3 if ≥ 0; 4 if expired. **Only when the phase changes**, animate the caption with the Web Animations API: opacity 0 and `translateY(10px)` → opacity 1 and none, 350ms ease-out.
- Timeline (`.tl`): 2px line, margin `clamp(32px, 6vh, 60px) 6px 34px`. `.fill` is `transform: scaleX(p)` from the left in `var(--sig)`. Five ticks (16px tall, 2px wide) at positions `0, .4, .6, .75, .9` labelled `bought`, `30d`, `15d`, `7d`, `end`. A tick gets class `on` (colour switches from line colour to `--sig`, label to ink) when `p ≥ its position`.
- Top meta row: `The life of a warranty` (left) and `LG Front-Load Washer · 12-month cover` (right), mono .74rem uppercase muted.
- Use `aria-live="off"` on the number so screen readers are not spammed.

### 4.6 Features: stacking cards (`#features`)

Eyebrow “What’s in the vault”, H2 “Four drawers. *Nothing* to remember.” (both with reveal).

**Second pin effect.** `.stack` has `padding-top: 6vh; padding-bottom: 14vh`. Each `.card` is: `position: sticky; top: calc(11vh + var(--i) × 28px); margin-bottom: 12vh; min-height: 60vh; transform-origin: top center; will-change: transform;` So each card sticks slightly lower than the previous one, leaving a 28px strip of each earlier card visible, like folders in a drawer.

**Shrink-as-covered effect (JS):** for each card except the last, with `n` = next card: `t = clamp(1 − (n.top − (0.11 × vh + (i+1) × 28)) / (vh × 0.7))`; then `card.style.transform = scale(1 − 0.045 × t)` and `card.style.filter = brightness(1 − 0.12 × t)`. The covered card shrinks up to 4.5% and darkens up to 12%.

Card look: `--bg2` background, 1.5px ink border, radius 3px. A **folder tab** sits on top-left (`left: 26px`, translated up 100%, bordered, no bottom border, radius `3px 3px 0 0`, mono .72rem uppercase) filled with the card colour. Inside: huge serif number (`clamp(4rem, 9vw, 8rem)`, line-height .8, card colour), H3 (`clamp(2rem, 4vw, 3.6rem)`), muted paragraph (max-width 30rem), and on the right a **“mini” panel**: dashed 1.5px border, mono .82rem, line-height 1.9, `white-space: pre`, `overflow-x: auto`, padding 20px.

The four cards:

1. **01 / Products & warranties**, green, white tab text. “Type the date. The expiry does itself.” Mini panel shows purchase\_date 2025-01-12, duration\_months 24, expiry\_date 2027-01-12 ← computed (green), status ACTIVE.
2. **02 / Documents**, amber, dark tab text. “The invoice, attached for good.” Mini panel shows invoice.pdf → 7f3a…e91.pdf ✓ 4.1 MB, card.jpg → c02b…4d7.jpg ✓ 1.2 MB, notes.exe → rejected · PDF, JPG, PNG only (red).
3. **03 / Reminders**, red, white tab text. “A tap on the shoulder, before it’s late.” Mini panel lists day 30, 15, 7 with amber ◉ notice, and “duplicates? never” (red).
4. **04 / Dashboard & search**, ink tab with bg-coloured text. “Find it in seconds. See it at a glance.” Mini panel has filter chips (All, Active, Expiring soon, Expired; round, 1.5px ink border) and “Total 12 · Active 7 · Soon 3 · Expired 2 / sort: expires first ↑”.

At ≤820px the cards go single column and `min-height: 0`; sticky stays.

### 4.7 Security (`#security`, always dark)

Two columns. Left: eyebrow “Locked by default”, H2 “Your paperwork. *Your eyes only.*” (em in `#4CC38A`), paragraph, then three **fact rows** (flex, gap 22px, `padding: 20px 0`, top border): big serif `0`, `0`, `All` in green (`clamp(2.6rem, 5vw, 4.2rem)`, min-width 2.2ch) next to a muted sentence. Each fact has the reveal animation.

Right: a **code block** (mono .84rem, line-height 1.8, 1px border, bg `#15120F`, padding `clamp(18px, 3vw, 32px)`, `overflow-x: auto`, `white-space: pre`) showing the RLS SQL and `createSignedUrl(path, 60)`. **Typewriter-style line reveal:** each line is a `span` (display block, starts `opacity: 0; translateX(-14px)`) that transitions to visible over .5s with delay `lineIndex × .2s`, triggered when the block enters view (class `in` via IntersectionObserver). Syntax colours: comments `#7d756a`, keywords amber `#F2B134`, strings green `#4CC38A`.

### 4.8 How it works (`#how`)

Eyebrow, H2 “Add. Attach. *Forget.*”. Three steps (“Step one/two/three”, giant serif H3 `clamp(3rem, 9vw, 8rem)`: Add it. / Attach it. / Forget it.), each with the reveal animation. A **vertical progress line** runs down the left edge: a 2px track (`--line`) with an ink fill that is `scaleY(p)` from the top, where `p = clamp((vh × .65 − steps.top) / steps.height)`.

### 4.9 Closing CTA

Centred section with top border. Eyebrow “Before the drawer wins”, H2 “Open the vault before you need it.” (`clamp(3rem, 9vw, 8.5rem)`, line-height .92), button `Create your vault` → `/register`.

### 4.10 Footer

“© WarrantyVault” plus the disclaimer: “WarrantyVault tracks information you enter and does not guarantee warranty eligibility. Date convention: expiry = purchase date + duration, and the expiry date itself is still covered; a warranty is Expired the day after.”

### 4.11 Reveal-on-scroll (used by many elements)

Class `.rv`: starts `opacity: 0; translateY(30px)`; when it enters the viewport (`IntersectionObserver`, threshold **.18**, unobserve after first trigger) add `.in`: `opacity: 1; transform: none`. Transition .8s `cubic-bezier(.2,.8,.2,1)` for both properties, with optional delay from `--d`. One-shot, never replays.

### 4.12 Performance rules for scroll code

- A **single** passive `scroll` listener plus `resize`, which only sets a flag and calls `requestAnimationFrame(frame)` (throttled with a `tick` boolean). `frame()` does all updates (progress bar, slip parallax, story, cards, steps line).
- Skip all work when the landing view is hidden.
- Animate only `transform`, `opacity` and `filter`; never `top`/`left`.

### 4.13 Reduced motion

Under `prefers-reduced-motion: reduce`: no smooth scroll, headline words visible immediately, reveals visible without transition, slip printed instantly with rows visible, code lines visible, marquee stopped, auth form entrance and dial rotation transition removed.

---

## 5. Login, signup and forgot-password pages

One shared two-panel layout, three form states. (Reference uses hash routes `#login #register #forgot`; in the real app use real routes `/login`, `/register`, `/forgot-password` with identical views.) Landing and auth are **separate views**: the navbar and top bar persist, the landing page hides, scroll resets to top instantly, the page title becomes “WarrantyVault — Sign in / Create account / Reset password”.

### 5.1 Left panel (always dark `#0E0C0A`)

- Eyebrow, H2 (serif `clamp(2.2rem, 4.4vw, 4rem)`, `max-width: 12ch`, em in green `#4CC38A`) and a muted paragraph (`max-width: 26rem`).
- Copy per page: **Login** “Welcome back” / “Your paperwork *waited.*” / “Sign in to see what’s expiring, what’s covered and what you’ve filed.” · **Register** “New vault” / “Start with *one* warranty.” / “Create an account, then add your first product, date and invoice. The vault watches the calendar.” · **Forgot** “Lost the key” / “We’ll send *a new one.*” / “Enter your email and we’ll send a link to reset your password.”
- **Safe-dial SVG** (260×260 viewBox, `width: min(340px, 70%)`, centred, shown **above** the text via `order: -1`): outer thin ring, a rotating group (dotted ring with dasharray `1.5 10.019`, stroke 10, plus numbers 0, 25, 50, 75 at the four compass points), a dark centre disc (`#15120F`) with the word **LOCKED**, and a fixed amber pointer triangle at the top. The rotating group has `transform-origin: 130px 130px` and `transform: rotate(var(--rot))` with transition **.5s `cubic-bezier(.3, 1.5, .4, 1)`** (overshoot, like a combination lock).
- Dial behaviour: **every keystroke in any input rotates it +23°**; on valid submit it spins **+180°**; after the 900ms “Checking…” delay the dial gets class `open`, colour turns green and the centre text becomes **UNLOCKED**. When the route changes it resets to LOCKED.
- At ≤860px the panel becomes a compact horizontal strip (flex row, space-between, vertical padding 28px): H2 at 2rem, paragraph hidden, dial shrinks to 96px at the right.

### 5.2 Right panel (form)

`← Back to home` link (mono .78rem uppercase, muted) above an H1 (serif `clamp(2.6rem, 5vw, 4rem)`, line-height 1). The form enters with a **.6s fade and 18px rise** (`cubic-bezier(.2,.8,.2,1)`).

**Inputs:** label above (mono .72rem, uppercase, letter-spacing .14em, weight 500); input full width, `padding: .85em 1em`, 1.5px ink border, radius 2px, bg `var(--bg)`. **Focus:** remove outline and use `box-shadow: 4px 4px 0 var(--g)` (hard green offset). **Invalid** (`aria-invalid="true"`): red border and `4px 4px 0 var(--r)` shadow. Error text sits below in red mono .78rem, `aria-live="polite"`.

**Login fields:** Email, Password (with Show/Hide toggle button inside the field on the right, mono .68rem uppercase), submit “Unlock vault”, links “Forgot password?” · “Create a vault”.

**Register fields:** Name, Email, Password (toggle + **4-segment strength meter** + hint), Confirm password, a small disclaimer, submit “Create my vault”, link “Already have a vault? Sign in”.

- Strength meter: four 4px bars, gap 4px. Score +1 for each: length ≥ 8; has lower and upper case; has a digit; has a symbol or length ≥ 14. Colour: red if score < 2, amber if 2, green if ≥ 3. Hint text: `Weak, Weak, Okay, Good, Strong` by score; empty field shows “At least 8 characters.”

**Forgot field:** Email only, submit “Send reset link”, link “← Back to sign in”.

**Validation rules (messages are exact):**

- Name: 2+ chars, else “Tell us what to call you (2+ characters).”
- Email: regex `^[^\s@]+@[^\s@]+\.[^\s@]{2,}$`, else “That email doesn’t look right. Check for typos.”
- Login password: required, “Enter your password.”
- New password: 8+ chars, “Use at least 8 characters.”
- Confirm: equals password, “Passwords don’t match yet.”
- Validate on blur (only if the field has a value) and live on input once a field is invalid. Changing the password re-checks confirm. On failed submit, focus the first invalid field. Forms use `novalidate`.

**Submit state:** disable the button, text “Checking…”, spin the dial. Replace the reference’s demo timeout with the **real Supabase call** (`signInWithPassword`, `signUp` with `options.data.name`, `resetPasswordForEmail`), restore the button on completion, and show errors from Supabase in the field-level error style. Remove the “Form passed ✓ Demo only” boxes in production.

---

## 6. Responsive breakpoints summary

- ≤900px: hero single column (top padding 100px); security grid single column.
- ≤860px: auth becomes single column with the compact dark strip.
- ≤820px: navbar text links hidden; feature cards single column.

---

## 7. Interaction summary table (quick check)

| Element | Trigger | Effect |
| --- | --- | --- |
| Headline words | Page load | Slide up from mask, .07s stagger |
| Receipt slip | Page load, then scroll | Prints top to bottom, rows fade in; parallax and tilt for first 1.3 viewports |
| Marquee | Always | 50s linear loop |
| Story stage | Scroll within 520vh | Pinned; number, colour, badge, caption, timeline change |
| Feature cards | Scroll | Sticky stack, previous card scales to .955 and dims |
| Code block | Enters view | Lines slide in, .2s stagger |
| Steps line | Scroll | Ink line grows downward |
| Auth dial | Typing, submit | +23° per key, +180° on submit, unlock state |
| Buttons | Hover | Lift 3px with hard offset shadow |

---

## 8. Things you must NOT do (common mistakes)

1. Do not replace the sticky story with a scroll-jacking library or a timed animation. Progress must come from `scrollY` only, so scrolling back up reverses it.
2. Do not put `overflow: hidden/auto`, `transform` or `filter` on any ancestor of `.stage` or `.card`.
3. Do not make the story height anything other than \~520vh; shorter makes the countdown too fast, longer makes it drag.
4. Do not use linear day mapping; use the anchor table.
5. Do not add blur, gradients, glassmorphism, rounded-xl cards or soft shadows. The look is flat paper, ink borders and hard offset shadows.
6. Do not animate with layout properties or attach several scroll listeners.
7. Do not skip the grain overlay, dark mode tokens or reduced-motion rules.
8. Do not use stock fonts other than the three specified.

---

## 9. Authentication and dashboard protection (hard requirement)

**Principle:** the dashboard is private. A visitor must never see it, flash it, or load its data without a valid session. Client checks are for experience; **the real protection is Supabase Row Level Security on every table plus a private storage bucket.**

**Routes**

- Public: `/` (landing), `/login`, `/register`, `/forgot-password`, `/reset-password`.
- Protected: `/dashboard` and every route under it (products, documents, reminders, profile, admin).

**Rules**

1. **No landing-page button links straight to the dashboard.** Nav “Sign in” → `/login`; nav “Get started”, hero “Open your vault” and closing “Create your vault” → `/register`. There is no “Dashboard” link for logged-out visitors.
2. **Route guard:** wrap all protected routes in a guard that reads the Supabase session (`supabase.auth.getSession()` and subscribe to `onAuthStateChange`). While the session is loading, render a neutral loading screen, **not** the dashboard shell. If there is no session, redirect to `/login?next=<requested path>` using `replace` so Back does not return to the protected page.
3. If someone types `/dashboard` into the address bar while logged out, they land on `/login`, and after a successful login are sent to the `next` path (validate it is an internal path), otherwise `/dashboard`.
4. **After sign-up:** if email confirmation is enabled, do **not** enter the dashboard; show a “Check your email to confirm your vault” state on the register page. Only when a confirmed session exists, redirect to `/dashboard`. Never auto-navigate on form submit alone; navigate only after the Supabase response contains a session.
5. **After login:** redirect to `/dashboard` only on success; show Supabase errors inline on failure.
6. **Already logged in?** Visiting `/login` or `/register` redirects to `/dashboard`. The landing page may then show an “Open dashboard” button in the nav instead of Sign in/Get started.
7. **Logout:** call `supabase.auth.signOut()`, clear any cached user data from client state, redirect to `/`.
8. **Admin routes** additionally require an admin role check on the server (RLS or an RPC), not only a client flag. Admin sees totals only, never file contents.
9. Data fetching inside the dashboard must run only after the guard passes, and every table has RLS `user_id = auth.uid()`.
10. Session expiry mid-use: on `SIGNED_OUT` or token failure, redirect to `/login`.

---

## 10. Acceptance checklist

- [ ] Landing, login, register and forgot pages match the reference visually at 1440px, 820px and 390px.
- [ ] The story section pins for 520vh; the number counts 365 → 30 → 15 → 7 → 0 with the green → amber → red change, caption changes and tick marks; scrolling up reverses everything.
- [ ] Feature cards stack with 28px offsets and the covered card shrinks and dims.
- [ ] Headline words, receipt printing, reveals, code lines, steps line, marquee and button hovers behave as specified.
- [ ] Dial rotates on typing and unlocks on success; validation messages are exact.
- [ ] Typing `/dashboard` while logged out always redirects to `/login`; no dashboard content flashes.
- [ ] Sign-up with email confirmation never reaches the dashboard until confirmed.
- [ ] Reduced-motion and dark mode both work.
