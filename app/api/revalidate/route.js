import { revalidateTag } from "next/cache";

export async function POST(request) {
  revalidateTag("httpbin");
  return new Response("Success!", { status: 200 });
}
