import { getDoc, listAuthUsers } from '../lib/staging-admin.ts';
import { inboxCount } from '../lib/mail.ts';

const season = await getDoc('season_config/current');
console.log('staging season:', season?.activeSeasonId, season?.status);
const users = await listAuthUsers();
console.log('staging auth users:', users.length, 'e2e:', users.filter((u) => u.email?.startsWith('lol.e2e.bot+')).map((u) => u.email));
console.log('bot inbox messages:', await inboxCount());
