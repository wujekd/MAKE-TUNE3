import './TimerDisplay.css';

interface TimerDisplayProps {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  completed?: boolean;
  pending?: boolean;
  closing?: boolean;
  placeholder?: boolean;
}

export function TimerDisplay({
  days,
  hours,
  minutes,
  seconds,
  completed,
  pending,
  closing,
  placeholder
}: TimerDisplayProps) {
  if (placeholder) {
    return (
      <div className="timer-display">
        <div className="timer-display__unit">
          <div className="timer-display__value">--</div>
          <div className="timer-display__label">days</div>
        </div>
        <div className="timer-display__separator">:</div>
        <div className="timer-display__unit">
          <div className="timer-display__value">--</div>
          <div className="timer-display__label">hours</div>
        </div>
        <div className="timer-display__separator">:</div>
        <div className="timer-display__unit">
          <div className="timer-display__value">--</div>
          <div className="timer-display__label">mins</div>
        </div>
        <div className="timer-display__separator">:</div>
        <div className="timer-display__unit">
          <div className="timer-display__value">--</div>
          <div className="timer-display__label">secs</div>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="timer-display">
        <div className="timer-display--completed">completed</div>
      </div>
    );
  }

  if (pending) {
    return (
      <div className="timer-display">
        <div className="timer-display--completed">pending</div>
      </div>
    );
  }

  if (closing) {
    return (
      <div className="timer-display timer-display--closing">
        <div className="timer-display__spinner" />
        <div className="timer-display__closing-text">closing…</div>
      </div>
    );
  }

  return (
    <div className="timer-display">
      <div className="timer-display__unit">
        <div className="timer-display__value">{days.toString().padStart(2, '0')}</div>
        <div className="timer-display__label">days</div>
      </div>
      <div className="timer-display__separator">:</div>
      <div className="timer-display__unit">
        <div className="timer-display__value">{hours.toString().padStart(2, '0')}</div>
        <div className="timer-display__label">hours</div>
      </div>
      <div className="timer-display__separator">:</div>
      <div className="timer-display__unit">
        <div className="timer-display__value">{minutes.toString().padStart(2, '0')}</div>
        <div className="timer-display__label">mins</div>
      </div>
      <div className="timer-display__separator">:</div>
      <div className="timer-display__unit">
        <div className="timer-display__value">{seconds.toString().padStart(2, '0')}</div>
        <div className="timer-display__label">secs</div>
      </div>
    </div>
  );
}
