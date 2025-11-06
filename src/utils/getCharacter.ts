import { fetch } from 'bun';
import * as Cheerio from 'cheerio';

const cache = new Map<string, string>();
const expires = new Map<string, number>();
const expiresTime = 1000 * 60 * 6;

async function fetchCharacter(characterName: string) {
    if (cache.has(characterName)) {
        if (expires.has(characterName) && Number(expires.get(characterName)) > Date.now()) {
            console.log('[CACHE] Character', characterName, 'found in cache');
            return cache.get(characterName) as string;
        }
        console.log('[CACHE] Character', characterName, 'was expired, need to fetch again!');
    }
    console.log('[CACHE] Character', characterName, ' fetching...');
    const res = await fetch(`https://baiaksp.online/?subtopic=characters&name=${characterName}`, {
        method: 'POST',
    });
    console.log('[FETCH] Character', characterName, 'fetched');
    const html = await res.text();
    cache.set(characterName, html);
    expires.set(characterName, Date.now() + expiresTime);
    return html;
}

export async function getCharacter(characterName: string): Promise<DetailsCharacter> {
    try {
        const guildHtml = await fetchCharacter(characterName);
        const $ = Cheerio.load(guildHtml);

        return {
            resets: parseInt(
                $(
                    'table > tbody > tr > td:nth-child(2) > table > tbody > tr:nth-child(5) > td:nth-child(2)'
                ).text(),
                0
            ),
            skin:
                'https://baiaksp.online' +
                    $('div.outfitchradcters')
                        .attr('style')
                        ?.replace('background-image: url(', '')
                        .replace(');', '') || '',
        };
    } catch (err) {
        console.error('Erro ao buscar char:', err);
        return null as unknown as DetailsCharacter;
    }
}

export async function fetchCharacters(characters: BaseCharacter[]): Promise<Character[]> {
    console.log(`[FETCH] Fetching ${characters.length} characters...`);
    const fetched: Character[] = [];
    for (const character of characters) {
        console.log(
            `[FETCH] (${characters.indexOf(character) + 1}/${
                characters.length
            }) Fetching character ${character.name}`
        );
        const details = await getCharacter(character.name);
        fetched.push({
            ...character,
            ...details,
        });
    }
    return fetched;
}

export type DetailsCharacter = {
    resets: number;
    skin: string;
};

export type BaseCharacter = {
    name: string;
    vocation: string;
    level: number;
    online: boolean;
};

export type Character = BaseCharacter & DetailsCharacter;
