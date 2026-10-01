import { ShieldCheck } from 'lucide-react';
import { supabase } from '../data/client';
import type { Me } from '../data/api';
import { Button, Card, EmptyState } from '../ui';

export function NoAccess({ me }: { me: Me }) {
  return (
    <main className="min-h-screen grid place-items-center p-6">
      <Card className="max-w-[460px] w-full">
        <EmptyState
          icon={<ShieldCheck />}
          title="Researcher access needed"
          body={`${me.email} is signed in as a ${me.role.replace('_', ' ')}. An administrator can give this account the researcher role; your data and walks in the app are not affected.`}
          action={
            <Button kind="ghost" onClick={() => supabase.auth.signOut()}>
              Sign Out
            </Button>
          }
        />
      </Card>
    </main>
  );
}
