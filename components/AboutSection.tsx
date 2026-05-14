export default function AboutSection() {
  return (
    <section id="about">
      <div className="about-grid">
        <div className="about-bio reveal">
          <p className="section-label">About Me</p>
          <h2 className="section-title">
            <span className="accent">Technical leader by role,</span>
            <br />
            architect by craft.
          </h2>
          <div className="section-divider" />
          <p>
            Hi, I&apos;m <strong>Ahnaf Hussain</strong> — Head of Web Development at{' '}
            <strong>AurixLab</strong>. I lead a development team building high-performance websites,
            SaaS frontends, and data-driven digital products for clients across North America.
            Currently finishing my degree at <strong>BRAC University</strong> while running a
            professional engineering team full-time.
          </p>
          <p>
            My focus is on <strong>systems architecture</strong> — building internal boilerplates,
            component standards, and development workflows that let my team consistently deliver 90+
            SEO scores, GSAP-driven interactivity, and scalable frontend infrastructure at speed.
          </p>
          <div className="skills-wrap">
            {[
              'Next.js',
              'WordPress',
              'Shopify',
              'Python',
              'Systems Architecture',
              'GSAP',
              'Team Leadership',
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
              <li>Joined AurixLab in August 2025 and rapidly advanced from technical specialist to leading the entire development function</li>
              <li>Architected Mission Control — a full-stack internal PM system used by all 11 team members daily, replacing fragmented Slack threads and spreadsheets</li>
              <li>Established frontend standards and boilerplates adopted across all client projects at AurixLab</li>
            </ul>
          </div>
          <div className="journey-block">
            <h3>What Drives Me</h3>
            <ul className="journey-list">
              <li>Building systems that scale — internal tooling, team workflows, and frontend architectures that outlast any single project</li>
              <li>The intersection of engineering rigour and design quality: products that perform, convert, and look world-class</li>
            </ul>
          </div>
          <div className="journey-block">
            <h3>How I Work</h3>
            <ul className="journey-list">
              <li>Architecture-first: define the system before writing a line of code</li>
              <li>Lead by doing — from recovering hacked production sites to directing GSAP animation pipelines across a team</li>
              <li>Raise the floor, not just the ceiling: standards, documentation, and repeatable processes over heroic one-off fixes</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
