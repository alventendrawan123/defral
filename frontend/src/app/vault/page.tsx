import type { Metadata } from 'next';

import Container from './_components/container';

export const metadata: Metadata = { title: 'Reserve and policy' };

export const revalidate = 30;

export default function Page() {
  return <Container />;
}
