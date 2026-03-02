import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardService, FeedbackService, UserService } from '../services';
import { useAppStore } from '../stores/appStore';
import { useUIStore } from '../stores/useUIStore';
import type { User } from '../types/auth';
import type { Feedback } from '../services/feedbackService';
import type { MyAccountStats } from '../services/dashboardService';
import styles from './MyAccountView.module.css';

type AccountTab = 'profile' | 'support';

interface ProfileFormState {
  description: string;
  link1: string;
  link2: string;
  link3: string;
  publicProfile: boolean;
  showSocialLinks: boolean;
  showCollaborationHistory: boolean;
  allowCreatorContact: boolean;
}

const DEFAULT_VISIBILITY: Required<NonNullable<User['visibility']>> = {
  publicProfile: true,
  showSocialLinks: true,
  showCollaborationHistory: false,
  allowCreatorContact: true
};

const DEFAULT_ACCOUNT_STATS: MyAccountStats = {
  collabs: 0,
  active: 0,
  submissions: 0,
  votes: 0
};

const compactFormatter = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1
});

const formatCount = (value: number): string => {
  if (!Number.isFinite(value)) return '0';
  return Math.abs(value) >= 10000 ? compactFormatter.format(value) : String(value);
};

const formatDate = (value: unknown): string => {
  if (!value) return '—';
  const date =
    typeof value === 'object' && value !== null && 'toMillis' in value
      ? new Date((value as { toMillis: () => number }).toMillis())
      : new Date(String(value));
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
};

const maskEmail = (email: string): string => {
  const atIndex = email.indexOf('@');
  if (atIndex <= 0) return email;

  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex);
  const firstChar = local.charAt(0);
  const stars = '*'.repeat(Math.max(0, local.length - 1));
  return `${firstChar}${stars}${domain}`;
};

const buildFormState = (user: User | null): ProfileFormState => ({
  description: user?.description || '',
  link1: user?.socialLinks?.link1 || '',
  link2: user?.socialLinks?.link2 || '',
  link3: user?.socialLinks?.link3 || '',
  publicProfile: user?.visibility?.publicProfile ?? DEFAULT_VISIBILITY.publicProfile,
  showSocialLinks: user?.visibility?.showSocialLinks ?? DEFAULT_VISIBILITY.showSocialLinks,
  showCollaborationHistory:
    user?.visibility?.showCollaborationHistory ?? DEFAULT_VISIBILITY.showCollaborationHistory,
  allowCreatorContact:
    user?.visibility?.allowCreatorContact ?? DEFAULT_VISIBILITY.allowCreatorContact
});

const normalizeFormState = (form: ProfileFormState): ProfileFormState => ({
  ...form,
  description: form.description.trim(),
  link1: form.link1.trim(),
  link2: form.link2.trim(),
  link3: form.link3.trim()
});

const isProfileDirty = (a: ProfileFormState, b: ProfileFormState): boolean =>
  a.description !== b.description ||
  a.link1 !== b.link1 ||
  a.link2 !== b.link2 ||
  a.link3 !== b.link3 ||
  a.publicProfile !== b.publicProfile ||
  a.showSocialLinks !== b.showSocialLinks ||
  a.showCollaborationHistory !== b.showCollaborationHistory ||
  a.allowCreatorContact !== b.allowCreatorContact;

