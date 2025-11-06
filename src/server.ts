import { readFileSync } from 'fs';
import { join } from 'path';
import { getCharacter, type Character } from './utils/getCharacter';
import { getGuild } from './utils/getGuild';

const PUBLIC_DIR = './public';

function sortCharacters(type: string, characters: Character[]): Character[] {
    if (type === 'resets') {
        return [...characters].sort((a, b) => b.resets - a.resets);
    }

    if (type === 'vocation') {
        const vocationOrder = ['druid', 'sorcerer', 'paladin', 'knight'];

        return [...characters].sort((a, b) => {
            const vocA = a.vocation.toLowerCase();
            const vocB = b.vocation.toLowerCase();

            const indexA = vocationOrder.indexOf(vocA);
            const indexB = vocationOrder.indexOf(vocB);

            if (indexA === indexB) {
                // mesma vocação -> maior reset primeiro
                return b.resets - a.resets;
            }

            return indexA - indexB; // ordena pela ordem definida
        });
    }

    // padrão alfabético
    return [...characters].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );
}

const server = Bun.serve({
    port: 3000,
    idleTimeout: 120,
    routes: {
        '/': Response.json({ message: 'Server running' }),

        '/public/:file': async req => {
            const filePath = join(PUBLIC_DIR, req.params.file);
            try {
                const file = readFileSync(filePath);
                const ext = filePath.split('.').pop()?.toLowerCase();
                const types: Record<string, string> = {
                    css: 'text/css',
                    js: 'application/javascript',
                    png: 'image/png',
                    jpg: 'image/jpeg',
                    jpeg: 'image/jpeg',
                    svg: 'image/svg+xml',
                    html: 'text/html',
                };
                return new Response(file, {
                    headers: { 'Content-Type': types[ext ?? ''] || 'application/octet-stream' },
                });
            } catch {
                return new Response('File not found', { status: 404 });
            }
        },

        '/guilds/:guildId': async req => {
            const { guildId } = req.params;
            const url = new URL(req.url);
            const sortType = url.searchParams.get('sort') || 'alphabetical';
            const encoder = new TextEncoder();

            const guild = await getGuild(parseInt(guildId) || 362);
            let html = readFileSync('./public/list.html', 'utf8');

            html = html
                .replaceAll(/{{GUILD_ID}}/g, guild.id.toString())
                .replaceAll('{{GUILD_NAME}}', guild.name)
                .replace('{{GUILD_DESC}}', guild.description)
                .replace('{{ONLINE}}', guild.online.toString())
                .replace('{{MEMBERS}}', guild.members.toString())
                .replace('{{MAX_MEMBERS}}', guild.maxMembers.toString());

            const splitPoint = '<!-- {{MEMBERS}} -->';
            const [beforeList, afterList] = html.split(splitPoint);

            const stream = new ReadableStream({
                async start(controller) {
                    const encoder = new TextEncoder();

                    // 1️⃣ envia o HTML antes da lista
                    controller.enqueue(encoder.encode(beforeList));
                    controller.enqueue(encoder.encode(splitPoint));

                    // 2️⃣ mostra loader (já presente no HTML)

                    // 3️⃣ carrega todos os personagens em paralelo
                    const allChars: Character[] = [];
                    await Promise.all(
                        guild.list.map(async player => {
                            try {
                                const details = await getCharacter(player.name);
                                if (details) allChars.push({ ...player, ...details });
                            } catch {
                                allChars.push({
                                    ...player,
                                    name: player.name,
                                    vocation: 'Erro',
                                    level: 0,
                                    resets: 0,
                                    skin: '',
                                } as Character);
                            }
                        })
                    );

                    // 4️⃣ ordena os personagens
                    const sorted = sortCharacters(sortType, allChars);

                    // 5️⃣ envia cada card via stream
                    for (const char of sorted) {
                        const cardHTML = `
        <div class="member-card">
          <div class="member-info">
            <img src="${char.skin}" alt="${char.name}" class="skin" width="64" height="64">
            <img src="/public/pedestal.gif" alt="pedestal" class="pedestal" width="64" height="64">
            <div>
              <h3 class="member-name">${char.name}</h3><br>
              <small>Lv ${char.level} — ${char.vocation}</small><br>
              <small>Resets: ${char.resets}</small>
            </div>
          </div>
          <button class="copy-btn" onclick="navigator.clipboard.writeText('${char.name}')">Copiar</button>
        </div>
      `;
                        controller.enqueue(encoder.encode(cardHTML));
                    }

                    // 6️⃣ remove o loader
                    controller.enqueue(
                        encoder.encode(`<script>
        const loader = document.getElementById('loading');
        if (loader) loader.remove();
      </script>`)
                    );

                    // 7️⃣ fecha a seção de membros
                    controller.enqueue(encoder.encode(`</div>`));

                    // 8️⃣ adiciona footer custom no final do body
                    controller.enqueue(
                        encoder.encode(`
        <footer>
          <h2>Lista de membros</h2>
          <textarea readonly rows="8">${sorted.map(c => c.name).join('\n')}</textarea>
          <br>
          <button onclick="navigator.clipboard.writeText(document.querySelector('textarea').value)">Copiar nomes</button>
        </footer>
      `)
                    );
                    // 9️⃣ envia o restante do HTML base
                    controller.enqueue(encoder.encode(afterList));

                    controller.close();
                },
            });

            return new Response(stream, {
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
            });
        },
    },
});

console.log(`🚀 Server running at ${server.url}`);
