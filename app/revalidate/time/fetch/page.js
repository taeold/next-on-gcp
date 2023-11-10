import { now } from "@/lib/utils";

export default async function RevlidateFetchPage() {
  const resp = await fetch("https://httpbin.org/uuid", {
    next: { revalidate: 10 },
  });
  const { uuid } = await resp.json();
  return (
    <div className="code">
      <div className="center big-font">
        <div>A server generated page!</div>
      </div>
      <div className="center big-font">
        <div>{uuid.slice(0, 8)}</div>
      </div>
      <div className="center medium-font">
        <div>(should be regenerated every 10 seconds)</div>
      </div>
      <div className="center medium-font">Last Generated {now()}</div>
    </div>
  );
}
