export default function AboutSection() {
  return (
    <section id="about">
      <div className="about-grid">
        <div className="about-bio reveal">
          <p className="section-label">About Me</p>
          <h2 className="section-title">
            <span className="accent">Developer by craft,</span>
            <br />
            data scientist by curiosity.
          </h2>
          <div className="section-divider" />
          <p>
            Hi, I&apos;m <strong>Ahnaf Hussain</strong>, currently studying at{' '}
            <strong>BRAC University</strong>, and I work as a web developer at{' '}
            <strong>AurixLab</strong>. I specialize in building customized, highly optimized
            websites with a strong focus on SEO.
          </p>
          <p>
            I enjoy solving problems through code and continuously work on improving my skills across
            various technologies including{' '}
            <strong>WordPress, Shopify, Python, and data science</strong>.
          </p>
          <div className="skills-wrap">
            {[
              'WordPress',
              'Shopify',
              'Python',
              'Java',
              'C / C++',
              'HTML / CSS',
              'Prompt Engineering',
              'SEO',
              'Data Science',
            ].map((s) => (
              <span key={s} className="skill-tag">
                {s}
              </span>
            ))}
          </div>
        </div>

        <div className="about-details reveal" style={{ transitionDelay: '.15s' }}>
          <div className="journey-block">
            <h3>My Journey</h3>
            <ul className="journey-list">
              <li>Joined AurixLab as an intern in August 2025, working on WordPress</li>
              <li>
                Promoted to fixing critical bugs and backend issues for Budget Promotion (Shopify)
              </li>
              <li>Contributed to data science projects for email marketing segmentation</li>
            </ul>
          </div>
          <div className="journey-block">
            <h3>What Drives Me</h3>
            <ul className="journey-list">
              <li>Passionate about the intersection of web development and data science</li>
              <li>
                Websites should perform, convert, and be backed by data-informed decisions
              </li>
            </ul>
          </div>
          <div className="journey-block">
            <h3>How I Work</h3>
            <ul className="journey-list">
              <li>Problem-first approach: understand the root cause before writing code</li>
              <li>
                From recovering hacked sites to building classification pipelines from 10K messy
                rows
              </li>
              <li>Clean, maintainable solutions over quick patches, every time</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
