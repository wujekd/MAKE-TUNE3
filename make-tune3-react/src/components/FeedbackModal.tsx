import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useUIStore } from '../stores/useUIStore';
import { useAppStore } from '../stores/appStore';
import { FeedbackService } from '../services/feedbackService';
import type { FeedbackCategory, FeedbackAnswers } from '../services/feedbackService';
import './FeedbackModal.css';

const CATEGORY_OPTIONS: { value: FeedbackCategory; label: string }[] = [
  { value: 'bug', label: 'Bug Report' },
  { value: 'idea', label: 'Feature Idea' },
  { value: 'ui', label: 'UI Feedback' },
  { value: 'creator_request', label: 'Request Creator Access' },
  { value: 'other', label: 'Other' }
];

const CREATOR_QUESTIONS = [
  'What kind of project would you create?',
  'Do you have experience with music production?',
  'How did you hear about us?'
];

export function FeedbackModal() {
  const location = useLocation();
  const { feedbackModal, closeFeedbackModal } = useUIStore();
  const { user } = useAppStore(state => state.auth);

  const [category, setCategory] = useState<FeedbackCategory>('other');
  const [message, setMessage] = useState('');
  const [answers, setAnswers] = useState<FeedbackAnswers>({ q1: '', q2: '', q3: '' });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (feedbackModal.isOpen && feedbackModal.initialCategory) {
      setCategory(feedbackModal.initialCategory);
    }
  }, [feedbackModal.isOpen, feedbackModal.initialCategory]);

  useEffect(() => {
    if (!feedbackModal.isOpen) {
      setCategory('other');
      setMessage('');
      setAnswers({ q1: '', q2: '', q3: '' });
      setSuccess(false);
      setError(null);
    }
  }, [feedbackModal.isOpen]);

  if (!feedbackModal.isOpen || !user) return null;

  const handleSubmit = async () => {
    if (!message.trim()) {
      setError('Please enter a message');
      return;
    }

    if (category === 'creator_request') {
      if (!answers.q1.trim() || !answers.q2.trim() || !answers.q3.trim()) {
        setError('Please answer all questions');
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      await FeedbackService.createFeedback({
        uid: user.uid,
        category,
        message: message.trim(),
        answers: category === 'creator_request' ? answers : undefined,
        route: location.pathname
      });
      setSuccess(true);
    } catch (e: any) {
      setError(e?.message || 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    closeFeedbackModal();
  };

  return (
    <div className="feedback-modal__overlay" onClick={handleClose}>
      <div className="feedback-modal" onClick={e => e.stopPropagation()}>
        <div className="feedback-modal__header">
          <h2 className="feedback-modal__title">Send Feedback</h2>
          <button className="feedback-modal__close" onClick={handleClose}>×</button>
        </div>

        {success ? (
          <div className="feedback-modal__success">
            <div className="feedback-modal__success-icon">✓</div>
            <p>Thank you for your feedback!</p>
            <button className="feedback-modal__btn" onClick={handleClose}>Close</button>
          </div>
        ) : (
          <div className="feedback-modal__content">
            <div className="feedback-modal__field">
              <label className="feedback-modal__label">Category</label>
              <select
                className="feedback-modal__select"
                value={category}
                onChange={e => setCategory(e.target.value as FeedbackCategory)}
                disabled={submitting}
              >
                {CATEGORY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="feedback-modal__field">
              <label className="feedback-modal__label">Message</label>
              <textarea
                className="feedback-modal__textarea"
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Tell us what's on your mind..."
                rows={4}
                disabled={submitting}
              />
            </div>

            {category === 'creator_request' && (
              <div className="feedback-modal__questions">
                {CREATOR_QUESTIONS.map((question, idx) => (
                  <div key={idx} className="feedback-modal__field">
                    <label className="feedback-modal__label">{question}</label>
                    <input
                      className="feedback-modal__input"
                      type="text"
                      value={answers[`q${idx + 1}` as keyof FeedbackAnswers]}
                      onChange={e => setAnswers(prev => ({
                        ...prev,
                        [`q${idx + 1}`]: e.target.value
                      }))}
                      disabled={submitting}
                    />
                  </div>
                ))}
              </div>
            )}

            {error && <div className="feedback-modal__error">{error}</div>}

            <div className="feedback-modal__actions">
              <button
                className="feedback-modal__btn feedback-modal__btn--secondary"
                onClick={handleClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                className="feedback-modal__btn feedback-modal__btn--primary"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? 'Sending...' : 'Send Feedback'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
