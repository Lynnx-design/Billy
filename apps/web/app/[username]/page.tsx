import { formatNaira, getTemplate } from "@billy/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, Logo } from "@/components/ui";
import { fetchProfile } from "@/lib/server";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const profile = await fetchProfile(username);
  if (!profile) return { title: "Not found" };
  return { title: `${profile.name} on Billy`, description: profile.bio ?? `Bills from ${profile.name}` };
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;
  const profile = await fetchProfile(username);
  if (!profile) notFound();

  return (
    <div className="mx-auto min-h-screen max-w-md px-4 py-6">
      <div className="mb-6 flex justify-center">
        <Logo size="sm" />
      </div>
      <div className="card flex flex-col items-center text-center">
        <Avatar name={profile.name} url={profile.avatarUrl} size={88} />
        <h1 className="mt-3 text-2xl font-bold">{profile.name}</h1>
        <p className="text-sm text-gray-500">billy/{profile.username}</p>
        {profile.bio && <p className="mt-2 text-gray-700">{profile.bio}</p>}
      </div>

      <h2 className="mb-3 mt-6 font-semibold">Open bills</h2>
      {profile.bills.length === 0 ? (
        <p className="card text-center text-gray-500">No public bills right now.</p>
      ) : (
        <ul className="space-y-3">
          {profile.bills.map((b) => (
            <li key={b.slug}>
              <Link href={`/b/${b.slug}`} className="card flex items-center gap-3 transition hover:border-brand-300">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-xl" aria-hidden>
                  {getTemplate(b.category).emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{b.title}</span>
                  <span className="block text-sm text-gray-500">
                    {formatNaira(b.totalKobo - b.paidKobo)} {b.paidKobo > 0 ? "left" : ""}
                  </span>
                </span>
                <span className="btn-primary px-4 py-2">Pay</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-10 text-center text-xs text-gray-400">
        <Link href="/" className="font-medium text-brand-600">
          Make your own Billy page
        </Link>
      </p>
    </div>
  );
}
