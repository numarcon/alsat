"use client";

import { useEffect } from "react";

export default function DispatcherError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Alsat dispatcher recovery", error); }, [error]);
  const recover = () => {
    localStorage.removeItem("alsat-dispatcher-route-orders");
    reset();
  };
  return <main className="qmart-role dispatcher-shell"><section className="dispatcher-error-screen"><span>⌖</span><h1>Маршрутты қайта жаңартамыз</h1><p>Тапсырыстар мен жеткізу дәлелдері сақталды. Карта дерегін тазалап, қайта ашыңыз.</p><button onClick={recover}>Картаны қайта ашу</button><a href="/dispatcher">Экспедитордың басты бетіне өту</a></section></main>;
}
