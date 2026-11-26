export type Role = 'admin' | 'member';
export type Observed = {
  role: Role; email: string;
  authUser: { localId: string; customAttributes?: string } | null;
  userDoc: Record<string, unknown> | null;
  publicDoc: Record<string, unknown> | null;
  hasPassword: boolean;
};
export type Action = { kind: 'createAuth' | 'setPassword' | 'setAdminClaim' | 'createUserDoc' | 'createPublicDoc' | 'setIsAdmin'; role: Role };

const claims = (attrs?: string): Record<string, unknown> => { try { return attrs ? JSON.parse(attrs) : {}; } catch { return {}; } };

export function planProvision(observed: Observed[]): Action[] {
  const actions: Action[] = [];
  for (const o of observed) {
    const add = (kind: Action['kind']) => actions.push({ kind, role: o.role });
    if (!o.authUser) add('createAuth');
    else if (!o.hasPassword) add('setPassword');
    if (!o.userDoc) add('createUserDoc');
    if (!o.publicDoc) add('createPublicDoc');
    if (o.role === 'admin') {
      if (o.userDoc?.isAdmin !== true) add('setIsAdmin');
      if (claims(o.authUser?.customAttributes).admin !== true) add('setAdminClaim');
    }
  }
  return actions;
}
