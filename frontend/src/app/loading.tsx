export default function Loading() {
  return (
    <main className="ph-route-loading" aria-label="Loading PandaHub">
      <div className="ph-route-loader">
        <div className="ph-route-ring ph-route-ring-outer" />
        <div className="ph-route-ring ph-route-ring-inner" />
        <div className="ph-route-core">P</div>
      </div>
      <div className="ph-route-wordmark">PANDAHUB</div>
      <div className="ph-route-caption">Preparing workspace</div>
    </main>
  );
}