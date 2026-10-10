import Link from "next/link";

export default function NotFoundPage() {
  return (
    <section className="welcome-card" aria-labelledby="not-found-heading">
      <h1 id="not-found-heading">ページが見つかりません。</h1>
      <p>URLをご確認ください。</p>
      <Link href="/">トップへ戻る</Link>
    </section>
  );
}
