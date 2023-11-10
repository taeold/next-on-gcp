import { now } from "@/lib/utils";

export const revalidate = 10; // revalidate at most once every 10 seconds

export default function RevlidateRoutePage() {
  return (
    <div className="code">
      <div className="center big-font">
        <div>A server generated page!</div>
      </div>
      <div className="center medium-font">
        <div>(should be regenerated every 10 seconds)</div>
      </div>
      <div className="center medium-font">Last Generated {now()}</div>
    </div>
  );
}
