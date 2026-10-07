'use client';

import { useEffect, useRef, useState } from 'react';
import { SOCIAL } from '@/lib/site';

/* Contact as a "transmission console": the form on the left, and on the
   right a panel of real details only (availability, the email address with a
   copy button, what I'm a good fit for, and social links once they exist in
   lib/site.ts), with a live signal scope that reacts to typing. Behind it:
   a synthwave sun and an endless neon grid floor (CSS only), and a glitch
   on "Let's build". The testimonials' transmission lands on the console
   (components/handoff/handoffs.ts). */

/** Oscilloscope trace: an idle carrier that spikes as the visitor types and
    when the transmission lands. Draws only while on screen. */
function SignalScope({ energy }: { energy: React.RefObject<number> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim() || '201,168,76';
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let dpr = 1, w = 0, h = 0, amp = 0.15;
    const size = () => { dpr = Math.min(2, window.devicePixelRatio || 1); w = c.offsetWidth; h = c.offsetHeight; c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); };
    size();
    const ro = new ResizeObserver(size); ro.observe(c);
    let raf: number | null = null;
    const draw = (time: number) => {
      const t = time / 1000;
      const landed = parseFloat(c.closest<HTMLElement>('.ct-console')?.style.getPropertyValue('--landed') || '0') || 0;
      const target = 0.15 + Math.min(1, energy.current ?? 0) * 0.85 + landed;
      amp += (target - amp) * 0.08;
      if (energy.current) energy.current *= 0.96;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = `rgba(${accent},0.18)`;
      ctx.lineWidth = 1;
      for (let x = 0; x <= w; x += w / 8) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
      for (const [col, lw, ph] of [[accent, 2.2, 0], ['255,255,255', 1, 0.6]] as const) {
        ctx.strokeStyle = `rgba(${col},${col === accent ? 0.95 : 0.55})`;
        ctx.lineWidth = lw;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 2) {
          const u = x / w;
          const env = Math.sin(Math.PI * u);
          const y = h / 2 + env * amp * (h * 0.42) *
            (Math.sin(u * 22 + t * 6 + ph) * 0.6 + Math.sin(u * 57 - t * 9) * 0.3 * amp + Math.sin(u * 7 + t * 2) * 0.25);
          if (x) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
      raf = reduce ? null : requestAnimationFrame(draw);
    };
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && raf === null) raf = requestAnimationFrame(draw);
      else if (!e.isIntersecting && raf !== null) { cancelAnimationFrame(raf); raf = null; }
    });
    io.observe(c);
    return () => { io.disconnect(); ro.disconnect(); if (raf !== null) cancelAnimationFrame(raf); };
  }, [energy]);
  return <canvas ref={ref} className="ct-scope" aria-hidden="true" />;
}

const EMAIL = 'ahnafclash17@gmail.com';
const FIT = ['WordPress & Shopify builds', 'Next.js web apps & dashboards', 'Technical SEO & site speed', 'Automation & AI tools'];
const SOCIAL_LABELS: Record<keyof typeof SOCIAL, string> = { linkedin: 'LinkedIn', github: 'GitHub', instagram: 'Instagram' };

type SendState = 'idle' | 'sending' | 'sent' | 'error';

