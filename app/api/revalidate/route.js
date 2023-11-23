import { revalidatePath } from "next/cache";

export async function POST(request) {
  revalidatePath("/revalidate/demand");
  return new Response("Success!", { status: 200 });
}
