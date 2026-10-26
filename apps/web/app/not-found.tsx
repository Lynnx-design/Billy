import Link from "next/link";
import { Logo } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo />
      <p className="text-5xl">🤷🏾‍♀️</p>
      <h1 className="text-xl font-bold">We couldn't find that page</h1>
      <Link href="/" className="btn-primary">
        Go home
      </Link>
    </div>
  );
}
