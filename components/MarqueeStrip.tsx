export default function MarqueeStrip() {
  const items = [
    'Web Developer',
    'Data Scientist',
    'Calgary',
    'AurixLab',
    'WordPress',
    'Shopify',
    'Python',
    'SEO',
  ];

  const marqueeContent = (
    <>
      {items.map((item, i) => (
        <span key={i} className="marquee-item">
          {item}
          <span className="marquee-dot">·</span>
        </span>
      ))}
    </>
  );

  return (
    <div className="marquee-strip">
      <div className="marquee-track">
        {marqueeContent}
        {marqueeContent}
      </div>
    </div>
  );
}
