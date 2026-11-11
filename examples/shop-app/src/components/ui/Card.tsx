import type { Theme } from '@/lib/theme';

export const Card = (props: { theme?: Theme }) => <div data-theme={props.theme} />;
