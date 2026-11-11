export default function Root({ children }: { children: unknown }) {
  return (
    <html>
      <body>{children as never}</body>
    </html>
  );
}
