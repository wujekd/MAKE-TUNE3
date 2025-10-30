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
  
  // Calculate brightness for each LED (0-1)
  // Each LED represents 0.25 of the range
  const getLEDBrightness = (ledIndex: number): number => {
    const ledStart = ledIndex * 0.25;
    const ledEnd = (ledIndex + 1) * 0.25;
    
    if (normalized < ledStart) {
      return 0;
    } else if (normalized >= ledEnd) {
      return 1;
    } else {
      // Gradual brightness within this LED's range
      return (normalized - ledStart) / 0.25;
    }
  };

  const led1Brightness = getLEDBrightness(0); // 0-0.25
  const led2Brightness = getLEDBrightness(1); // 0.25-0.5
  const led3Brightness = getLEDBrightness(2); // 0.5-0.75
  const led4Brightness = getLEDBrightness(3); // 0.75-1.0

  return (
    <div 
      className="small-led-meter" 
      style={{ 
        flexDirection: vertical ? 'column-reverse' : 'row',
        height: vertical ? '70px' : 'auto',
        width: vertical ? '14px' : 'auto'
      }}
    >
      <div 
        className="small-led-meter__led small-led-meter__led--green"
        style={{ 
          opacity: Math.max(0.15, led1Brightness),
          width: vertical ? '8px' : '8px',
          height: vertical ? '14px' : '5px'
        }}
      />
      <div 
        className="small-led-meter__led small-led-meter__led--green"
        style={{ 
          opacity: Math.max(0.15, led2Brightness),
          width: vertical ? '8px' : '8px',
          height: vertical ? '14px' : '5px'
        }}
      />
      <div 
        className="small-led-meter__led small-led-meter__led--green"
        style={{ 
          opacity: Math.max(0.15, led3Brightness),
          width: vertical ? '8px' : '8px',
          height: vertical ? '14px' : '5px'
        }}
      />
      <div 
        className="small-led-meter__led small-led-meter__led--red"
        style={{ 
          opacity: Math.max(0.15, led4Brightness),
          width: vertical ? '8px' : '8px',
          height: vertical ? '14px' : '5px'
        }}
      />
    </div>
  );
}

