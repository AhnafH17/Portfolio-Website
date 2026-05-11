import Image from 'next/image';

export default function HeroSection() {
  return (
    <section id="hero">
      <div className="hero-bg-line" />
      <div className="hero-bg-line" />
      <div className="hero-bg-line" />
      <div className="hero-bg-line" />
      <div className="hero-content">
        <div className="hero-text">
          <p className="hero-greeting">Web Developer &amp; Data Scientist</p>
          <h1 className="hero-name">
            Hi, I&apos;m<br />
            <span className="accent">Ahnaf Hussain</span>
          </h1>
          <p className="hero-tagline">
            Building optimized websites and implementing data-driven solutions at AurixLab, Calgary.
          </p>
          <a href="#about" className="hero-cta">
            Learn More{' '}
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        </div>

        <div className="hero-image-wrapper">
          <div className="hero-image-decoration" />
          <div className="hero-image-frame">
            <Image
              src="/ahnaf-photo.jpg"
              alt="Ahnaf Hussain, Web Developer and Data Scientist at AurixLab, Calgary"
              width={380}
              height={480}
              priority
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
          <div className="hero-floating-tag">
            <span>@</span> AurixLab | Calgary
          </div>
        </div>
      </div>

      <div className="scroll-indicator">
        <span>Scroll</span>
        <div className="scroll-line" />
      </div>
    </section>
  );
}
