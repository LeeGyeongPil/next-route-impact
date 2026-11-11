import dynamic from 'next/dynamic';

// next/dynamic wraps a dynamic import; it counts as an import edge.
const Chart = dynamic(() => import('@/components/Chart'));

export default function Analytics() {
  return <Chart />;
}
