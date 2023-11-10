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
        <div>Got UUID: {uuid}</div>
      </div>
      <div className="center medium-font">
        <RevlidateButton />
      </div>
      <div className="center medium-font">Last Generated {now()}</div>
    </div>
  );
}
