export const config = {
  matcher: "/(.*)",
};

export default function middleware(request: Request) {
  const country = (request.headers.get("x-vercel-ip-country") || "")
    .trim()
    .toUpperCase();

  if (country !== "BR") {
    return new Response("Acesso disponível somente no Brasil.", {
      status: 403,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      },
    });
  }
}
