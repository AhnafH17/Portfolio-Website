'use client';

import { useRef, useState, useEffect } from 'react';

function ContactSparkles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const section = canvas.parentElement as HTMLElement;
    sectionRef.current = section;

    let rafId: number;
    let W = 1, H = 1;
    let mx = -9999, my = -9999;
    let visible = false;

    const resize = () => {
      W = canvas.width = section.offsetWidth || window.innerWidth;
      H = canvas.height = section.offsetHeight || 700;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(section);

    // Only run rAF when section is in view
    const io = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      if (visible) rafId = requestAnimationFrame(draw);
    }, { threshold: 0.01 });
    io.observe(section);

    const onMouseMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      mx = e.clientX - r.left;
      my = e.clientY - r.top;
    };
    const onMouseLeave = () => { mx = -9999; my = -9999; };
    section.addEventListener('mousemove', onMouseMove, { passive: true });
    section.addEventListener('mouseleave', onMouseLeave);

    const COUNT = 220;
    const FL = 380;
    const MAX_Z = 900;

    // Gold palette matching portfolio
    const PALETTE = [
      { r: 201, g: 168, b: 76  },
      { r: 226, g: 201, b: 115 },
      { r: 255, g: 232, b: 140 },
      { r: 180, g: 130, b: 48  },
      { r: 255, g: 248, b: 200 },
    ];

    interface Sparkle {
      x3: number; y3: number; z: number;
      vz: number;
      col: { r: number; g: number; b: number };
      baseSize: number;
      // previous projected position for streak
      px: number; py: number; pscale: number;
    }

    const rand = (min: number, max: number) => Math.random() * (max - min) + min;

    const project = (x3: number, y3: number, z: number) => {
      const scale = FL / (z + FL);
      return { sx: x3 * scale + W * 0.5, sy: y3 * scale + H * 0.5, scale };
    };

    const makeSparkle = (initial = false): Sparkle => {
      const x3 = (Math.random() - 0.5) * W * 2.0;
      const y3 = (Math.random() - 0.5) * H * 2.0;
      const z  = initial ? Math.random() * MAX_Z : MAX_Z;
      const { sx, sy, scale } = project(x3, y3, z);
      return {
        x3, y3, z,
        vz: rand(3.5, 8.0),   // fast — creates long streaks
        col: PALETTE[Math.floor(Math.random() * PALETTE.length)],
        baseSize: rand(0.5, 1.4),
        px: sx, py: sy, pscale: scale,
      };
    };

    let sparkles: Sparkle[] = Array.from({ length: COUNT }, () => makeSparkle(true));
    let t = 0;

    const draw = () => {
      // Fade trail instead of full clear — creates motion blur effect
      ctx.fillStyle = 'rgba(8,6,3,0.18)';
      ctx.fillRect(0, 0, W, H);
      t++;

      for (const s of sparkles) {
        // Save previous projected position
        const { sx: px, sy: py, scale: ps } = project(s.x3, s.y3, s.z);

        // Move forward
        s.z -= s.vz;
        if (s.z <= 1) {
          Object.assign(s, makeSparkle(false));
          continue;
        }

        // Current projected position
        const { sx, sy, scale } = project(s.x3, s.y3, s.z);
        if (sx < -120 || sx > W + 120 || sy < -120 || sy > H + 120) {
          Object.assign(s, makeSparkle(false));
          continue;
        }

        // Mouse proximity boost to alpha
        const dx = sx - mx, dy = sy - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const mouseBoost = mx !== -9999 && dist < 180 ? (1 - dist / 180) * 0.5 : 0;

        const alpha = Math.min(0.95, (0.3 + mouseBoost) * scale * 2.2);
        const { r, g, b } = s.col;
        const lineW = Math.max(0.5, s.baseSize * scale * 2.5);

        // Streak: gradient from transparent (tail) to bright (head)
        const grad = ctx.createLinearGradient(px, py, sx, sy);
        grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
        grad.addColorStop(1, `rgba(${r},${g},${b},${alpha})`);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(sx, sy);
        ctx.strokeStyle = grad;
        ctx.lineWidth = lineW;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Bright head dot
        ctx.beginPath();
        ctx.arc(sx, sy, lineW * 0.9, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.fill();
        ctx.restore();
      }

      if (visible) rafId = requestAnimationFrame(draw);
    };

    // Don't start immediately — IO observer will start it when visible
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      io.disconnect();
      section.removeEventListener('mousemove', onMouseMove);
      section.removeEventListener('mouseleave', onMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}
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
      <ContactSparkles />

      <div className="ct-wrap">
        {/* LEFT — heading + form */}
        <div className="ct-left reveal">
          <p className="section-label">Work With Us</p>
          <h2 className="ct-heading">
            <span className="gold-glow">Let&apos;s build</span> your next<br />product together.
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
