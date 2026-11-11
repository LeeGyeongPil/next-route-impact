export default async function Shop() {
  // A dynamic import with a literal path is followed like a normal import.
  const mod = await import('@/lib/format');
  return <p>{mod.fmt(3)}</p>;
}
