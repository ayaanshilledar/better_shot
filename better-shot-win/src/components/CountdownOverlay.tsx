import React, { useEffect, useState } from 'react';

interface CountdownOverlayProps {
  initialCount?: number;
  onFinish: () => void;
}

export const CountdownOverlay: React.FC<CountdownOverlayProps> = ({
  initialCount = 3,
  onFinish
}) => {
  const [count, setCount] = useState<number>(initialCount);

  useEffect(() => {
    if (count <= 0) {
      onFinish();
      return;
    }

    const timer = setInterval(() => {
      setCount((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [count, onFinish]);

  return (
    <div className="countdown-overlay">
      <div className="countdown-circle">
        <div key={count} className="countdown-number">
          {count > 0 ? count : 'GO!'}
        </div>
      </div>
      <div className="countdown-label">
        {count > 0 ? `Recording starting in ${count}...` : 'Recording live!'}
      </div>
    </div>
  );
};
