import { fetch } from 'bun';
import * as Cheerio from 'cheerio';
import type { BaseCharacter } from './getCharacter';

const cache = new Map<number, string>();
const expires = new Map<number, number>();
const expiresTime = 1000 * 60 * 6;

async function fetchGuild(guildId: number) {
    if (cache.has(guildId)) {
        if (expires.has(guildId) && Number(expires.get(guildId)) > Date.now()) {
            console.log('[CACHE] Guild', guildId, 'found in cache');
            return cache.get(guildId) as string;
        }
        console.log('[CACHE] Guild', guildId, 'was expired, need to fetch again!');
    }
    console.log('[CACHE] Guild', guildId, ' fetching...');
    const res = await fetch(
        `https://baiaksp.online/?subtopic=guilds&action=show&guild=${guildId}`,
        { method: 'POST' }
    );
    console.log('[FETCH] Guild', guildId, 'fetched');
    const html = await res.text();
    expires.set(guildId, Date.now() + expiresTime);
    cache.set(guildId, html);
    return html;
}

export async function getGuild(guildId: number): Promise<Guild> {
    try {
        const guildHtml = await fetchGuild(guildId);
        const $ = Cheerio.load(guildHtml);
        const membersGuildData =
            $('table:nth-child(2) > tbody > tr:nth-child(4) > td:nth-child(2)').text() ||
            '0 membros. (Max: 0 Players )';
        const membersGuildMatch = membersGuildData.match(/(\d+)\s*membros.*Max:\s*(\d+)/);
        const guild: Guild = {
            id: guildId,
            name: $('h1').text(),
            description: $(
                'table:nth-child(2) > tbody > tr:nth-child(1) > td:nth-child(2) > p'
            ).text(),
            online: $('td.onlinestatus > span.green').length,
            members: parseInt(membersGuildMatch?.[1] || '0', 0),
            maxMembers: parseInt(membersGuildMatch?.[2] || '0', 0),
            list: $('div.TableContentAndRightShadow > div > table > tbody > tr')
                .map((_, el) => {
                    return {
                        name: $(el).find('td:nth-child(2) > form > a').text(),
                        vocation:
                            $(el).find('td:nth-child(3)').text().split(' ').reverse()[0] || '',
                        level: parseInt($(el).find('td:nth-child(4)').text(), 0),
                        online: $(el)
                            .find('td.onlinestatus > span.green')
                            .text()
                            .startsWith('online'),
                    };
                })
                .toArray()
                .filter(f => f.name && f.vocation && f.level > 0),
        };
        return guild;
    } catch (err) {
        console.error('Erro ao buscar guild:', err);
        return null as unknown as Guild;
    }
}

export type Guild = {
    name: string;
    description: string;
    members: number;
    maxMembers: number;
    online: number;
    id: number;
    list: BaseCharacter[];
};
