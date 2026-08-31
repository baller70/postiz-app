export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';
import { ConnectionHealth } from '@gitroom/frontend/components/connection-health/connection-health';

export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Postiz' : 'Gitroom'} Connections`,
  description: '',
};

export default function ConnectionsPage() {
  return <ConnectionHealth />;
}
