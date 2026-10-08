/**
 * Service registry. To add a service: create `src/integrations/<id>/index.ts`
 * exporting a `defineService({...})` and add one line below. Nothing else in
 * the app needs to change.
 */
import type { ServiceDefinition } from '@shared/types/service';
import whatsapp from './whatsapp';
import messenger from './messenger';
import instagram from './instagram';
import discord from './discord';
import telegram from './telegram';
import slack from './slack';
import teams from './teams';
import googleChat from './google-chat';
import gmail from './gmail';
import reddit from './reddit';
import x from './x';

export const SERVICE_DEFINITIONS: readonly ServiceDefinition[] = [
  whatsapp, messenger, instagram, discord, telegram, slack, teams, googleChat, gmail, reddit, x,
];

const byId = new Map(SERVICE_DEFINITIONS.map((d) => [d.id, d]));

export function getServiceDefinition(id: string): ServiceDefinition | undefined {
  return byId.get(id);
}
