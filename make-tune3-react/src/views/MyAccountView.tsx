import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { useUIStore } from '../stores/useUIStore';
import styles from './MyAccountView.module.css';

type AccountTab = 'profile' | 'support';

const formatDate = (value: any): string => {
  if (!value) return '—';
  const date = value?.toMillis ? new Date(value.toMillis()) : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
};

export function MyAccountView() {
  const navigate = useNavigate();
  const user = useAppStore(s => s.auth.user);
  const openFeedbackModal = useUIStore(s => s.openFeedbackModal);
  const [activeTab, setActiveTab] = useState<AccountTab>('profile');

  const displayName = useMemo(() => {
    if (!user) return 'Guest';
    return user.username || user.email || 'Guest';
  }, [user]);

  const avatarLetter = (displayName || 'G').trim().charAt(0).toUpperCase();
  const memberSince = formatDate(user?.createdAt);

  return (
    <div className={`view-container ${styles.container}`}>
      <section className={styles.hero}>
        <div className={styles.heroMain}>
          <div className={styles.avatar} aria-hidden="true">
            <span>{avatarLetter}</span>
          </div>
          <div className={styles.heroInfo}>
            <div className={styles.heroLabel}>My Account</div>
            <div className={styles.heroName}>{displayName}</div>
            <div className={styles.heroMeta}>
              <span>{user?.email || 'Not signed in'}</span>
              <span className={styles.dot} aria-hidden="true">•</span>
              <span>member since {memberSince}</span>
            </div>
          </div>
        </div>
        <div className={styles.heroActions}>
          {!user ? (
            <button className={styles.primaryButton} onClick={() => navigate('/auth?mode=login')}>
              Login
            </button>
          ) : (
            <>
              <button className={styles.secondaryButton}>Preview profile</button>
              <button className={styles.primaryButton} disabled title="Save is not wired yet">
                Save changes
              </button>
            </>
          )}
        </div>
      </section>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'profile' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          profile & visibility
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'support' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('support')}
        >
          feedback & support
        </button>
      </div>

      <div className={styles.tabContent}>
        {activeTab === 'profile' && (
          <section className={styles.panel}>
            <header className={styles.sectionHeader}>
              <div>
                <h3 className={styles.sectionTitle}>Profile</h3>
                <p className={styles.sectionSubtitle}>
                  Edit your public description, socials, and what others can see.
                </p>
              </div>
              <div className={styles.tierPill}>
                <span>tier</span>
                <strong>{user?.tier || 'free'}</strong>
              </div>
            </header>

            <div className={styles.formGrid}>
              <div className={styles.card}>
                <h4 className={styles.cardTitle}>Basics</h4>
                <label className={styles.fieldLabel} htmlFor="account-display-name">Display name</label>
                <input
                  id="account-display-name"
                  className={styles.input}
                  placeholder="Your display name"
                  defaultValue={user?.username || ''}
                />
                <label className={styles.fieldLabel} htmlFor="account-description">Description</label>
                <textarea
                  id="account-description"
                  className={styles.textarea}
                  placeholder="Short bio for your profile"
                  rows={4}
                  defaultValue=""
                />
              </div>

              <div className={styles.card}>
                <h4 className={styles.cardTitle}>Social Links</h4>
                <label className={styles.fieldLabel} htmlFor="account-website">Website</label>
                <input
                  id="account-website"
                  className={styles.input}
                  placeholder="https://"
                  defaultValue=""
                />
                <label className={styles.fieldLabel} htmlFor="account-soundcloud">SoundCloud</label>
                <input
                  id="account-soundcloud"
                  className={styles.input}
                  placeholder="soundcloud.com/your-handle"
                  defaultValue=""
                />
                <label className={styles.fieldLabel} htmlFor="account-instagram">Instagram</label>
                <input
                  id="account-instagram"
                  className={styles.input}
                  placeholder="instagram.com/your-handle"
                  defaultValue=""
                />
                <label className={styles.fieldLabel} htmlFor="account-youtube">YouTube</label>
                <input
                  id="account-youtube"
                  className={styles.input}
                  placeholder="youtube.com/@your-handle"
                  defaultValue=""
                />
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h4 className={styles.cardTitle}>Visibility</h4>
                <span className={styles.cardHint}>Controls what other users can see.</span>
              </div>
              <div className={styles.toggleList}>
                <label className={styles.toggleRow}>
                  <span>Public profile</span>
                  <span className={styles.toggle}>
                    <input type="checkbox" defaultChecked />
                    <span className={styles.toggleTrack} />
                  </span>
                </label>
                <label className={styles.toggleRow}>
                  <span>Show social links</span>
                  <span className={styles.toggle}>
                    <input type="checkbox" defaultChecked />
                    <span className={styles.toggleTrack} />
                  </span>
                </label>
                <label className={styles.toggleRow}>
                  <span>Show collaboration history</span>
                  <span className={styles.toggle}>
                    <input type="checkbox" />
                    <span className={styles.toggleTrack} />
                  </span>
                </label>
                <label className={styles.toggleRow}>
                  <span>Allow other creators to contact me</span>
                  <span className={styles.toggle}>
                    <input type="checkbox" defaultChecked />
                    <span className={styles.toggleTrack} />
                  </span>
                </label>
              </div>
            </div>

            <div className={styles.formActions}>
              <button className={styles.secondaryButton} type="button">Reset</button>
              <button className={styles.primaryButton} type="button" disabled title="Save is not wired yet">
                Save changes
              </button>
            </div>
          </section>
        )}

        {activeTab === 'support' && (
          <section className={styles.panel}>
            <header className={styles.sectionHeader}>
              <div>
                <h3 className={styles.sectionTitle}>Feedback & Support</h3>
                <p className={styles.sectionSubtitle}>
                  Track feedback you have submitted and open a new ticket anytime.
                </p>
              </div>
              <div className={styles.ticketActions}>
                <button className={styles.secondaryButton}>Support guidelines</button>
                <button className={styles.primaryButton} onClick={() => openFeedbackModal()}>
                  New ticket
                </button>
              </div>
            </header>

            <div className={styles.ticketList}>
              {!user && (
                <div className={styles.emptyState}>
                  <h4>Login to view your tickets</h4>
                  <p>We will show your feedback and support history here.</p>
                  <button className={styles.primaryButton} onClick={() => navigate('/auth?mode=login')}>
                    Login
                  </button>
                </div>
              )}
              {user && (
                <div className={styles.emptyState}>
                  <h4>No tickets yet</h4>
                  <p>When you submit feedback, it will appear here with status updates.</p>
                  <button className={styles.secondaryButton} onClick={() => openFeedbackModal()}>
                    Send feedback
                  </button>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
