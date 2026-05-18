'use client';

import { useRef, useState, useEffect } from 'react';

function ContactShader() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId: number;
    let t = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = () => {
      t += 0.004;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Base dark background
      ctx.fillStyle = '#0a0804';
      ctx.fillRect(0, 0, w, h);

      // Slow moving gold nebula blobs
      const blobs = [
        { x: 0.18 + Math.sin(t * 0.7) * 0.06,  y: 0.3  + Math.cos(t * 0.5) * 0.08,  r: 0.38, a: 0.13 },
        { x: 0.55 + Math.sin(t * 0.4 + 1) * 0.07, y: 0.6 + Math.cos(t * 0.6 + 1) * 0.06, r: 0.45, a: 0.10 },
        { x: 0.82 + Math.sin(t * 0.55 + 2) * 0.05, y: 0.25 + Math.cos(t * 0.45 + 2) * 0.09, r: 0.32, a: 0.09 },
        { x: 0.35 + Math.sin(t * 0.3 + 3) * 0.08, y: 0.75 + Math.cos(t * 0.35 + 3) * 0.05, r: 0.28, a: 0.07 },
      ];

      for (const b of blobs) {
        const grd = ctx.createRadialGradient(b.x * w, b.y * h, 0, b.x * w, b.y * h, b.r * w);
        grd.addColorStop(0, `rgba(201,168,76,${b.a})`);
        grd.addColorStop(0.5, `rgba(160,120,48,${b.a * 0.4})`);
        grd.addColorStop(1, 'rgba(201,168,76,0)');
        ctx.beginPath();
        ctx.arc(b.x * w, b.y * h, b.r * w, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
      }

      // Thin gold light streaks
      const streaks = [
        { x1: 0.0, y1: 0.38, x2: 0.65, y2: 0.22, phase: 0 },
        { x1: 0.3, y1: 0.55, x2: 1.0,  y2: 0.42, phase: 1.5 },
      ];

      for (const s of streaks) {
        const alpha = (Math.sin(t * 1.2 + s.phase) + 1) / 2 * 0.12 + 0.03;
        const g = ctx.createLinearGradient(s.x1 * w, s.y1 * h, s.x2 * w, s.y2 * h);
        g.addColorStop(0, 'rgba(201,168,76,0)');
        g.addColorStop(0.3, `rgba(226,201,115,${alpha})`);
        g.addColorStop(0.6, `rgba(201,168,76,${alpha * 0.7})`);
        g.addColorStop(1, 'rgba(201,168,76,0)');
        ctx.beginPath();
        ctx.moveTo(s.x1 * w, s.y1 * h);
        ctx.lineTo(s.x2 * w, s.y2 * h);
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Subtle vignette
      const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.85);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(rafId); ro.disconnect(); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
}

function DashboardMockup() {
  return (
    <div className="ct-mockup">
      {/* Main dashboard panel */}
      <div className="ct-dash">
        <div className="ct-dash-header">
          <span className="ct-dash-title">Dashboard</span>
          <div className="ct-dash-icons">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          </div>
        </div>

        <div className="ct-dash-sidebar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42"/></svg>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
        </div>

        <div className="ct-dash-cards">
          {[
            { label: 'SaaS Platform', avatars: 3 },
            { label: 'Mobile App', avatars: 3 },
            { label: 'Digital Agency Partnership', avatars: 3 },
          ].map((item, i) => (
            <div key={i} className="ct-dash-card">
              <span className="ct-dash-card-label">{item.label}</span>
              <div className="ct-dash-avatars">
                {Array.from({ length: item.avatars }).map((_, j) => (
                  <div key={j} className="ct-dash-avatar" style={{ '--i': j } as React.CSSProperties} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating message bubbles */}
      <div className="ct-bubble ct-bubble-1">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        <div className="ct-bubble-lines"><span/><span/></div>
      </div>
      <div className="ct-bubble ct-bubble-2">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        <div className="ct-bubble-lines"><span/><span style={{width:'60%'}}/></div>
      </div>
      <div className="ct-bubble ct-bubble-3">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        <div className="ct-bubble-lines"><span/><span style={{width:'70%'}}/></div>
      </div>

      {/* Connector dots */}
      <div className="ct-dot ct-dot-1" />
      <div className="ct-dot ct-dot-2" />
    </div>
  );
}

export default function ContactSection() {
  const formRef = useRef<HTMLFormElement>(null);
  const [btnText, setBtnText] = useState('Send Message');
  const [btnDisabled, setBtnDisabled] = useState(false);
  const [status, setStatus] = useState<{ text: string; type: 'success' | 'error' | '' }>({ text: '', type: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBtnDisabled(true);
    setBtnText('Sending...');
    setStatus({ text: '', type: '' });

    try {
      const fd = new FormData(formRef.current!);
      const res = await fetch('https://api.web3forms.com/submit', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.success) {
        setStatus({ text: "Message sent! I'll get back to you soon.", type: 'success' });
        formRef.current?.reset();
      } else {
        throw new Error(data.message || 'Something went wrong.');
      }
    } catch {
      setStatus({ text: 'Failed to send. Email me at ahnafclash17@gmail.com', type: 'error' });
    }

    setBtnDisabled(false);
    setBtnText('Send Message');
  };

  return (
    <section id="contact" className="ct-section">
      <ContactShader />

      <div className="ct-wrap">
        {/* LEFT — heading + form */}
        <div className="ct-left reveal">
          <p className="section-label">Work With Us</p>
          <h2 className="ct-heading">
            Let&apos;s build your next<br />product together.
          </h2>
          <p className="ct-sub">
            Looking for a technical partner or a high-capacity development team? Whether you&apos;re a SaaS founder or a digital agency, let&apos;s discuss how my team at AurixLab can help you scale.
          </p>

          <form ref={formRef} className="ct-form" onSubmit={handleSubmit}>
            <input type="hidden" name="access_key" value="eecb91c7-df3e-459b-b194-7972ccfd29ee" />
            <input type="hidden" name="subject" value="New Portfolio Contact Message" />
            <input type="hidden" name="from_name" value="Portfolio Website" />
            <input type="checkbox" name="botcheck" style={{ display: 'none' }} />

            <div className="ct-row">
              <div className="ct-field">
                <label htmlFor="ct-name">Your Name <span aria-hidden="true">*</span></label>
                <div className="ct-input-wrap">
                  <input type="text" id="ct-name" name="name" placeholder="John Doe" autoComplete="name" required />
                </div>
              </div>
              <div className="ct-field">
                <label htmlFor="ct-email">Email Address <span aria-hidden="true">*</span></label>
                <div className="ct-input-wrap">
                  <input type="email" id="ct-email" name="email" placeholder="john@example.com" autoComplete="email" required />
                </div>
              </div>
            </div>

            <div className="ct-field">
              <label htmlFor="ct-msg">Message <span aria-hidden="true">*</span></label>
              <div className="ct-input-wrap">
                <textarea id="ct-msg" name="message" placeholder="Tell me about your project..." autoComplete="off" required />
              </div>
            </div>

            <button type="submit" className="ct-submit" disabled={btnDisabled}>
              <span className="ct-submit-shimmer" />
              {btnText}
            </button>

            {status.text && (
              <div className={`ct-status${status.type ? ' ' + status.type : ''}`}>{status.text}</div>
            )}
          </form>

          <div className="social-links" style={{ justifyContent: 'flex-start', marginTop: '2rem' }}>
            <a href="#" className="social-link" aria-label="LinkedIn" target="_blank" rel="noopener noreferrer">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-4 0v7h-4v-7a6 6 0 016-6z" />
                <rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" />
              </svg>
            </a>
            <a href="#" className="social-link" aria-label="Facebook" target="_blank" rel="noopener noreferrer">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
              </svg>
            </a>
            <a href="#" className="social-link" aria-label="Instagram" target="_blank" rel="noopener noreferrer">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
            </a>
          </div>
        </div>

        {/* RIGHT — dashboard mockup */}
        <div className="ct-right reveal">
          <DashboardMockup />
        </div>
      </div>
    </section>
  );
}
