import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SmallLEDMeter } from '../../components/SmallLEDMeter';

describe('SmallLEDMeter', () => {
  it('keeps the first LED dim for silence and very small signal levels', () => {
    const { container, rerender } = render(<SmallLEDMeter value={0} />);

    const firstLed = container.querySelector('.small-led-meter__led');
    expect(firstLed).not.toBeNull();
    expect(firstLed).toHaveStyle({ opacity: '0.15' });

    rerender(<SmallLEDMeter value={0.01} />);
    expect(firstLed).toHaveStyle({ opacity: '0.15' });
  });

  it('ramps the first LED up instead of snapping it fully on', () => {
    const { container } = render(<SmallLEDMeter value={0.08} />);

    const firstLed = container.querySelector('.small-led-meter__led');
    expect(firstLed).not.toBeNull();
    expect(Number.parseFloat((firstLed as HTMLDivElement).style.opacity)).toBeCloseTo(0.48, 5);
  });
});
