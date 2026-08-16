export interface SpeciesMovesRow {
  id: number;
  name: string;
  moves: string[];
}

const RAW_ROWS = `
252,Treecko,Mega Drain,Dragon Claw,Leech Seed,Detect
253,Grovyle,Leaf Blade,Aerial Ace,Quick Attack,Swords Dance
254,Sceptile,Leaf Blade,Dragon Claw,ThunderPunch,Substitute
255,Torchic,Flamethrower,Aerial Ace,Focus Energy,Rock Tomb
256,Combusken,Sky Uppercut,Flamethrower,Bulk Up,Rock Tomb
257,Blaziken,Sky Uppercut,Blaze Kick,Rock Tomb,Swords Dance
258,Mudkip,Surf,Ice Beam,Protect,Toxic
259,Marshtomp,Surf,Earthquake,Rock Tomb,Protect
260,Swampert,Earthquake,Surf,Ice Beam,Curse
261,Poochyena,Crunch,Return,Howl,Toxic
262,Mightyena,Crunch,Return,Shadow Ball,Taunt
263,Zigzagoon,Return,Dig,Shadow Ball,Thunder Wave
264,Linoone,Return,Shadow Ball,Belly Drum,Substitute
265,Wurmple,Poison Sting,Tackle,String Shot,Protect
266,Silcoon,Harden,Iron Defense,Poison Sting,Toxic
267,Beautifly,Silver Wind,Giga Drain,Psychic,Morning Sun
268,Cascoon,Harden,Iron Defense,Poison Sting,Toxic
269,Dustox,Sludge Bomb,Psychic,Moonlight,Toxic
270,Lotad,Surf,Giga Drain,Rain Dance,Protect
271,Lombre,Surf,Giga Drain,Ice Beam,Rain Dance
272,Ludicolo,Surf,Giga Drain,Ice Beam,Rain Dance
273,Seedot,Bullet Seed,Dig,Leech Seed,Growth
274,Nuzleaf,Faint Attack,Razor Leaf,Brick Break,Swords Dance
275,Shiftry,Faint Attack,Leaf Blade,Brick Break,Swords Dance
276,Taillow,Wing Attack,Quick Attack,Steel Wing,Focus Energy
277,Swellow,Facade,Aerial Ace,Steel Wing,Quick Attack
278,Wingull,Surf,Ice Beam,Aerial Ace,Rain Dance
279,Pelipper,Surf,Ice Beam,Rain Dance,Protect
280,Ralts,Psychic,Thunderbolt,Calm Mind,Double Team
281,Kirlia,Psychic,Shock Wave,Calm Mind,Will-O-Wisp
282,Gardevoir,Psychic,Thunderbolt,Calm Mind,Will-O-Wisp
283,Surskit,BubbleBeam,Signal Beam,Ice Beam,Rain Dance
284,Masquerain,Silver Wind,Giga Drain,Stun Spore,Substitute
285,Shroomish,Giga Drain,Leech Seed,Stun Spore,Toxic
286,Breloom,Sky Uppercut,Mach Punch,Spore,Focus Punch
287,Slakoth,Return,Shadow Ball,Yawn,Slack Off
288,Vigoroth,Return,Shadow Ball,Bulk Up,Taunt
289,Slaking,Return,Earthquake,Shadow Ball,Focus Punch
290,Nincada,Dig,Fury Swipes,Sand-Attack,Protect
291,Ninjask,Silver Wind,Aerial Ace,Swords Dance,Substitute
292,Shedinja,Shadow Ball,Silver Wind,Dig,Swords Dance
293,Whismur,Hyper Voice,Flamethrower,Ice Beam,Thunderbolt
294,Loudred,Return,Shadow Ball,Flamethrower,Ice Beam
295,Exploud,Hyper Voice,Flamethrower,Ice Beam,Thunderbolt
296,Makuhita,Vital Throw,Rock Tomb,Bulk Up,Rest
297,Hariyama,Cross Chop,Rock Tomb,Bulk Up,Rest
298,Azurill,Surf,Ice Beam,Encore,Charm
299,Nosepass,Rock Tomb,Thunder Wave,Toxic,Rest
300,Skitty,Return,Thunder Wave,Sing,Charm
301,Delcatty,Return,Thunderbolt,Ice Beam,Thunder Wave
302,Sableye,Shadow Ball,Faint Attack,Will-O-Wisp,Recover
303,Mawile,Iron Tail,Brick Break,Swords Dance,Crunch
304,Aron,Iron Tail,Rock Tomb,Earthquake,Iron Defense
305,Lairon,Iron Tail,Rock Tomb,Earthquake,Roar
306,Aggron,Iron Tail,Rock Tomb,Earthquake,Focus Punch
307,Meditite,Hi Jump Kick,Psychic,Bulk Up,Rock Tomb
308,Medicham,Hi Jump Kick,Psychic,Rock Tomb,Bulk Up
309,Electrike,Thunderbolt,Crunch,Thunder Wave,Quick Attack
310,Manectric,Thunderbolt,Crunch,Thunder Wave,Hidden Power
311,Plusle,Thunderbolt,Thunder Wave,Encore,Wish
312,Minun,Thunderbolt,Thunder Wave,Encore,Charm
313,Volbeat,Signal Beam,Thunder Wave,Tail Glow,Moonlight
314,Illumise,Silver Wind,Wish,Encore,Thunder Wave
315,Roselia,Giga Drain,Sludge Bomb,Leech Seed,Toxic
316,Gulpin,Sludge,Yawn,Toxic,Amnesia
317,Swalot,Sludge Bomb,Yawn,Amnesia,Stockpile
318,Carvanha,Crunch,Surf,Ice Beam,Focus Energy
319,Sharpedo,Crunch,Surf,Ice Beam,Earthquake
320,Wailmer,Surf,Ice Beam,Rest,Sleep Talk
321,Wailord,Surf,Ice Beam,Body Slam,Rest
322,Numel,Flamethrower,Earthquake,Rock Tomb,Yawn
323,Camerupt,Flamethrower,Earthquake,Rock Tomb,Explosion
324,Torkoal,Flamethrower,Rapid Spin,Will-O-Wisp,Protect
325,Spoink,Psychic,Shadow Ball,Calm Mind,Rest
326,Grumpig,Psychic,Thunderbolt,Calm Mind,Rest
327,Spinda,Return,Shadow Ball,Teeter Dance,Focus Punch
328,Trapinch,Earthquake,Rock Tomb,Crunch,Sand-Attack
329,Vibrava,Earthquake,DragonBreath,Crunch,Sandstorm
330,Flygon,Earthquake,Dragon Claw,Flamethrower,Rock Tomb
331,Cacnea,Giga Drain,Brick Break,Swords Dance,Leech Seed
332,Cacturne,Giga Drain,Faint Attack,Brick Break,Swords Dance
333,Swablu,Fly,DragonBreath,Sing,Perish Song
334,Altaria,Dragon Claw,Aerial Ace,Earthquake,Dragon Dance
335,Zangoose,Return,Shadow Ball,Brick Break,Swords Dance
336,Seviper,Sludge Bomb,Flamethrower,Giga Drain,Glare
337,Lunatone,Psychic,Ice Beam,Calm Mind,Moonlight
338,Solrock,Rock Tomb,Earthquake,Calm Mind,Morning Sun
339,Barboach,Surf,Earthquake,Ice Beam,Rest
340,Whiscash,Surf,Earthquake,Ice Beam,Curse
341,Corphish,Crabhammer,Brick Break,Swords Dance,Return
342,Crawdaunt,Crabhammer,Crunch,Brick Break,Swords Dance
343,Baltoy,Earthquake,Psychic,Rapid Spin,Light Screen
344,Claydol,Earthquake,Psychic,Rapid Spin,Light Screen
345,Lileep,Giga Drain,AncientPower,Recover,Toxic
346,Cradily,Giga Drain,Rock Tomb,Recover,Toxic
347,Anorith,Rock Tomb,Silver Wind,Swords Dance,Aerial Ace
348,Armaldo,Rock Tomb,Brick Break,Swords Dance,Aerial Ace
349,Feebas,Surf,Toxic,Protect,Rest
350,Milotic,Surf,Ice Beam,Recover,Toxic
351,Castform,Weather Ball,Thunderbolt,Ice Beam,Flamethrower
352,Kecleon,Return,Shadow Ball,Thunder Wave,Recover
353,Shuppet,Shadow Ball,Will-O-Wisp,Thunderbolt,Destiny Bond
354,Banette,Shadow Ball,Will-O-Wisp,Thunderbolt,Destiny Bond
355,Duskull,Shadow Ball,Will-O-Wisp,Pain Split,Rest
356,Dusclops,Shadow Ball,Will-O-Wisp,Pain Split,Rest
357,Tropius,Giga Drain,Fly,Leech Seed,Synthesis
358,Chimecho,Psychic,Calm Mind,Heal Bell,Reflect
359,Absol,Shadow Ball,Swords Dance,Brick Break,Crunch
360,Wynaut,Counter,Mirror Coat,Encore,Safeguard
361,Snorunt,Ice Beam,Crunch,Spikes,Hail
362,Glalie,Ice Beam,Crunch,Spikes,Explosion
363,Spheal,Surf,Ice Beam,Rest,Sleep Talk
364,Sealeo,Surf,Ice Beam,Encore,Rest
365,Walrein,Surf,Ice Beam,Rest,Sleep Talk
366,Clamperl,Surf,Ice Beam,Toxic,Protect
367,Huntail,Surf,Crunch,Ice Beam,Rain Dance
368,Gorebyss,Surf,Ice Beam,Psychic,Agility
369,Relicanth,Rock Tomb,Earthquake,Double-Edge,Rest
370,Luvdisc,Surf,Ice Beam,Rain Dance,Sweet Kiss
371,Bagon,Dragon Claw,Rock Tomb,Dragon Dance,Flamethrower
372,Shelgon,Dragon Claw,Rock Tomb,Dragon Dance,Rest
373,Salamence,Dragon Claw,Flamethrower,Earthquake,Dragon Dance
374,Beldum,Take Down,Iron Defense,Rest,Sleep Talk
375,Metang,Meteor Mash,Psychic,Earthquake,Agility
376,Metagross,Meteor Mash,Earthquake,Rock Tomb,Agility
377,Regirock,Rock Tomb,Earthquake,Curse,Rest
378,Regice,Ice Beam,Thunderbolt,Rest,Sleep Talk
379,Registeel,Iron Tail,Toxic,Curse,Rest
380,Latias,Psychic,Dragon Claw,Calm Mind,Recover
381,Latios,Psychic,Dragon Claw,Thunderbolt,Calm Mind
382,Kyogre,Surf,Ice Beam,Thunderbolt,Calm Mind
383,Groudon,Earthquake,Rock Tomb,Swords Dance,Bulk Up
384,Rayquaza,Dragon Claw,Flamethrower,Earthquake,Dragon Dance
385,Jirachi,Psychic,Doom Desire,Thunderbolt,Calm Mind
386,Deoxys,Psychic,Ice Beam,Thunderbolt,Calm Mind
`.trim();

export const CURATED_SPECIES_MOVES_GEN3: Record<number, SpeciesMovesRow> = Object.fromEntries(
  RAW_ROWS.split('\n').map((line) => {
    const parts = line.split(',');
    const id = Number(parts[0].trim());
    const name = parts[1].trim();
    const slots = parts.slice(2, 6).map((x) => x.trim()).filter(Boolean);
    return [
      id,
      {
        id,
        name,
        moves: slots,
      } satisfies SpeciesMovesRow,
    ];
  }),
);
