import './SmallLEDMeter.css';

interface SmallLEDMeterProps {
  value: number;  // 0 to 1
  min?: number;
  max?: number;
  vertical?: boolean;
  ledCount?: number;
}

export function SmallLEDMeter({ value, min = 0, max = 1, vertical = false, ledCount = 6 }: SmallLEDMeterProps) {
  const clamped = Math.min(max, Math.max(min, value));
  const normalized = (clamped - min) / (max - min || 1);
  const inactiveOpacity = 0.15;

  const ledStep = 1 / ledCount;

  // Calculate brightness for each LED (0-1)
  const getLEDBrightness = (ledIndex: number): number => {
    const ledStart = ledIndex * ledStep;
    const ledEnd = (ledIndex + 1) * ledStep;

    if (normalized < ledStart) {
      return 0;
    } else if (normalized >= ledEnd) {
      return 1;
    } else {
      // Gradual brightness within this LED's range
      return (normalized - ledStart) / ledStep;
    }
  };

  const leds = Array.from({ length: ledCount }, (_, ledIndex) => {
    const color = ledIndex === ledCount - 1
      ? 'red'
      : ledIndex === ledCount - 2
        ? 'orange'
        : 'green';

    return {
      brightness: getLEDBrightness(ledIndex),
      color
    };
  });

  const getLEDOpacity = (brightness: number) => Math.max(inactiveOpacity, brightness);

  return (
    <div
      className="small-led-meter"
      style={{
        flexDirection: vertical ? 'column-reverse' : 'row',
        height: vertical ? `${ledCount * 16 + 2}px` : 'auto',
        width: vertical ? '14px' : 'auto'
      }}
    >
      {leds.map((led, index) => (
        <div
          key={index}
          className={`small-led-meter__led small-led-meter__led--${led.color}`}
          style={{
            opacity: getLEDOpacity(led.brightness),
            width: '8px',
            height: vertical ? '14px' : '5px'
          }}
        />
      ))}
    </div>
  );
}
