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

    const lerp3 = (p0: number, p1: number, p2: number, p3: number, t2: number) => {
      const mt = 1 - t2;
      return mt * mt * mt * p0 + 3 * mt * mt * t2 * p1 + 3 * mt * t2 * t2 * p2 + t2 * t2 * t2 * p3;
    };

    const draw = () => {
      t += 0.0025;
      const w = canvas.width;
      const h = canvas.height;

      ctx.fillStyle = '#060401';
      ctx.fillRect(0, 0, w, h);

      // Deep ambient pools of gold light
      const blobs = [
        { x: 0.12 + Math.sin(t * 0.5) * 0.06,  y: 0.32 + Math.cos(t * 0.38) * 0.08, r: 0.52, a: 0.30 },
        { x: 0.68 + Math.sin(t * 0.32 + 1) * 0.05, y: 0.50 + Math.cos(t * 0.42 + 1) * 0.07, r: 0.60, a: 0.24 },
        { x: 0.40 + Math.sin(t * 0.22 + 2) * 0.07, y: 0.78 + Math.cos(t * 0.28 + 2) * 0.05, r: 0.35, a: 0.14 },
        { x: 0.88 + Math.sin(t * 0.18 + 3) * 0.04, y: 0.20 + Math.cos(t * 0.24 + 3) * 0.06, r: 0.28, a: 0.18 },
      ];
      for (const b of blobs) {
        const grd = ctx.createRadialGradient(b.x * w, b.y * h, 0, b.x * w, b.y * h, b.r * w);
        grd.addColorStop(0,   `rgba(226,185,80,${b.a})`);
        grd.addColorStop(0.35,`rgba(180,130,45,${b.a * 0.55})`);
        grd.addColorStop(1,   'rgba(201,168,76,0)');
        ctx.beginPath();
        ctx.arc(b.x * w, b.y * h, b.r * w, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
      }

      // Bright bezier light streaks with multi-pass glow
      const curves = [
        { p0:{x:-0.04,y:0.55}, p1:{x:0.22,y:0.16}, p2:{x:0.58,y:0.20}, p3:{x:0.85,y:0.28}, phase:0,   base:0.85, w:2.2 },
        { p0:{x:0.18,y:0.65},  p1:{x:0.42,y:0.28}, p2:{x:0.70,y:0.24}, p3:{x:1.06,y:0.36}, phase:1.7,  base:0.60, w:1.5 },
        { p0:{x:0.30,y:0.90},  p1:{x:0.50,y:0.60}, p2:{x:0.78,y:0.48}, p3:{x:1.02,y:0.55}, phase:3.2,  base:0.35, w:1.0 },
      ];

      for (const c of curves) {
        const pulse = (Math.sin(t * 1.0 + c.phase) + 1) / 2;
        const alpha = c.base * (0.6 + pulse * 0.4);

        const g = ctx.createLinearGradient(c.p0.x * w, c.p0.y * h, c.p3.x * w, c.p3.y * h);
        g.addColorStop(0,    'rgba(255,220,100,0)');
        g.addColorStop(0.15, `rgba(255,230,120,${alpha * 0.7})`);
        g.addColorStop(0.40, `rgba(255,240,160,${alpha})`);
        g.addColorStop(0.65, `rgba(226,185,80,${alpha * 0.85})`);
        g.addColorStop(1,    'rgba(201,168,76,0)');

        // Outer soft glow (widest)
        ctx.save();
        ctx.shadowColor = `rgba(255,210,80,${alpha * 0.9})`;
        ctx.shadowBlur = 40;
        ctx.beginPath();
        ctx.moveTo(c.p0.x*w, c.p0.y*h);
        ctx.bezierCurveTo(c.p1.x*w,c.p1.y*h,c.p2.x*w,c.p2.y*h,c.p3.x*w,c.p3.y*h);
        ctx.strokeStyle = g;
        ctx.lineWidth = c.w * 8;
        ctx.globalAlpha = 0.18;
        ctx.stroke();
        ctx.restore();

        // Mid glow
        ctx.save();
        ctx.shadowColor = `rgba(255,220,100,${alpha * 0.7})`;
        ctx.shadowBlur = 22;
        ctx.beginPath();
        ctx.moveTo(c.p0.x*w, c.p0.y*h);
        ctx.bezierCurveTo(c.p1.x*w,c.p1.y*h,c.p2.x*w,c.p2.y*h,c.p3.x*w,c.p3.y*h);
        ctx.strokeStyle = g;
        ctx.lineWidth = c.w * 3;
        ctx.globalAlpha = 0.55;
        ctx.stroke();
        ctx.restore();

        // Sharp bright core
        ctx.save();
        ctx.shadowColor = `rgba(255,245,180,${alpha})`;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(c.p0.x*w, c.p0.y*h);
        ctx.bezierCurveTo(c.p1.x*w,c.p1.y*h,c.p2.x*w,c.p2.y*h,c.p3.x*w,c.p3.y*h);
        ctx.strokeStyle = g;
        ctx.lineWidth = c.w * 0.8;
        ctx.globalAlpha = 1;
        ctx.stroke();
        ctx.restore();

        // Star flares at key points
        for (let i = 0; i < 4; i++) {
          const fp = (Math.sin(t * 1.8 + c.phase + i * 0.9) + 1) / 2;
          const fa = fp * alpha * 1.4;
          const fx = lerp3(c.p0.x, c.p1.x, c.p2.x, c.p3.x, 0.15 + i * 0.22) * w;
          const fy = lerp3(c.p0.y, c.p1.y, c.p2.y, c.p3.y, 0.15 + i * 0.22) * h;
          const fr = 18 + fp * 14;
          const fg2 = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr);
          fg2.addColorStop(0,   `rgba(255,248,200,${fa})`);
          fg2.addColorStop(0.3, `rgba(255,220,100,${fa * 0.6})`);
          fg2.addColorStop(1,   'rgba(201,168,76,0)');
          ctx.beginPath();
          ctx.arc(fx, fy, fr, 0, Math.PI * 2);
          ctx.fillStyle = fg2;
          ctx.fill();
        }
      }

      // Bright corner accent — top-left warm flood
      const cornerG = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.45);
      const cornerPulse = (Math.sin(t * 0.7) + 1) / 2;
      cornerG.addColorStop(0,   `rgba(200,155,40,${0.18 + cornerPulse * 0.10})`);
      cornerG.addColorStop(0.5, `rgba(160,110,20,${0.06 + cornerPulse * 0.04})`);
      cornerG.addColorStop(1,   'rgba(201,168,76,0)');
      ctx.fillStyle = cornerG;
      ctx.fillRect(0, 0, w, h);

      // Edge vignette — tighter so center stays bright
      const vig = ctx.createRadialGradient(w*0.5, h*0.5, h*0.05, w*0.5, h*0.5, h*0.85);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(0,0,0,0.65)');
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
       <div className="ct-dash-inner">
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
      </div>

      {/* Floating message bubbles — overlaying the dashboard */}
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