export default function ContactSection() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<SendState>('idle');
  const [copied, setCopied] = useState(false);
  // Typing feeds the signal scope.
  const energy = useRef(0);
  const onType = () => { energy.current = Math.min(1.4, energy.current + 0.35); };
  const socials = (Object.keys(SOCIAL) as (keyof typeof SOCIAL)[]).filter((k) => SOCIAL[k]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('sending');
    try {
      const fd = new FormData(formRef.current!);
      const res = await fetch('https://api.web3forms.com/submit', { method: 'POST', body: fd });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Something went wrong.');
      setState('sent');
      formRef.current?.reset();
    } catch {
      setState('error');
    }
  };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked: the address is right there to select */ }
  };

  return (
    <section id="contact" className="ct-section">
      <div className="ct-grid-bg" aria-hidden="true" />
      <div className="ct-sun" aria-hidden="true" />
      <div className="ct-floor" aria-hidden="true">
        <div className="ct-floor-plane"><div className="ct-floor-grid" /></div>
      </div>

      <div className="ct-wrap">
        <div className="ct-left reveal">
          <p className="section-label">Work With Us</p>
          <h2 className="ct-heading">
            <span className="gold-glow ct-glitch" data-text="Let’s build">Let&apos;s build</span> your next<br />product together.
          </h2>
          <p className="ct-sub">
            Looking for a technical partner or a high-capacity development team? Whether you&apos;re a SaaS founder or a digital agency, let&apos;s discuss how my team at AurixLab can help you scale.
          </p>

          <form ref={formRef} className="ct-form" onSubmit={handleSubmit} onInput={onType} data-state={state}>
            <input type="hidden" name="access_key" value="eecb91c7-df3e-459b-b194-7972ccfd29ee" />
            <input type="hidden" name="subject" value="New Portfolio Contact Message" />
            <input type="hidden" name="from_name" value="Portfolio Website" />
            {/* Honeypot: hidden from people, filled in by bots. */}
            <input type="checkbox" name="botcheck" tabIndex={-1} autoComplete="off" style={{ display: 'none' }} />

            <div className="ct-row">
              <div className="ct-field">
                <label htmlFor="ct-name">Your name <span aria-hidden="true">*</span></label>
                <input type="text" id="ct-name" name="name" placeholder="John Doe" autoComplete="name" required />
              </div>
              <div className="ct-field">
                <label htmlFor="ct-email">Email address <span aria-hidden="true">*</span></label>
                <input type="email" id="ct-email" name="email" placeholder="john@example.com" autoComplete="email" required />
              </div>
            </div>
            <div className="ct-field">
              <label htmlFor="ct-msg">Message <span aria-hidden="true">*</span></label>
              <textarea id="ct-msg" name="message" placeholder="Tell me about your project..." autoComplete="off" required />
            </div>

            <div className="ct-actions">
              <button type="submit" className="ct-submit" disabled={state === 'sending'}>
                <span className="ct-submit-label">{state === 'sending' ? 'Sending…' : state === 'sent' ? 'Sent' : 'Send message'}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 12 20 4l-5 16-3-7-8-1Z" />
                </svg>
              </button>
              <p className="ct-status" role="status" aria-live="polite">
                {state === 'sent' && 'Message sent. I’ll get back to you soon.'}
                {state === 'error' && <>Couldn’t send. Email me at <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.</>}
              </p>
            </div>
          </form>
        </div>

        <aside className="ct-console reveal" aria-label="Contact details">
          <span className="ct-corner is-tl" aria-hidden="true" />
          <span className="ct-corner is-br" aria-hidden="true" />
          <div className="ct-console-head">
            <span className="ct-console-title">Transmission</span>
            <span className="ct-console-ch">CH-01</span>
          </div>
          <div className="ct-scope-wrap">
            <SignalScope energy={energy} />
            <span className="ct-incoming" aria-hidden="true">Incoming transmission</span>
          </div>
          <dl className="ct-console-list">
            <div>
              <dt>Status</dt>
              <dd><span className="ct-live" aria-hidden="true" />Open to new projects</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd className="ct-email">
                <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
                <button type="button" className="ct-copy" onClick={copyEmail} aria-live="polite">
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </dd>
            </div>
            <div>
              <dt>Good fit</dt>
              <dd>
                <ul className="ct-fit">
                  {FIT.map((f) => <li key={f}>{f}</li>)}
                </ul>
              </dd>
            </div>
            {socials.length > 0 && (
              <div>
                <dt>Elsewhere</dt>
                <dd className="ct-socials">
                  {socials.map((k) => (
                    <a key={k} href={SOCIAL[k]} target="_blank" rel="noopener me">{SOCIAL_LABELS[k]}</a>
                  ))}
                </dd>
              </div>
            )}
          </dl>
          <p className="ct-console-foot">Messages from this form go straight to my inbox.</p>
        </aside>
      </div>
    </section>
  );
}
