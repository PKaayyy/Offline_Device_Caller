/**
 * SummaryCards Component: Renders the 5 frosted-glass statistic widgets at the top.
 * @param {Array} customers - The complete array of customer records fetched from database
 */
export function SummaryCards({ customers }) {
  // 1. Initialize count slots to aggregate database records
  const counts = {
    total: customers.length,
    pending: 0,
    calling: 0,
    completed: 0,
    failed: 0,
    no_answer: 0,
  };

  // 2. Scan through all loaded customer rows and increment counters
  for (const customer of customers) {
    if (counts[customer.callStatus] !== undefined) {
      counts[customer.callStatus] += 1;
    }
  }

  // 3. Define the metrics card visual setup.
  // The 'tone' property matches custom CSS bottom border accents (.summary-card--tone::before).
  const cards = [
    { key: "total", label: "Total customers", value: counts.total, tone: "purple" },
    { key: "pending", label: "Pending", value: counts.pending, tone: "amber" },
    { key: "calling", label: "Calling", value: counts.calling, tone: "blue" },
    { key: "completed", label: "Completed", value: counts.completed, tone: "green" },
    // Group exotel busy/no-answer outcomes and general failures into one red warning card
    { key: "failed", label: "Failed / no answer", value: counts.failed + counts.no_answer, tone: "red" },
  ];

  return (
    <section className="summary">
      {cards.map((card) => (
        // Renders standard grid widgets with theme tones mapping to CSS classes
        <article key={card.key} className={`summary-card summary-card--${card.tone}`}>
          <span className="summary-card__label">{card.label}</span>
          <strong className="summary-card__value">{card.value}</strong>
        </article>
      ))}
    </section>
  );
}
