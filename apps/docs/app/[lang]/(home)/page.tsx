import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col justify-center text-center flex-1">
      <h1 className="text-2xl font-bold mb-4">Nest Boot</h1>
      <p className="mb-4 text-fd-muted-foreground">
        A modular framework for building NestJS applications
      </p>
      <p>
        <Link href="/docs" className="font-medium underline">
          Get Started →
        </Link>
      </p>
    </div>
  );
}
