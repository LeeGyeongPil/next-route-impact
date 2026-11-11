export default async function Dynamic() {
  const name = 'format';
  // A path computed at run time cannot be followed statically; the tool reports it as unresolved.
  await import(`@/lib/${name}`);
  return null;
}
