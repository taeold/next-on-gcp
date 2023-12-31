"use client";
import { useRouter } from "next/navigation";

export default function RevalidateButton() {
  const router = useRouter();

  async function handleClick(e) {
    e.preventDefault();
    await fetch("/api/revalidate", { method: "POST" });
  }
  return (
    <button className="big-font" onClick={handleClick}>
      Revalidate
    </button>
  );
}
