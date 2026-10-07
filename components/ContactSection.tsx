'use client';

import { useRef, useState } from 'react';
import { SOCIAL } from '@/lib/site';

/* Contact as a "transmission console": the form on the left, and on the
   right a panel of real details only (availability, the email address with a
   copy button, what I'm a good fit for, and social links once they exist in
   lib/site.ts). The background is a static grid with one CSS signal wave;
   the 220-particle canvas and the fake dashboard mockup it replaced both ran
   every frame. The paper plane from the testimonials lands on "Send"
   (components/handoff/handoffs.ts). */

const EMAIL = 'ahnafclash17@gmail.com';
const FIT = ['WordPress & Shopify builds', 'Next.js web apps & dashboards', 'Technical SEO & site speed', 'Automation & AI tools'];
const SOCIAL_LABELS: Record<keyof typeof SOCIAL, string> = { linkedin: 'LinkedIn', github: 'GitHub', instagram: 'Instagram' };

type SendState = 'idle' | 'sending' | 'sent' | 'error';

export default function ContactSection() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<SendState>('idle');
  const [copied, setCopied] = useState(false);
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
      <svg className="ct-wave" viewBox="0 0 1200 120" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 60 C 100 20, 200 100, 300 60 S 500 20, 600 60 S 800 100, 900 60 S 1100 20, 1200 60" />
      </svg>

      <div className="ct-wrap">
        <div className="ct-left reveal">
          <p className="section-label">Work With Us</p>
          <h2 className="ct-heading">
            <span className="gold-glow">Let&apos;s build</span> your next<br />product together.
          </h2>
          <p className="ct-sub">
            Looking for a technical partner or a high-capacity development team? Whether you&apos;re a SaaS founder or a digital agency, let&apos;s discuss how my team at AurixLab can help you scale.
          </p>

          <form ref={formRef} className="ct-form" onSubmit={handleSubmit} data-state={state}>
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
            <span>Transmission</span>
            <span className="ct-console-ch">CH-01</span>
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
