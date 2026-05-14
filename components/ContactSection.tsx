'use client';

import { useRef, useState } from 'react';

export default function ContactSection() {
  const formRef = useRef<HTMLFormElement>(null);
  const [btnText, setBtnText] = useState('Send Message');
  const [btnDisabled, setBtnDisabled] = useState(false);
  const [status, setStatus] = useState<{ text: string; type: 'success' | 'error' | '' }>({
    text: '',
    type: '',
  });

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
        setStatus({ text: "Message sent successfully! I'll get back to you soon.", type: 'success' });
        formRef.current?.reset();
      } else {
        throw new Error(data.message || 'Something went wrong.');
      }
    } catch {
      setStatus({
        text: 'Failed to send. Please email me directly at ahnafclash17@gmail.com',
        type: 'error',
      });
    }

    setBtnDisabled(false);
    setBtnText('Send Message');
  };

  return (
    <section id="contact">
      <div className="contact-inner reveal">
        <p className="section-label">Work With Us</p>
        <h2 className="section-title">
          Let&apos;s build your next
          <br />
          product together.
        </h2>
        <div className="section-divider" />
        <p className="contact-subtitle">
          Looking for a technical partner or a high-capacity development team? Whether you&apos;re a SaaS founder or a digital agency, let&apos;s discuss how my team at AurixLab can help you scale.
        </p>

        <form
          ref={formRef}
          className="contact-form"
          id="contactForm"
          onSubmit={handleSubmit}
        >
          <input type="hidden" name="access_key" value="eecb91c7-df3e-459b-b194-7972ccfd29ee" />
          <input type="hidden" name="subject" value="New Portfolio Contact Message" />
          <input type="hidden" name="from_name" value="Portfolio Website" />
          <input type="checkbox" name="botcheck" style={{ display: 'none' }} />

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="name">Your Name</label>
              <input type="text" id="name" name="name" placeholder="John Doe" required />
            </div>
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input type="email" id="email" name="email" placeholder="john@example.com" required />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="message">Message</label>
            <textarea
              id="message"
              name="message"
              placeholder="Tell me about your project..."
              required
            />
          </div>

          <button type="submit" className="submit-btn" disabled={btnDisabled}>
            {btnText}
          </button>

          {status.text && (
            <div className={`form-status${status.type ? ' ' + status.type : ''}`}>
              {status.text}
            </div>
          )}
        </form>

        <div className="social-links">
          <a href="#" className="social-link" aria-label="LinkedIn" target="_blank" rel="noopener noreferrer">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-4 0v7h-4v-7a6 6 0 016-6z" />
              <rect x="2" y="9" width="4" height="12" />
              <circle cx="4" cy="4" r="2" />
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
    </section>
  );
}
