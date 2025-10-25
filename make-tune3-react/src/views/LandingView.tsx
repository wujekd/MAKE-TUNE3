import { Link } from 'react-router-dom';
import './LandingView.css';

const featureHighlights = [
  {
    icon: '🎚️',
    title: 'Mix-ready collaboration',
    description: 'Preview contributions with the live mixer while keeping favorites and votes close at hand.'
  },
  {
    icon: '🎤',
    title: 'Seamless submissions',
    description: 'Creators can upload ideas, check levels, and resubmit without leaving the browser.'
  },
  {
    icon: '🧭',
    title: 'Guided moderation',
    description: 'Quickly review pending takes, lock the final mix, and steer the session through every stage.'
  }
];

const workflowSteps = [
  {
    label: '1',
    title: 'Start a project',
    blurb: 'Create a new collaboration or continue an in-progress session from your dashboard.'
  },
  {
    label: '2',
    title: 'Invite collaborators',
    blurb: 'Send a link so producers, vocalists, and players can jump straight into recording.'
  },
  {
    label: '3',
    title: 'Vote & finalize',
    blurb: 'Use favorites and votes to shortlist takes, then print a mix everyone loves.'
  }
];

const quickLinks = [
  {
    title: 'Browse collaborations',
    to: '/collabs',
    description: 'See active sessions and jump into the one that needs your ear right now.'
  },
  {
    title: 'Review submissions',
    to: '/collabs',
    description: 'Head to your queue to moderate new uploads and keep momentum going.'
  },
  {
    title: 'Join the next drop',
    to: '/auth?mode=register',
    description: 'Create an account to share drafts, vote on takes, and follow projects you love.'
  }
];

export function LandingView() {
  return (
    <div className="landing">
      <section className="landing__hero landing-card card">
        <div className="landing__hero-copy">
          <p className="landing__eyebrow">MAKE • TUNE • SHARE</p>
          <h1 className="landing__headline">Shape the track together.</h1>
          <p className="landing__lede">
            Make-Tune brings artists, producers, and moderators into one focused space. Balance stems in
            real-time, shortlist stand-out takes, and keep the momentum of your collaboration rolling.
          </p>
          <div className="landing__cta-row">
            <Link className="landing__cta landing__cta--primary" to="/collabs">Enter workspace</Link>
            <Link className="landing__cta" to="/auth?mode=register">Create account</Link>
          </div>
        </div>
        <div className="landing__hero-preview">
          <div className="landing__preview-card landing-card">
            <span className="landing__preview-label">Session snapshot</span>
            <div className="landing__preview-waveform" aria-hidden="true">
              <div className="landing__bar landing__bar--one"></div>
              <div className="landing__bar landing__bar--two"></div>
              <div className="landing__bar landing__bar--three"></div>
              <div className="landing__bar landing__bar--four"></div>
            </div>
            <p className="landing__preview-text">Lock in the groove before the final bounce.</p>
          </div>
        </div>
      </section>

      <section className="landing__section">
        <h2 className="landing__section-title">Why collaborators dig Make-Tune</h2>
        <div className="landing__grid">
          {featureHighlights.map(feature => (
            <article key={feature.title} className="landing__feature landing-card card">
              <span className="landing__feature-icon" aria-hidden="true">{feature.icon}</span>
              <h3 className="landing__feature-title">{feature.title}</h3>
              <p className="landing__feature-copy">{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing__section landing__section--alt">
        <div className="landing__workflow landing-card card">
          <h2 className="landing__section-title">Your session at a glance</h2>
          <div className="landing__workflow-steps">
            {workflowSteps.map(step => (
              <div key={step.title} className="landing__workflow-step">
                <span className="landing__workflow-label">{step.label}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.blurb}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <aside className="landing__updates landing-card card">
          <h2 className="landing__section-title">Latest updates</h2>
          <ul>
            <li>
              <strong>Audio engine ready</strong>
              <p>Playback, level matching, and favoriting now sync across the whole crew.</p>
            </li>
            <li>
              <strong>Submission flow refined</strong>
              <p>Uploading takes, replacing drafts, and voting is smoother than ever.</p>
            </li>
            <li>
              <strong>Next up</strong>
              <p>A polished moderation queue and richer mix automation controls.</p>
            </li>
          </ul>
        </aside>
      </section>

      <section className="landing__section">
        <h2 className="landing__section-title">Jump back in</h2>
        <div className="landing__links">
          {quickLinks.map(link => (
            <Link key={link.title} to={link.to} className="landing__link landing-card card">
              <h3>{link.title}</h3>
              <p>{link.description}</p>
              <span className="landing__link-cta">Open</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

export default LandingView;
