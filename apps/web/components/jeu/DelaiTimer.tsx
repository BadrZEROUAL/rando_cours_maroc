'use client';

import { useState, useEffect, useRef } from 'react';

interface DelaiTimerProps {
  dureeSecondes?: number;
  onExpire: () => void;
}

export default function DelaiTimer({ dureeSecondes = 20, onExpire }: DelaiTimerProps) {
  const [secondesRestantes, setSecondesRestantes] = useState(dureeSecondes);
  const [expire, setExpire] = useState(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    setSecondesRestantes(dureeSecondes);
    setExpire(false);

    const interval = setInterval(() => {
      setSecondesRestantes(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setExpire(true);
          onExpireRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [dureeSecondes]);

  const pourcent = (secondesRestantes / dureeSecondes) * 100;
  const couleur = pourcent > 50 ? 'bg-blue-500' : pourcent > 25 ? 'bg-amber-500' : 'bg-red-500';

  if (expire) return null;

  return (
    <div className="w-full mb-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-500">
          Lisez attentivement avant de répondre
        </span>
        <span className={`text-sm font-bold tabular-nums ${
          secondesRestantes <= 5 ? 'text-red-600 animate-pulse' : 'text-gray-700'
        }`}>
          {secondesRestantes}s
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-2.5 rounded-full transition-all duration-1000 ease-linear ${couleur}`}
          style={{ width: `${pourcent}%` }}
        />
      </div>
      <p className="text-xs text-center text-gray-400 mt-1">
        Les réponses seront disponibles dans {secondesRestantes} seconde{secondesRestantes > 1 ? 's' : ''}
      </p>
    </div>
  );
}
