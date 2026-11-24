'use client';

import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { projectData } from '@/lib/projects';
import { hasWebGL } from '@/lib/webgl';
import { CATEGORIES, tags } from './desk/screens';
import { FIRST_WORK, ease } from './desk/beats';
import type { ReportDeskLoad } from './desk/loading';

const DeskCanvas = lazy(() => import('./desk/DeskCanvas'));
gsap.registerPlugin(ScrollTrigger);

class DeskBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFailure();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function DeskHero({
  revealed,
  skip,
  reportLoad,
}: {
  revealed: boolean;
  skip: boolean;
  reportLoad: ReportDeskLoad;
}) {
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const intro = useRef<HTMLDivElement>(null);
  const veil = useRef<HTMLDivElement>(null);
  const work = useRef<HTMLDivElement>(null);
  const panels = useRef<(HTMLDivElement | null)[]>([]);
  const progress = useRef(0);
  const [enabled, setEnabled] = useState(false);
  const [phone, setPhone] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(true);
  const [list, setList] = useState(false);
  const showCanvas = enabled && !failed && !skip && !list;
  const live = showCanvas && ready;
  const onReady = useCallback(() => {
    setReady(true);
    reportLoad({ phase: 'ready' });
  }, [reportLoad]);
  const onFailure = useCallback(() => {
    setFailed(true);
    reportLoad({ phase: 'fallback' });
  }, [reportLoad]);

  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const small = matchMedia('(max-width: 768px)');
    const sync = () => {
      const available = reduced.matches || hasWebGL();
      setEnabled(!reduced.matches && available);
      setFailed((previous) => previous || !available);
      setPhone(small.matches);
      if (reduced.matches || !available) reportLoad({ phase: 'fallback' });
    };
    sync();
    reduced.addEventListener('change', sync);
    small.addEventListener('change', sync);
    const node = stage.current!;
    let intersecting = true;
    const visibility = () => setVisible(intersecting && !document.hidden);
    const io = new IntersectionObserver(([entry]) => {
      intersecting = entry.isIntersecting;
      visibility();
    });
    io.observe(node);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      reduced.removeEventListener('change', sync);
      small.removeEventListener('change', sync);
      io.disconnect();
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [reportLoad]);
  useEffect(() => {
    if (ready || skip || failed || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.current!.dataset.deskReady = 'true';
      window.dispatchEvent(new Event('deskready'));
    }
  }, [ready, failed, skip]);

  useLayoutEffect(() => {
    if (!live) {
      progress.current = 0;
      panels.current.forEach((el) => {
        if (el) {
          el.hidden = true;
          el.inert = true;
        }
      });
      if (intro.current) {
        intro.current.inert = false;
        intro.current.style.opacity = '1';
      }
      if (veil.current) veil.current.style.opacity = '0';
      return;
    }
    const distance = () => Math.round(stage.current!.clientHeight * (phone ? 6 : 7));
    const workAnchor = work.current!;
    const apply = (p: number) => {
      progress.current = p;
      intro.current!.style.opacity = String(1 - ease((p - 0.073) / 0.055));
      intro.current!.inert = p > 0.12;
      veil.current!.style.opacity = String(0.42 * ease((p - 0.84) / 0.16));
    };
    const pin = ScrollTrigger.create({
      trigger: stage.current,
      pin: true,
      start: 'top top',
      end: () => '+=' + distance(),
      scrub: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      refreshPriority: 1,
      onUpdate: (self) => apply(self.progress),
      onRefresh: (self) => {
        workAnchor.style.top = (self.end - self.start) * FIRST_WORK + 'px';
        apply(self.progress);
      },
    });
    ScrollTrigger.refresh();
    if (location.hash === '#showcase')
      window.__lenis?.scrollTo(work.current!, { immediate: true, force: true });
    return () => {
      pin.kill();
      workAnchor.style.removeProperty('top');
    };
  }, [live, phone]);

  useEffect(() => {
    if (list) {
      work.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
      work.current?.focus({ preventScroll: true });
    }
  }, [list]);

  const toWork = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!window.__lenis) return;
    event.preventDefault();
    window.__lenis.scrollTo(work.current!, { immediate: !live });
  };

  return (
    <section id="hero" className="dh" ref={root} aria-labelledby="desk-name" data-live={live}>
      <div className="dh-stage" ref={stage}>
        <div className="dh-poster" aria-hidden="true" />
        {showCanvas && (
          <div className="dh-canvas">
            <DeskBoundary onFailure={onFailure}>
              <Suspense fallback={null}>
                <DeskCanvas
                  active={!ready || (visible && revealed)}
                  phone={phone}
                  progress={progress}
                  panels={panels}
                  onReady={onReady}
                  reportLoad={reportLoad}
                  onFailure={onFailure}
                />
              </Suspense>
            </DeskBoundary>
          </div>
        )}
        <div className="dh-intro" ref={intro}>
          <p className="dh-role">
            Developer <span>/</span> Creative <span>/</span> Product builder
          </p>
          <h1 id="desk-name">
            Ahnaf
            <br />
            Hussain
          </h1>
          <a className="dh-work" href="#showcase" onClick={toWork}>
            View my work <span aria-hidden="true">↘</span>
          </a>
        </div>
        {CATEGORIES.map((cat, i) => (
          <div
            className="dh-panel"
            key={cat.monitor}
            ref={(el) => {
              panels.current[i] = el;
            }}
            hidden
            role="group"
            aria-labelledby={'desk-monitor-' + cat.monitor}
          >
            <div className="dh-sr">
              <h2 id={'desk-monitor-' + cat.monitor}>
                {cat.title} {cat.titleBold}
              </h2>
              <p>{cat.subtitle}</p>
            </div>
            {cat.projects.map((key) => (
              <a key={key} href={'/projects/' + key}>
                <span className="dh-sr">
                  {projectData[key].title} — {tags[key].join(', ')}
                </span>
              </a>
            ))}
          </div>
        ))}
        {live && (
          <button className="dh-index-toggle" onClick={() => setList(true)}>
            Project index <span aria-hidden="true">↗</span>
          </button>
        )}
        <div className="dh-veil" ref={veil} aria-hidden="true" />
      </div>
      <div id="showcase" ref={work} className="dh-work-anchor" tabIndex={-1}>
        <div className="dh-index" hidden={live}>
          {list && (
            <button
              className="dh-back"
              onClick={() => {
                window.__lenis?.scrollTo(0, { immediate: true });
                setReady(false);
                setList(false);
              }}
            >
              Back to desk ↑
            </button>
          )}
          {CATEGORIES.map((cat) => (
            <section key={cat.monitor}>
              <h2>
                {cat.title} {cat.titleBold}
              </h2>
              <p>{cat.subtitle}</p>
              <ul>
                {cat.projects.map((key) => (
                  <li key={key}>
                    <a href={'/projects/' + key}>
                      {projectData[key].title}
                      <span>{tags[key].join(' / ')}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}
