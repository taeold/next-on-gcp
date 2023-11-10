import { now } from "@/lib/utils";

export default function StaticPage() {
  return (
    <div className="code">
      <div className="center big-font">
        <div>A statically generated page! </div>
      </div>
      <div className="center medium-font">Generated {now()}</div>
    </div>
  );
}
