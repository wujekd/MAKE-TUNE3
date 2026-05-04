import './SmallLEDMeter.css';

interface SmallLEDMeterProps {
  value: number;  // 0 to 1
  min?: number;
  max?: number;
  vertical?: boolean;
}

export function SmallLEDMeter({ value, min = 0, max = 1, vertical = false }: SmallLEDMeterProps) {
  const clamped = Math.min(max, Math.max(min, value));
  const normalized = (clamped - min) / (max - min || 1);
  const inactiveOpacity = 0.15;

  const ledCount = 6;
  const ledStep = 1 / ledCount;

  // Calculate brightness for each LED (0-1)
  // Each LED represents 1/6 of the range
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

  const led1Brightness = getLEDBrightness(0);
  const led2Brightness = getLEDBrightness(1);
  const led3Brightness = getLEDBrightness(2);
  const led4Brightness = getLEDBrightness(3);
  const led5Brightness = getLEDBrightness(4);
  const led6Brightness = getLEDBrightness(5);
  const getLEDOpacity = (brightness: number) => Math.max(inactiveOpacity, brightness);

  return (
    <div
      className="small-led-meter"
      style={{
        flexDirection: vertical ? 'column-reverse' : 'row',
        height: vertical ? '98px' : 'auto',
        width: vertical ? '14px' : 'auto'
      }}
    >
      <div
        className="small-led-meter__led small-led-meter__led--green"
        style={{
          opacity: getLEDOpacity(led1Brightness),
          width: vertical ? '8px' : '8px',
          height: vertical ? '14px' : '5px'
        }}
      />
      <div
        className="small-led-meter__led small-led-meter__led--green"
        style={{
          opacity: getLEDOpacity(led2Brightness),
          width: vertical ? '8px' : '8px',
          height: vertical ? '14px' : '5px'
        }}
      />
      <div
        className="small-led-meter__led small-led-meter__led--green"
        style={{
          opacity: getLEDOpacity(led3Brightness),
          width: vertical ? '8px' : '8px',
          height: vertical ? '14px' : '5px'
        }}
      />
      <div
        className="small-led-meter__led small-led-meter__led--green"
        style={{
          opacity: getLEDOpacity(led4Brightness),
          width: vertical ? '8px' : '8px',
          height: vertical ? '14px' : '5px'
        }}
      />
      <div
        className="small-led-meter__led small-led-meter__led--orange"
        style={{
          opacity: getLEDOpacity(led5Brightness),
          width: vertical ? '8px' : '8px',
          height: vertical ? '14px' : '5px'
        }}
      />
      <div
        className="small-led-meter__led small-led-meter__led--red"
        style={{
          opacity: getLEDOpacity(led6Brightness),
          width: vertical ? '8px' : '8px',
          height: vertical ? '14px' : '5px'
        }}
      />
    </div>
  );
}
