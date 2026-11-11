import { Card } from '@/components/ui';

export default function Marketing({ children }: { children: unknown }) {
  return (
    <>
      <Card />
      {children as never}
    </>
  );
}
