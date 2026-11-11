import { useCart } from '@/hooks/useCart';

export default function Product() {
  useCart();
  return <p>Product</p>;
}
