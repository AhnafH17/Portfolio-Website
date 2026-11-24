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
import { aboutOverlapStart, FIRST_WORK, ease, tourScreens } from './desk/beats';
import type { ReportDeskLoad } from './desk/loading';
import { deskDevicePreferences, type DeskQuality } from './desk/quality';

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
  const workLink = useRef<HTMLAnchorElement>(null);
  const indexHeading = useRef<HTMLHeadingElement>(null);
  const indexButton = useRef<HTMLButtonElement>(null);
  const focusFirstProjectRef = useRef(false);
  const restoreTourFocus = useRef(false);
  const panels = useRef<(HTMLDivElement | null)[]>([]);
  const progress = useRef(0);
  const [enabled, setEnabled] = useState(false);
  const [phone, setPhone] = useState(false);
  const [quality, setQuality] = useState<DeskQuality>('full');
  const [staticDevice, setStaticDevice] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(true);
  const [list, setList] = useState(false);
  const showCanvas = enabled && !staticDevice && !failed && !skip && !list;
  const live = showCanvas && ready;
  const onReady = useCallback(() => {
    setReady(true);
    reportLoad({ phase: 'ready' });
  }, [reportLoad]);
  const onFailure = useCallback(() => {
    setFailed(true);
    reportLoad({ phase: 'fallback' });
  }, [reportLoad]);
  const downgradeQuality = useCallback(() => setQuality('light'), []);

  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const small = matchMedia('(max-width: 768px)');
    const sync = () => {
      const preferences = deskDevicePreferences();
      const available = reduced.matches || preferences.static || hasWebGL();
      setEnabled(!reduced.matches && available);
      setFailed((previous) => previous || !available);
      setPhone(small.matches);
      setStaticDevice(preferences.static);
      if (small.matches || preferences.light) downgradeQuality();
      if (reduced.matches || preferences.static || !available) reportLoad({ phase: 'fallback' });
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
  }, [reportLoad, downgradeQuality]);
  useEffect(() => {
    if (ready || skip || failed || staticDevice || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.current!.dataset.deskReady = 'true';
      window.dispatchEvent(new Event('deskready'));
    }
  }, [ready, failed, skip, staticDevice]);

  useLayoutEffect(() => {
    if (!live) {
      progress.current = 0;
      const panelHadFocus = panels.current.some((panel) => panel?.contains(document.activeElement));
      if (panelHadFocus) {
        work.current?.scrollIntoView({ behavior: 'instant' });
        indexHeading.current?.focus({ preventScroll: true });
      }
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
    const distance = () => Math.round(stage.current!.clientHeight * tourScreens(phone));
    const overlap = aboutOverlapStart(phone);
    const workAnchor = work.current!;
    const apply = (p: number) => {
      progress.current = p;
      intro.current!.style.opacity = String(1 - ease((p - 0.073) / 0.055));
      intro.current!.inert = p > 0.12;
      veil.current!.style.opacity = String(0.35 * ease((p - overlap) / (1 - overlap)));
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
      indexHeading.current?.focus({ preventScroll: true });
    }
  }, [list]);

  useEffect(() => {
    if (live && restoreTourFocus.current) {
      restoreTourFocus.current = false;
      workLink.current?.focus({ preventScroll: true });
    }
  }, [live]);

  const toWork = (keyboard: boolean) => {
    focusFirstProjectRef.current = keyboard && live;
    if (window.__lenis) window.__lenis.scrollTo(work.current!, { immediate: keyboard || !live });
    else work.current?.scrollIntoView({ behavior: 'instant' });
    if (!live && keyboard) indexHeading.current?.focus({ preventScroll: true });
  };

  const toAbout = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const section = document.getElementById('about-intro');
    if (!section) return;
    event.preventDefault();
    if (window.__lenis) window.__lenis.scrollTo(section, { immediate: true });
    else section.scrollIntoView({ behavior: 'instant' });
    section.querySelector('h2')?.focus({ preventScroll: true });
  };

  return (
    <section
      id="hero"
      className="dh"
      ref={root}
      aria-labelledby="desk-name"
      data-live={live}
      data-quality={live ? quality : 'static'}
    >
      <div className="dh-stage" ref={stage}>
        <div className="dh-poster" aria-hidden="true" />
        {showCanvas && (
          <div className="dh-canvas">
            <DeskBoundary onFailure={onFailure}>
              <Suspense fallback={null}>
                <DeskCanvas
                  active={!ready || (visible && revealed)}
                  ready={ready}
                  quality={quality}
                  progress={progress}
                  panels={panels}
                  focusFirstProjectRef={focusFirstProjectRef}
                  indexButton={indexButton}
                  onReady={onReady}
                  reportLoad={reportLoad}
                  onFailure={onFailure}
                  onSlow={downgradeQuality}
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
          <a
            className="dh-work"
            href="#showcase"
            ref={workLink}
            onClick={(event) => {
              event.preventDefault();
              toWork(event.detail === 0);
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              toWork(true);
            }}
          >
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
          <div className="dh-actions">
            <button
              className="dh-index-toggle"
              ref={indexButton}
              type="button"
              aria-controls="desk-project-index"
              title="Open the static list of all projects"
              onClick={() => setList(true)}
            >
              Browse projects <span aria-hidden="true">↗</span>
            </button>
            <a className="dh-skip" href="#about-intro" onClick={toAbout}>
              Skip to About Me
            </a>
          </div>
        )}
        <div className="dh-veil" ref={veil} aria-hidden="true" />
      </div>
      <div id="showcase" ref={work} className="dh-work-anchor" tabIndex={-1}>
        <div className="dh-index" id="desk-project-index" hidden={live}>
          {list && (
            <button
              className="dh-back"
              onClick={() => {
                restoreTourFocus.current = true;
                window.__lenis?.scrollTo(0, { immediate: true });
                setReady(false);
                setList(false);
              }}
            >
              Back to desk ↑
            </button>
          )}
          <h2 className="dh-index-heading" tabIndex={-1} ref={indexHeading}>
            Project index
          </h2>
          {CATEGORIES.map((cat) => (
            <section key={cat.monitor}>
              <h3>
                {cat.title} {cat.titleBold}
              </h3>
              <p>{cat.subtitle}</p>
              <ul>
                {cat.projects.map((key) => (
                  <li key={key}>
                    <a href={'/projects/' + key} tabIndex={0}>
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