export function MyAccountView() {
  const navigate = useNavigate();
  const user = useAppStore(s => s.auth.user);
  const openFeedbackModal = useUIStore(s => s.openFeedbackModal);
  const feedbackLastSubmittedAt = useUIStore(s => s.feedbackLastSubmittedAt);
  const [activeTab, setActiveTab] = useState<AccountTab>('profile');
  const [profileForm, setProfileForm] = useState<ProfileFormState>(() => buildFormState(user));
  const [initialProfileForm, setInitialProfileForm] = useState<ProfileFormState>(() =>
    buildFormState(user)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Feedback[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsError, setTicketsError] = useState<string | null>(null);
  const [showFullEmail, setShowFullEmail] = useState(false);
  const [accountStats, setAccountStats] = useState<MyAccountStats>(DEFAULT_ACCOUNT_STATS);
  const [statsLoading, setStatsLoading] = useState(false);

  const displayName = useMemo(() => {
    if (!user) return 'Guest';
    return user.username || user.email || 'Guest';
  }, [user]);

  const avatarLetter = (displayName || 'G').trim().charAt(0).toUpperCase();
  const memberSince = formatDate(user?.createdAt);
  const displayedEmail = user?.email
    ? (showFullEmail ? user.email : maskEmail(user.email))
    : 'Not signed in';

  useEffect(() => {
    setShowFullEmail(false);
  }, [user?.uid, user?.email]);

  useEffect(() => {
    const next = buildFormState(user);
    setProfileForm(next);
    setInitialProfileForm(next);
    setSaveError(null);
    setSaveSuccess(null);
  }, [
    user?.uid,
    user?.description,
    user?.socialLinks?.link1,
    user?.socialLinks?.link2,
    user?.socialLinks?.link3,
    user?.visibility?.publicProfile,
    user?.visibility?.showSocialLinks,
    user?.visibility?.showCollaborationHistory,
    user?.visibility?.allowCreatorContact
  ]);

  useEffect(() => {
    if (activeTab !== 'support' || !user) {
      setTickets([]);
      setTicketsError(null);
      return;
    }

    let cancelled = false;
    const loadTickets = async () => {
      setTicketsLoading(true);
      setTicketsError(null);
      try {
        const rows = await FeedbackService.getUserFeedback(user.uid);
        if (!cancelled) {
          setTickets(rows);
        }
      } catch (error: any) {
        if (!cancelled) {
          setTicketsError(error?.message || 'Failed to load tickets');
        }
      } finally {
        if (!cancelled) {
          setTicketsLoading(false);
        }
      }
    };

    loadTickets();
    return () => {
      cancelled = true;
    };
  }, [activeTab, user]);

  useEffect(() => {
    if (activeTab !== 'support' || !user || !feedbackLastSubmittedAt) {
      return;
    }

    let cancelled = false;
    const refreshTickets = async () => {
      setTicketsLoading(true);
      setTicketsError(null);
      try {
        const rows = await FeedbackService.getUserFeedback(user.uid);
        if (!cancelled) {
          setTickets(rows);
        }
      } catch (error: any) {
        if (!cancelled) {
          setTicketsError(error?.message || 'Failed to load tickets');
        }
      } finally {
        if (!cancelled) {
          setTicketsLoading(false);
        }
      }
    };

    refreshTickets();
    return () => {
      cancelled = true;
    };
  }, [feedbackLastSubmittedAt, activeTab, user]);

  useEffect(() => {
    if (!user) {
      setAccountStats(DEFAULT_ACCOUNT_STATS);
      setStatsLoading(false);
      return;
    }

    let cancelled = false;
    const loadStats = async () => {
      setStatsLoading(true);
      try {
        const stats = await DashboardService.getMyAccountStats();
        if (!cancelled) {
          setAccountStats(stats);
        }
      } finally {
        if (!cancelled) {
          setStatsLoading(false);
        }
      }
    };

    void loadStats();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const dirty = useMemo(
    () => isProfileDirty(profileForm, initialProfileForm),
    [profileForm, initialProfileForm]
  );

  const dirtyFields = useMemo(
    () => ({
      description: profileForm.description !== initialProfileForm.description,
      link1: profileForm.link1 !== initialProfileForm.link1,
      link2: profileForm.link2 !== initialProfileForm.link2,
      link3: profileForm.link3 !== initialProfileForm.link3,
      publicProfile: profileForm.publicProfile !== initialProfileForm.publicProfile,
      showSocialLinks: profileForm.showSocialLinks !== initialProfileForm.showSocialLinks,
      showCollaborationHistory:
        profileForm.showCollaborationHistory !== initialProfileForm.showCollaborationHistory,
      allowCreatorContact: profileForm.allowCreatorContact !== initialProfileForm.allowCreatorContact
    }),
    [profileForm, initialProfileForm]
  );

  const handleInputChange =
    (field: 'description' | 'link1' | 'link2' | 'link3') =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = e.target.value;
      setProfileForm(prev => ({ ...prev, [field]: value }));
      setSaveError(null);
      setSaveSuccess(null);
    };

  const handleToggleChange =
    (
      field:
        | 'publicProfile'
        | 'showSocialLinks'
        | 'showCollaborationHistory'
        | 'allowCreatorContact'
    ) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.checked;
      setProfileForm(prev => ({ ...prev, [field]: value }));
      setSaveError(null);
      setSaveSuccess(null);
    };

  const handleReset = () => {
    setProfileForm({ ...initialProfileForm });
    setSaveError(null);
    setSaveSuccess(null);
  };

  const handleSave = async () => {
    if (!user || !dirty || isSaving) return;

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    const normalized = normalizeFormState(profileForm);
    const updates = {
      description: normalized.description,
      socialLinks: {
        link1: normalized.link1,
        link2: normalized.link2,
        link3: normalized.link3
      },
      visibility: {
        publicProfile: normalized.publicProfile,
        showSocialLinks: normalized.showSocialLinks,
        showCollaborationHistory: normalized.showCollaborationHistory,
        allowCreatorContact: normalized.allowCreatorContact
      }
    };

    try {
      await UserService.updateUserProfile(user.uid, updates);
      useAppStore.setState(state => ({
        auth: {
          ...state.auth,
          user: state.auth.user
            ? {
                ...state.auth.user,
                ...updates
              }
            : state.auth.user
        }
      }));
      setProfileForm(normalized);
      setInitialProfileForm(normalized);
      setSaveSuccess('Changes saved');
    } catch (error: any) {
      setSaveError(error?.message || 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const saveButtonLabel = isSaving ? 'Saving...' : 'Save changes';

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
              {user?.email ? (
                <button
                  type="button"
                  className={styles.emailButton}
                  onClick={() => setShowFullEmail(v => !v)}
                  title={showFullEmail ? 'Hide full email' : 'Show full email'}
                >
                  {displayedEmail}
                </button>
              ) : (
                <span>{displayedEmail}</span>
              )}
              <span className={styles.dot} aria-hidden="true">
                •
              </span>
              <span>member since {memberSince}</span>
            </div>
          </div>
        </div>
        <div className={styles.heroActions}>
          {user && (
            <div className={styles.counterWrap}>
              <div className={styles.counterGrid}>
                <div className={styles.counterCard}>
                  <div className={styles.counterHeader}>
                    <div className={styles.counterLabel}>collabs</div>
                    <div className={styles.counterValue}>
                      {statsLoading ? '...' : formatCount(accountStats.collabs)}
                    </div>
                  </div>
                </div>
                <div className={styles.counterCard}>
                  <div className={styles.counterHeader}>
                    <div className={styles.counterLabel}>active</div>
                    <div className={styles.counterValue}>
                      {statsLoading ? '...' : formatCount(accountStats.active)}
                    </div>
                  </div>
                </div>
                <div className={styles.counterCard}>
                  <div className={styles.counterHeader}>
                    <div className={styles.counterLabel}>submissions</div>
                    <div className={styles.counterValue}>
                      {statsLoading ? '...' : formatCount(accountStats.submissions)}
                    </div>
                  </div>
                </div>
                <div className={styles.counterCard}>
                  <div className={styles.counterHeader}>
                    <div className={styles.counterLabel}>votes</div>
                    <div className={styles.counterValue}>
                      {statsLoading ? '...' : formatCount(accountStats.votes)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {!user && (
            <button className={styles.primaryButton} onClick={() => navigate('/auth?mode=login')}>
              Login
            </button>
          )}
        </div>
      </section>

      <div className={styles.tabsRow}>
        <div className={styles.tabs}>
          <span
            aria-hidden="true"
            className={`${styles.tabSlider} ${activeTab === 'support' ? styles.tabSliderSupport : ''}`}
          />
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
        {user && (
          <div className={styles.tierPill}>
            <span>tier</span>
            <strong>{user.tier || 'free'}</strong>
          </div>
        )}
      </div>

      <div className={styles.tabContent}>
        {activeTab === 'profile' && (
          <section className={styles.panel}>
            {!user && (
              <div className={styles.emptyState}>
                <h4>Login to manage your account</h4>
                <p>Profile settings and visibility controls are available after sign in.</p>
                <button className={styles.primaryButton} onClick={() => navigate('/auth?mode=login')}>
                  Login
                </button>
              </div>
            )}

            {user && (
              <>
                <div className={styles.formLayout}>
                  <div className={styles.formColumn}>
                    <div className={styles.card}>
                      <h4 className={styles.cardTitle}>Profile & Links</h4>

                      <label className={styles.fieldLabel} htmlFor="account-description">
                        Description
                      </label>
                      <div className={`${styles.inputWrap} ${dirtyFields.description ? styles.unsavedField : ''}`}>
                        <textarea
                          id="account-description"
                          className={`${styles.textarea} ${dirtyFields.description ? styles.unsavedInput : ''}`}
                          placeholder="Short bio for your profile"
                          rows={4}
                          value={profileForm.description}
                          onChange={handleInputChange('description')}
                        />
                      </div>

                      <div className={styles.inlineFieldRow}>
                        <label className={styles.inlineFieldLabel} htmlFor="account-link-1">
                          Link 1
                        </label>
                        <div className={`${styles.inputWrap} ${dirtyFields.link1 ? styles.unsavedField : ''}`}>
                          <input
                            id="account-link-1"
                            className={`${styles.input} ${dirtyFields.link1 ? styles.unsavedInput : ''}`}
                            placeholder="https://"
                            value={profileForm.link1}
                            onChange={handleInputChange('link1')}
                          />
                        </div>
                      </div>

                      <div className={styles.inlineFieldRow}>
                        <label className={styles.inlineFieldLabel} htmlFor="account-link-2">
                          Link 2
                        </label>
                        <div className={`${styles.inputWrap} ${dirtyFields.link2 ? styles.unsavedField : ''}`}>
                          <input
                            id="account-link-2"
                            className={`${styles.input} ${dirtyFields.link2 ? styles.unsavedInput : ''}`}
                            placeholder="https://"
                            value={profileForm.link2}
                            onChange={handleInputChange('link2')}
                          />
                        </div>
                      </div>

                      <div className={styles.inlineFieldRow}>
                        <label className={styles.inlineFieldLabel} htmlFor="account-link-3">
                          Link 3
                        </label>
                        <div className={`${styles.inputWrap} ${dirtyFields.link3 ? styles.unsavedField : ''}`}>
                          <input
                            id="account-link-3"
                            className={`${styles.input} ${dirtyFields.link3 ? styles.unsavedInput : ''}`}
                            placeholder="https://"
                            value={profileForm.link3}
                            onChange={handleInputChange('link3')}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={styles.formColumn}>
                    <div className={styles.card}>
                      <div className={`${styles.cardHeader} ${styles.visibilityHeader}`}>
                        <h4 className={styles.cardTitle}>Visibility</h4>
                        <span className={styles.cardHint}>Controls what other users can see.</span>
                      </div>
                      <div className={styles.toggleList}>
                        <label className={`${styles.toggleRow} ${dirtyFields.publicProfile ? styles.unsavedField : ''}`}>
                          <span>Public profile</span>
                          <span className={styles.toggle}>
                            <input
                              type="checkbox"
                              checked={profileForm.publicProfile}
                              onChange={handleToggleChange('publicProfile')}
                            />
                            <span className={styles.toggleTrack} />
                          </span>
                        </label>
                        <label className={`${styles.toggleRow} ${dirtyFields.showSocialLinks ? styles.unsavedField : ''}`}>
                          <span>Show social links</span>
                          <span className={styles.toggle}>
                            <input
                              type="checkbox"
                              checked={profileForm.showSocialLinks}
                              onChange={handleToggleChange('showSocialLinks')}
                            />
                            <span className={styles.toggleTrack} />
                          </span>
                        </label>
                        <label
                          className={`${styles.toggleRow} ${dirtyFields.showCollaborationHistory ? styles.unsavedField : ''}`}
                        >
                          <span>Show collaboration history</span>
                          <span className={styles.toggle}>
                            <input
                              type="checkbox"
                              checked={profileForm.showCollaborationHistory}
                              onChange={handleToggleChange('showCollaborationHistory')}
                            />
                            <span className={styles.toggleTrack} />
                          </span>
                        </label>
                        <label
                          className={`${styles.toggleRow} ${dirtyFields.allowCreatorContact ? styles.unsavedField : ''}`}
                        >
                          <span>Allow other creators to contact me</span>
                          <span className={styles.toggle}>
                            <input
                              type="checkbox"
                              checked={profileForm.allowCreatorContact}
                              onChange={handleToggleChange('allowCreatorContact')}
                            />
                            <span className={styles.toggleTrack} />
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.formActions}>
                  <button
                    className={styles.secondaryButton}
                    type="button"
                    onClick={handleReset}
                    disabled={!dirty || isSaving}
                  >
                    Reset
                  </button>
                  <button
                    className={`${styles.primaryButton} ${styles.saveButton} ${dirty && !isSaving ? styles.unsavedSaveButton : ''}`}
                    type="button"
                    onClick={handleSave}
                    disabled={!dirty || isSaving}
                  >
                    {saveButtonLabel}
                  </button>
                </div>

                {(saveError || saveSuccess) && (
                  <div
                    className={`${styles.statusMessage} ${saveError ? styles.statusError : styles.statusSuccess}`}
                  >
                    {saveError || saveSuccess}
                  </div>
                )}
              </>
            )}
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
                {user ? (
                  <button className={styles.primaryButton} onClick={() => openFeedbackModal()}>
                    New ticket
                  </button>
                ) : (
                  <button className={styles.primaryButton} onClick={() => navigate('/auth?mode=login')}>
                    Login
                  </button>
                )}
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

              {user && ticketsLoading && (
                <div className={styles.emptyState}>
                  <h4>Loading tickets...</h4>
                </div>
              )}

              {user && !ticketsLoading && ticketsError && (
                <div className={styles.emptyState}>
                  <h4>Could not load tickets</h4>
                  <p>{ticketsError}</p>
                </div>
              )}

              {user && !ticketsLoading && !ticketsError && tickets.length === 0 && (
                <div className={styles.emptyState}>
                  <h4>No tickets yet</h4>
                  <p>When you submit feedback, it will appear here with status updates.</p>
                  <button className={styles.secondaryButton} onClick={() => openFeedbackModal()}>
                    Send feedback
                  </button>
                </div>
              )}

              {user && !ticketsLoading && !ticketsError && tickets.length > 0 && (
                <div className={styles.ticketItems}>
                  {tickets.map(ticket => (
                    <article key={ticket.id} className={styles.ticketItem}>
                      <div className={styles.ticketTop}>
                        <span className={styles.ticketCategory}>{ticket.category}</span>
                        <span
                          className={`${styles.ticketStatus} ${
                            ticket.status === 'resolved' ? styles.ticketStatusResolved : ''
                          }`}
                        >
                          {ticket.status}
                        </span>
                      </div>
                      <p className={styles.ticketMessage}>{ticket.message}</p>
                      <div className={styles.ticketMeta}>
                        <span>{formatDate(ticket.createdAt)}</span>
                        <span>route: {ticket.route}</span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
