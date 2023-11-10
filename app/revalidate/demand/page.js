import { now } from "@/lib/utils";
import RevlidateButton from "./revalidateButton";

export default async function RevlidateOnDemandPage() {
  const resp = await fetch("https://httpbin.org/uuid", {
    next: { tags: ["httpbin"] },
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
        <RevlidateButton />
      </div>
      <div className="center medium-font">Last Generated {now()}</div>
    </div>
  );
}
