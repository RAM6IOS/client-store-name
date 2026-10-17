export default function AdminOrdersLoading() {
  return (
    <div className="stack" aria-busy="true">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-block" />
      <div className="skeleton skeleton-block" />
      <div className="skeleton skeleton-block" />
    </div>
  )
}
