export function SummaryCards({ customers }) {
  const counts = {
    total: customers.length,
    pending: 0,
    calling: 0,
    completed: 0,
    failed: 0,
    no_answer: 0,
  };

  for (const customer of customers) {
    if (counts[customer.callStatus] !== undefined) {
      counts[customer.callStatus] += 1;
    }
  }

  const cards = [
    { key: "total", label: "Total customers", value: counts.total, tone: "neutral" },
    { key: "pending", label: "Pending", value: counts.pending, tone: "amber" },
    { key: "calling", label: "Calling", value: counts.calling, tone: "blue" },
    { key: "completed", label: "Completed", value: counts.completed, tone: "green" },
    { key: "failed", label: "Failed / no answer", value: counts.failed + counts.no_answer, tone: "red" },
  ];

  return (
    <section className="summary">
      {cards.map((card) => (
        <article key={card.key} className={`summary-card summary-card--${card.tone}`}>
          <span className="summary-card__label">{card.label}</span>
          <strong className="summary-card__value">{card.value}</strong>
        </article>
      ))}
    </section>
  );
}
