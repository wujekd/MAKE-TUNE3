import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Potentiometer } from '../../components/Potentiometer';

describe('Potentiometer', () => {
  it('uses the latest drag callbacks after rerender while dragging', async () => {
    const onChange = vi.fn();
    const onInputInitial = vi.fn();
    const onInputUpdated = vi.fn();

    const { rerender } = render(
      <Potentiometer
        label="gain"
        value={50}
        min={0}
        max={100}
        step={1}
        showValue={false}
        exponent={1}
        onChange={onChange}
        onInput={onInputInitial}
      />
    );

    const slider = screen.getByRole('slider', { name: 'gain' });
    fireEvent.mouseDown(slider, { clientY: 200 });

    rerender(
      <Potentiometer
        label="gain"
        value={50}
        min={0}
        max={100}
        step={1}
        showValue={false}
        exponent={2}
        onChange={onChange}
        onInput={onInputUpdated}
      />
    );

    await new Promise(resolve => setTimeout(resolve, 0));
    fireEvent.mouseMove(document, { clientY: 180 });

    expect(onInputInitial).not.toHaveBeenCalled();
    expect(onInputUpdated).toHaveBeenCalled();

    fireEvent.mouseUp(document);
    expect(onChange).toHaveBeenCalled();
  });
});
