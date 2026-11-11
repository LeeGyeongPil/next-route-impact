export default function Dashboard({ children, analytics }: { children: unknown; analytics: unknown }) {
  return (
    <>
      {children as never}
      {analytics as never}
    </>
  );
}
