export default function Loading() {
  return (
    <div className="page" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="skeleton" style={{ height: "2.5rem", width: "40%", marginBottom: "1.5rem" }} />
      <div className="grid-products">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="skeleton skeleton-card" />
        ))}
      </div>
    </div>
  )
}
